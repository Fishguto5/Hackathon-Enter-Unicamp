from __future__ import annotations

import re
from typing import Any
import unicodedata


EVIDENCE_WEIGHTS = {
    "contrato": 20,
    "extrato": 20,
    "comprovante_credito": 15,
    "dossie": 15,
    "evolucao_divida": 10,
    "laudo_referenciado": 5,
}

EVIDENCE_CONTEXT_TERMS = {
    "contrato": ("cedula de credito", "contrato de emprestimo", "termo de contratacao"),
    "extrato": ("extrato bancario", "extrato de movimentacao", "lancamentos"),
    "comprovante_credito": ("comprovante de credito", "comprovante de operacao de credito"),
    "dossie": ("peticao inicial", "acao declaratoria", "autos do processo"),
    "evolucao_divida": ("demonstrativo de evolucao da divida", "saldo devedor", "parcelas liquidadas"),
    "laudo_referenciado": ("laudo referenciado", "canal de contratacao e evidencias"),
}


def _normalize_for_search(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", normalized).strip().lower()


def _document_value(document: Any, field: str, default: str = "") -> str:
    if isinstance(document, dict):
        value = document.get(field, default)
    else:
        value = getattr(document, field, default)
    return str(value or default)


def _find_context_excerpt(text: str, evidence_key: str) -> str | None:
    terms = EVIDENCE_CONTEXT_TERMS.get(evidence_key, ())
    for raw_line in text.splitlines():
        line = re.sub(r"[\x00-\x1f\x7f]+", " ", raw_line).strip()
        if line and any(term in _normalize_for_search(line) for term in terms):
            return line[:280]
    return None


def _evidence_sources(documents: list[Any] | None, evidence_key: str) -> list[dict[str, str | None]]:
    sources = []
    for document in documents or []:
        if _document_value(document, "classification") != evidence_key:
            continue
        sources.append(
            {
                "filename": _document_value(document, "filename", "Documento sem nome"),
                "excerpt": _find_context_excerpt(
                    _document_value(document, "extracted_text"), evidence_key
                ),
            }
        )
    return sources


def _has_extracted_value(value: Any) -> bool:
    if isinstance(value, (int, float)):
        return value > 0
    return isinstance(value, str) and value.strip().lower() not in {"", "nao identificado"}


def _format_currency(value: Any) -> str:
    return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _evidence_facts(evidence_key: str, extracted_data: dict[str, Any]) -> list[str]:
    facts: list[str] = []

    def add_text(label: str, field: str) -> None:
        value = extracted_data.get(field)
        if _has_extracted_value(value):
            facts.append(f"{label}: {value}.")

    def add_currency(label: str, field: str) -> None:
        value = extracted_data.get(field)
        if _has_extracted_value(value):
            facts.append(f"{label}: {_format_currency(value)}.")

    if evidence_key == "contrato":
        add_text("Contrato identificado", "numero_contrato")
        add_text("Data da contratacao", "data_contratacao")
        add_currency("Valor da parcela", "valor_parcela")
    elif evidence_key == "extrato":
        add_text("Conta creditada", "conta_creditada")
        add_currency("Valor liberado", "valor_liberado")
        add_text("Data de liberacao", "data_liberacao_credito")
    elif evidence_key == "comprovante_credito":
        add_currency("Credito informado", "valor_liberado")
        add_text("Data de liberacao", "data_liberacao_credito")
        add_text("Conta creditada", "conta_creditada")
    elif evidence_key == "dossie":
        add_text("Assunto processual", "assunto")
        if extracted_data.get("alegacao_fraude") == "sim":
            facts.append("Alegacao de fraude identificada nos autos.")
        if extracted_data.get("negacao_contratacao") == "sim":
            facts.append("Negacao da contratacao identificada nos autos.")
    elif evidence_key == "evolucao_divida":
        add_text("Parcelas liquidadas", "parcelas_liquidadas")
        add_currency("Saldo devedor", "saldo_devedor")
        add_currency("Valor da parcela", "valor_parcela")
    elif evidence_key == "laudo_referenciado":
        add_text("Canal de contratacao", "canal_contratacao")
        add_text("Contrato identificado", "numero_contrato")
        add_currency("Valor total pactuado", "valor_total_pactuado")

    return facts


def build_case_intelligence(
    extracted_data: dict[str, Any],
    subsidies: dict[str, int],
    model_prediction: dict[str, Any] | None,
    documents: list[Any] | None = None,
) -> dict[str, Any]:
    evidence = []
    raw_ifp = 0.0
    missing = []

    for key, weight in EVIDENCE_WEIGHTS.items():
        present = int(subsidies.get(key, 0)) == 1
        status = "present_and_verified" if present else "missing"
        contribution = float(weight if present else 0)
        raw_ifp += contribution
        if not present:
            missing.append(key)
        evidence.append({
            "key": key,
            "status": status,
            "weight": weight,
            "multiplier": 1.0 if present else 0.0,
            "contribution": contribution,
            "source_documents": _evidence_sources(documents, key) if present else [],
            "facts_considered": _evidence_facts(key, extracted_data) if present else [],
        })

    penalties = 0.0
    if not subsidies.get("contrato"):
        penalties += 10
    if not subsidies.get("comprovante_credito"):
        penalties += 8
    if not subsidies.get("dossie"):
        penalties += 5

    ifp = round(max(0.0, min(100.0, raw_ifp - penalties)), 2)
    completeness = round(sum(1 for item in evidence if item["status"] != "missing") / len(evidence) * 100, 2)
    model_failure = float((model_prediction or {}).get("probability_failure") or 0.0) * 100
    risk = round(max(0.0, min(100.0, max(model_failure, 55.0) - 0.5 * ifp)), 2)

    claim_amount = float(extracted_data.get("valor_causa") or 0.0)
    suggested_agreement = (model_prediction or {}).get("agreement_amount_suggested")
    if not isinstance(suggested_agreement, (int, float)):
        suggested_agreement = round(claim_amount * min(max(risk / 100, 0.0), 1.0), 2)

    drivers = []
    if ifp >= 60:
        drivers.append("A cobertura documental fortalece a tese de defesa.")
    else:
        drivers.append("A cobertura documental ainda e insuficiente para uma defesa segura.")
    if missing:
        drivers.append("Evidencias ausentes: " + ", ".join(missing[:3]) + ".")
    if extracted_data.get("fonte_extracao"):
        drivers.append(f"Fonte dos fatos: {extracted_data['fonte_extracao']}.")

    return {
        "evidence": evidence,
        "ifp": ifp,
        "ifp_raw": round(raw_ifp, 2),
        "penalties": round(penalties, 2),
        "document_completeness": completeness,
        "legal_risk": risk,
        "expected_defense_cost_brl": round(claim_amount * risk / 100, 2),
        "expected_agreement_cost_brl": round(float(suggested_agreement), 2),
        "financial_priority": "alta" if risk >= 60 or ifp < 45 else "media" if risk >= 35 else "baixa",
        "human_review_recommended": ifp < 45 or bool(missing),
        "drivers": drivers,
    }
