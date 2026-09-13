from __future__ import annotations

import json
import os
import re
from typing import Any, Callable
import unicodedata

from .document_service import classify_document
from .prompt_injection_adapter import EnterOSPromptInjectionAdapter
from .schema_validation import validate_payload_against_schema
from ..security.prompt_injection_sanitizer import SanitizationDecision
from ..models import SUBSIDY_DEFINITIONS

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - depende de ambiente externo
    OpenAI = None  # type: ignore[assignment]


CASE_NUMBER_PATTERN = re.compile(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b")
MONEY_VALUE_PATTERN = r"(?:R\$\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:,\d{2})?)"
VERIFIED_FACT_FIELDS = (
    "nome_autor",
    "nome_reu",
    "valor_causa",
    "numero_processo",
    "genero",
    "numero_contrato",
    "cpf",
    "beneficio_inss",
    "uf_residencia",
    "conta_creditada",
    "data_contratacao",
    "data_liberacao_credito",
    "canal_contratacao",
    "valor_liberado",
    "valor_parcela",
    "quantidade_parcelas",
    "valor_total_pactuado",
    "saldo_devedor",
    "parcelas_liquidadas",
    "valor_pedido_danos_morais",
    "alegacao_fraude",
    "negacao_contratacao",
    "alegacao_conta_nao_pertencente",
    "pedido_restituicao",
    "pedido_danos_morais",
)


EXTRACTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "nome_autor",
        "nome_reu",
        "valor_causa",
        "assunto",
        "resultado_macro",
        "resultado_micro",
        "valor_condenacao",
        "numero_processo",
        "genero",
        "resumo_analitico",
    ],
    "properties": {
        "nome_autor": {"type": "string"},
        "nome_reu": {"type": "string"},
        "valor_causa": {"type": "number"},
        "assunto": {"type": "string"},
        "resultado_macro": {"type": "string"},
        "resultado_micro": {"type": "string"},
        "valor_condenacao": {"type": "number"},
        "numero_processo": {"type": "string"},
        "genero": {"type": "string"},
        "resumo_analitico": {"type": "string"},
        "numero_contrato": {"type": "string"},
        "cpf": {"type": "string"},
        "beneficio_inss": {"type": "string"},
        "uf_residencia": {"type": "string"},
        "conta_creditada": {"type": "string"},
        "data_contratacao": {"type": "string"},
        "data_liberacao_credito": {"type": "string"},
        "canal_contratacao": {"type": "string"},
        "valor_liberado": {"type": "number"},
        "valor_parcela": {"type": "number"},
        "quantidade_parcelas": {"type": "number"},
        "valor_total_pactuado": {"type": "number"},
        "saldo_devedor": {"type": "number"},
        "parcelas_liquidadas": {"type": "number"},
        "valor_pedido_danos_morais": {"type": "number"},
        "alegacao_fraude": {"type": "string"},
        "negacao_contratacao": {"type": "string"},
        "alegacao_conta_nao_pertencente": {"type": "string"},
        "pedido_restituicao": {"type": "string"},
        "pedido_danos_morais": {"type": "string"},
        "fonte_extracao": {"type": "string"},
    },
}

DOCUMENT_CLASSIFICATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["documents"],
    "properties": {
        "documents": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["document_index", "document_type", "present", "confidence"],
                "properties": {
                    "document_index": {"type": "integer"},
                    "document_type": {
                        "type": "string",
                        "enum": [*SUBSIDY_DEFINITIONS.keys(), "nao_identificado"],
                    },
                    "present": {"type": "boolean"},
                    "confidence": {"type": "number"},
                },
            },
        }
    },
}


def parse_money(value: str | None) -> float:
    if not value:
        return 0.0
    normalized = re.sub(r"[^0-9,\.]", "", value)
    if not normalized:
        return 0.0

    if "," in normalized and "." in normalized:
        if normalized.rfind(",") > normalized.rfind("."):
            normalized = normalized.replace(".", "").replace(",", ".")
        else:
            normalized = normalized.replace(",", "")
    elif "," in normalized:
        normalized = normalized.replace(".", "").replace(",", ".")
    elif normalized.count(".") > 1:
        normalized = normalized.replace(".", "")
    elif normalized.count(".") == 1:
        integer, decimal = normalized.split(".")
        if len(decimal) != 2:
            normalized = integer + decimal
    try:
        return float(normalized)
    except ValueError:
        return 0.0


def _normalize_for_lookup(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(
        " "
        if unicodedata.category(character).startswith("C")
        else character
        for character in normalized
        if not unicodedata.combining(character)
    )
    normalized = re.sub(r"[-_/]", " ", normalized)
    normalized = re.sub(r"[^\w\s.,$]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip().lower()


def _search_money(labels: tuple[str, ...], text: str) -> float:
    """Return only a value that is attached to an explicit legal amount label."""
    for label in labels:
        pattern = re.compile(
            rf"\b{label}\b[^0-9]{{0,80}}{MONEY_VALUE_PATTERN}",
            re.IGNORECASE,
        )
        match = pattern.search(text)
        if match:
            return parse_money(match.group(1))
    return 0.0


def _infer_macro_result(text: str) -> str:
    labelled_result = re.search(
        r"\bresultado(?:\s+macro)?\s*[:\-]\s*"
        r"(improcedente|procedente|acordo|em analise)",
        text,
        re.IGNORECASE,
    )
    if labelled_result:
        return labelled_result.group(1).lower()

    if re.search(r"\bjulgad[oa]s?\s+improcedente\w*\b", text, re.IGNORECASE):
        return "improcedente"
    if re.search(r"\bjulgad[oa]s?\s+procedente\w*\b", text, re.IGNORECASE):
        return "procedente"
    if re.search(
        r"\bacordo\s+(?:foi\s+)?(?:homologado|celebrado|firmado)\b"
        r"|\bhomolog\w*\b.{0,40}\bacordo\b",
        text,
        re.IGNORECASE,
    ):
        return "acordo"
    return "em analise"


def _document_lines(text: str) -> list[str]:
    return [
        re.sub(r"\s+", " ", line).strip(" .;:\t")
        for line in text.splitlines()
        if line.strip()
    ]


def _find_labeled_value(
    lines: list[str],
    labels: tuple[str, ...],
    validator: Callable[[str], bool] | None = None,
) -> str:
    """Read a value from a table-style label/value pair without guessing by position."""
    normalized_labels = tuple(_normalize_for_lookup(label) for label in labels)
    for index, line in enumerate(lines):
        normalized_line = _normalize_for_lookup(line)
        for label in normalized_labels:
            if normalized_line == label:
                candidates = lines[index + 1 : index + 4]
            elif normalized_line.startswith(f"{label} "):
                separator_match = re.search(r"[:\-]\s*(.+)$", line)
                candidates = (
                    [separator_match.group(1)] if separator_match else lines[index + 1 : index + 4]
                )
            else:
                continue

            for candidate in candidates:
                value = candidate.strip(" .;:\t")
                if value and (validator is None or validator(value)):
                    return value
    return ""


def _extract_identifier(value: str) -> str:
    match = re.search(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d[\d.\-/]{5,}\d\b", value)
    return match.group(0) if match else ""


def _extract_number(value: str) -> float:
    match = re.search(r"\b\d{1,3}\b", value)
    return float(match.group(0)) if match else 0.0


def _looks_like_name(value: str) -> bool:
    normalized = _normalize_for_lookup(value)
    if len(normalized) < 5 or any(token in normalized for token in ("cpf", "contrato", "banco", "autor", "reu")):
        return False
    return bool(re.fullmatch(r"[a-z ]+", normalized)) and len(normalized.split()) >= 2


def _clean_party_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" ;:,-")


def _extract_plaintiff_name(lines: list[str], text: str) -> str:
    table_value = _find_labeled_value(
        lines,
        ("nome completo", "tomador nome", "nome do tomador"),
        _looks_like_name,
    )
    if table_value:
        return _clean_party_name(table_value)

    petition_match = re.search(
        r"\b([A-ZÀ-Ü][A-ZÀ-Ü\s]{5,})\s*,\s*(?:brasileir[oa]|nacionalidade)",
        text,
    )
    if petition_match:
        return _clean_party_name(petition_match.group(1))
    return "Nao identificado"


def _extract_defendant_name(lines: list[str], text: str) -> str:
    petition_match = re.search(
        r"\bem\s+face\s+de\s+([A-ZÀ-Ü][A-ZÀ-ÜA-Za-z.\s]{3,}?)(?=,\s*(?:pessoa|institu|inscrit)|\n)",
        text,
    )
    if petition_match:
        return _clean_party_name(petition_match.group(1))

    bank_match = re.search(r"\b(BANCO\s+[A-ZÀ-ÜA-Za-z0-9. ]{2,}?S\.A\.)\b", text)
    if bank_match:
        return _clean_party_name(bank_match.group(1))

    table_value = _find_labeled_value(
        lines,
        ("instituicao credora", "instituicao financeira", "reu", "requerido"),
        lambda value: bool(re.search(r"banco|instituicao|s\.a\.", value, re.IGNORECASE)),
    )
    return _clean_party_name(table_value) if table_value else "Nao identificado"


def _find_labeled_identifier(lines: list[str], labels: tuple[str, ...]) -> str:
    value = _find_labeled_value(lines, labels, lambda candidate: bool(_extract_identifier(candidate)))
    return _extract_identifier(value)


def _find_labeled_money(lines: list[str], labels: tuple[str, ...]) -> float:
    value = _find_labeled_value(
        lines,
        labels,
        lambda candidate: parse_money(candidate) > 0,
    )
    return parse_money(value)


def _find_labeled_count(lines: list[str], labels: tuple[str, ...]) -> float:
    value = _find_labeled_value(
        lines,
        labels,
        lambda candidate: _extract_number(candidate) > 0,
    )
    return _extract_number(value)


def _find_labeled_date(lines: list[str], labels: tuple[str, ...]) -> str:
    value = _find_labeled_value(
        lines,
        labels,
        lambda candidate: bool(re.search(r"\b\d{2}/\d{2}/\d{4}\b", candidate)),
    )
    match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", value)
    return match.group(0) if match else "Nao identificado"


def _detect_allegation(pattern: str, text: str) -> str:
    return "sim" if re.search(pattern, text, re.IGNORECASE) else "nao identificado"


def _has_verified_value(value: Any) -> bool:
    if isinstance(value, (int, float)):
        return value > 0
    return isinstance(value, str) and _normalize_for_lookup(value) not in {"", "nao identificado"}


def _prioritize_verified_facts(payload: dict[str, Any], heuristic: dict[str, Any]) -> dict[str, Any]:
    """Keep label-backed document facts when model output is incomplete or inconsistent."""
    for field in VERIFIED_FACT_FIELDS:
        value = heuristic.get(field)
        if _has_verified_value(value):
            payload[field] = value
    return payload


def _infer_gender(text: str, plaintiff_name: str) -> str:
    lowered = text.lower()
    if re.search(r"\ba autora\b", lowered):
        return "feminino"
    if re.search(r"\bo autor\b", lowered):
        return "masculino"
    if any(title in lowered for title in ["sra.", "senhora", "dona "]):
        return "feminino"
    if any(title in lowered for title in ["sr.", "senhor "]):
        return "masculino"
    return "nao identificado"


def heuristic_extract(case_name: str, combined_text: str) -> dict[str, Any]:
    normalized_text = re.sub(r"\s+", " ", combined_text)
    lookup_text = _normalize_for_lookup(combined_text)
    lines = _document_lines(combined_text)
    case_number_match = CASE_NUMBER_PATTERN.search(normalized_text)
    plaintiff_name = _extract_plaintiff_name(lines, combined_text)
    defendant_name = _extract_defendant_name(lines, combined_text)

    subject = "nao reconhecimento de emprestimo"
    lowered = lookup_text
    if "acao declaratoria de inexistencia" in lowered and "debito" in lowered:
        subject = "acao declaratoria de inexistencia de debito c/c indenizacao por danos morais"
    elif "cartao" in lowered:
        subject = "contestacao de cartao"
    elif "emprestimo" in lowered or "consignado" in lowered:
        subject = "nao reconhecimento de emprestimo"

    macro_result = _infer_macro_result(lookup_text)

    micro_result = "documentos recebidos aguardando classificacao"
    if re.search(r"fraude|nao reconhec\w*.*contrat|nao contrat", lookup_text):
        micro_result = "alegacao de fraude e nao reconhecimento da contratacao"
    elif "dano moral" in lowered:
        micro_result = "pedido com alegacao de dano moral"
    elif "desconto indevido" in lowered:
        micro_result = "alegacao de desconto indevido"

    claim_amount = _search_money(
        (
            "valor da causa",
            "da se a causa o valor",
            "da se a causa",
            "valor atribuido a causa",
        ),
        lookup_text,
    )
    award_amount = _search_money(
        (
            "valor da condenacao",
            "valor da indenizacao",
            "condenacao no valor",
            "indenizacao no valor",
        ),
        lookup_text,
    )
    contract_number = _find_labeled_identifier(
        lines,
        ("numero do contrato", "no do contrato", "n do contrato", "numero contrato"),
    )
    if not contract_number:
        contract_match = re.search(r"\bcontrato\s*(?:n[ºo.]?)?\s*[:#-]?\s*(\d{6,})\b", combined_text, re.IGNORECASE)
        contract_number = contract_match.group(1) if contract_match else "Nao identificado"

    account_match = re.search(
        r"\b(?:conta\s*corrente|cc)\s*(?:n[ºo.]?\s*)?[:\-]?\s*(\d{4,}(?:-\d+)?)\b",
        combined_text,
        re.IGNORECASE,
    )
    credit_account = account_match.group(1) if account_match else "Nao identificado"
    value_released = _find_labeled_money(
        lines,
        ("valor da operacao liquido", "valor liberado", "valor financiado", "valor do credito"),
    ) or _search_money(
        ("valor da operacao liquido", "valor liberado", "valor financiado", "valor do credito"),
        lookup_text,
    )
    installment_value = _find_labeled_money(
        lines,
        ("valor da parcela mensal", "valor da parcela", "valor parcela", "parcela mensal"),
    ) or _search_money(
        ("valor da parcela mensal", "valor da parcela", "valor parcela", "parcela mensal"),
        lookup_text,
    )
    installment_count = _find_labeled_count(
        lines,
        ("numero de parcelas", "quantidade de parcelas", "prazo"),
    )
    if not installment_count:
        installment_match = re.search(r"\b(\d{1,3})\s+parcelas?\b", lookup_text)
        installment_count = float(installment_match.group(1)) if installment_match else 0.0
    total_agreed = _find_labeled_money(lines, ("valor total pactuado", "total pactuado"))
    outstanding_balance = _find_labeled_money(lines, ("saldo devedor", "saldo atualizado"))
    paid_installments = _find_labeled_count(lines, ("parcelas liquidadas", "parcelas pagas"))
    if not paid_installments:
        paid_match = re.search(r"\b(\d{1,3})\s+de\s+\d{1,3}\s+parcelas\s+liquidadas\b", lookup_text)
        paid_installments = float(paid_match.group(1)) if paid_match else 0.0
    if not outstanding_balance:
        outstanding_balance = _search_money(("saldo devedor em aberto", "saldo devedor"), lookup_text)
    moral_damages = _search_money(
        (
            "indenizacao por danos morais no valor",
            "danos morais no valor",
            "pedido de danos morais",
        ),
        lookup_text,
    )
    cpf_match = re.search(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", combined_text)
    benefit_number = _find_labeled_identifier(lines, ("beneficio inss", "numero do beneficio", "beneficio"))
    residence_uf = _find_labeled_value(
        lines,
        ("uf de residencia", "uf residencia"),
        lambda candidate: bool(re.fullmatch(r"[A-Z]{2}", candidate.strip(), re.IGNORECASE)),
    )
    hiring_channel = _find_labeled_value(
        lines,
        ("canal de contratacao", "canal contratacao", "canal"),
        lambda candidate: len(candidate) >= 4,
    )

    return {
        "nome_autor": plaintiff_name,
        "nome_reu": defendant_name,
        "valor_causa": claim_amount,
        "assunto": subject,
        "resultado_macro": macro_result,
        "resultado_micro": micro_result,
        "valor_condenacao": award_amount,
        "numero_processo": case_number_match.group(0) if case_number_match else case_name,
        "genero": _infer_gender(normalized_text, plaintiff_name),
        "resumo_analitico": normalized_text[:400] or "Sem texto suficiente para resumir.",
        "numero_contrato": contract_number,
        "cpf": cpf_match.group(0) if cpf_match else "Nao identificado",
        "beneficio_inss": benefit_number or "Nao identificado",
        "uf_residencia": residence_uf.upper() if residence_uf else "Nao identificado",
        "conta_creditada": credit_account,
        "data_contratacao": _find_labeled_date(lines, ("data da contratacao", "data de contratacao")),
        "data_liberacao_credito": _find_labeled_date(
            lines, ("data da liberacao", "data de liberacao", "data do credito", "data de disponibilizacao")
        ),
        "canal_contratacao": hiring_channel or "Nao identificado",
        "valor_liberado": value_released,
        "valor_parcela": installment_value,
        "quantidade_parcelas": installment_count,
        "valor_total_pactuado": total_agreed,
        "saldo_devedor": outstanding_balance,
        "parcelas_liquidadas": paid_installments,
        "valor_pedido_danos_morais": moral_damages,
        "alegacao_fraude": _detect_allegation(r"\bfraud\w*\b|\bgolpe\b", lookup_text),
        "negacao_contratacao": _detect_allegation(
            r"nao reconhec\w*.{0,40}contrat|nega\w*.{0,30}contrat|jamais.{0,40}contrat|nao contrat",
            lookup_text,
        ),
        "alegacao_conta_nao_pertencente": _detect_allegation(
            r"conta.{0,80}(?:nao pertence|nao e de titularidade|nao titular|nao possui)|nao possui conta(?: corrente)?",
            lookup_text,
        ),
        "pedido_restituicao": _detect_allegation(
            r"restitui\w*|repeticao do indebito|devolucao em dobro", lookup_text
        ),
        "pedido_danos_morais": _detect_allegation(r"danos? morais?", lookup_text),
        "fonte_extracao": "heuristica_local",
    }


class StructuredExtractionService:
    def __init__(self) -> None:
        self._api_key = os.getenv("OPENAI_API_KEY")
        self._model = os.getenv("OPENAI_MODEL", "gpt-5")
        self._prompt_safety = EnterOSPromptInjectionAdapter()

    def extract(self, case_name: str, combined_text: str) -> tuple[dict[str, Any], list[str]]:
        notes: list[str] = []

        if not combined_text.strip():
            heuristic = heuristic_extract(case_name, combined_text)
            notes.append("Nenhum texto legivel foi encontrado nos arquivos enviados.")
            return heuristic, notes

        guarded_input = self._prompt_safety.guard_extraction_text(
            case_name=case_name,
            combined_text=combined_text,
        )
        notes.extend(guarded_input.notes)
        heuristic_source_text = guarded_input.local_safe_text or combined_text
        heuristic = heuristic_extract(case_name, heuristic_source_text)
        if guarded_input.decision != SanitizationDecision.ALLOW:
            notes.append(
                "O sanitizer bloqueou o envio automatico do texto documental ao modelo. "
                "A extracao estruturada seguiu com fallback heuristico local."
            )
            return heuristic, notes

        if not self._api_key or OpenAI is None:
            notes.append(
                "OPENAI_API_KEY ausente ou SDK indisponivel. Pipeline executado com extracao heuristica local."
            )
            return heuristic, notes

        prompt = (
            "Voce e um extrator juridico especializado em processos civis brasileiros. "
            "Analise todos os documentos fornecidos, mas use os Autos para identificar numero "
            "do processo, autor, reu e valores do processo. Subsidios servem como evidencia "
            "e nao devem ser confundidos com o nome do processo. Extraia somente os campos "
            "pedidos, sem inventar valores. Inclua, quando constarem de forma expressa, contrato, "
            "CPF, beneficio INSS, conta creditada, datas, canal, valores e parcelas. Quando nao "
            "houver informacao suficiente, devolva valores neutros coerentes."
        )

        try:
            client = OpenAI(api_key=self._api_key)
            response = client.responses.create(
                model=self._model,
                input=[
                    {"role": "system", "content": prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": (
                                    "Analise o processo abaixo e preencha o schema.\n\n"
                                    f"Nome interno do processo: {case_name}\n\n"
                                    f"Texto consolidado:\n{guarded_input.text}"
                                ),
                            }
                        ],
                    },
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "legal_case_extraction",
                        "schema": EXTRACTION_SCHEMA,
                        "strict": True,
                    }
                },
            )
            payload = json.loads(response.output_text)
            validate_payload_against_schema(payload, EXTRACTION_SCHEMA)
            payload = _prioritize_verified_facts(payload, heuristic)
            payload["fonte_extracao"] = f"openai:{self._model}"
            return payload, notes
        except Exception as exc:  # pragma: no cover - depende de API externa
            notes.append(
                f"Falha na extracao estruturada via OpenAI ({exc}). Aplicando fallback heuristico."
            )
            return heuristic, notes

    def classify_documents(
        self, documents: list[tuple[str, str]]
    ) -> tuple[list[dict[str, Any]], list[str]]:
        """Classify every uploaded document and identify which subsidy it contains."""
        notes: list[str] = []
        fallback = []
        for filename, text in documents:
            document_type, subsidy_hits = classify_document(filename, text)
            fallback.append(
                {
                    "document_type": document_type,
                    "present": document_type != "nao identificado",
                    "confidence": 0.0,
                    "subsidy_hits": subsidy_hits,
                }
            )

        if not documents:
            return fallback, notes
        guarded_input = self._prompt_safety.guard_document_classification_batch(documents)
        notes.extend(guarded_input.notes)
        if guarded_input.decision != SanitizationDecision.ALLOW:
            notes.append(
                "O sanitizer bloqueou o envio automatico dos documentos ao modelo. "
                "A classificacao estruturada seguiu com fallback local."
            )
            return fallback, notes
        if not self._api_key or OpenAI is None:
            notes.append(
                "OPENAI_API_KEY ausente ou SDK indisponivel. Classificacao local aplicada aos documentos."
            )
            return fallback, notes

        prompt = (
            "Classifique cada documento pelo conteudo, nao apenas pelo nome do arquivo. "
            "Use exatamente um tipo: contrato, extrato, comprovante_credito, dossie, "
            "evolucao_divida, laudo_referenciado ou nao_identificado. "
            "Um documento so deve ser marcado como presente quando houver evidencia clara. "
            "Retorne um item para cada indice recebido."
        )
        try:
            client = OpenAI(api_key=self._api_key)
            response = client.responses.create(
                model=self._model,
                input=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": guarded_input.text},
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "document_classification",
                        "schema": DOCUMENT_CLASSIFICATION_SCHEMA,
                        "strict": True,
                    }
                },
            )
            payload = json.loads(response.output_text)
            validate_payload_against_schema(payload, DOCUMENT_CLASSIFICATION_SCHEMA)
            result = payload.get("documents", [])
            seen_indexes: set[int] = set()
            for item in result:
                document_index = int(item["document_index"])
                if document_index < 0 or document_index >= len(documents):
                    raise ValueError(
                        f"Indice de documento fora do intervalo esperado: {document_index}."
                    )
                if document_index in seen_indexes:
                    raise ValueError(
                        f"Indice de documento duplicado na resposta estruturada: {document_index}."
                    )
                seen_indexes.add(document_index)
            by_index = {item.get("document_index"): item for item in result}
            classified = []
            for index, fallback_item in enumerate(fallback):
                item = by_index.get(index)
                if not item:
                    classified.append(fallback_item)
                    continue
                document_type = item["document_type"]
                classified.append(
                    {
                        "document_type": document_type,
                        "present": bool(item["present"]),
                        "confidence": float(item["confidence"]),
                        "subsidy_hits": {
                            key: int(item["present"] and key == document_type)
                            for key in SUBSIDY_DEFINITIONS
                        },
                    }
                )
            return classified, notes
        except Exception as exc:  # pragma: no cover - depende de API externa
            notes.append(
                f"Falha na classificacao estruturada via OpenAI ({exc}). Aplicando fallback local."
            )
            return fallback, notes
