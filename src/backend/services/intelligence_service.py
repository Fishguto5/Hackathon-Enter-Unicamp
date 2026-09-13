from __future__ import annotations

from typing import Any


EVIDENCE_WEIGHTS = {
    "contrato": 20,
    "extrato": 20,
    "comprovante_credito": 15,
    "dossie": 15,
    "evolucao_divida": 10,
    "laudo_referenciado": 5,
}


def build_case_intelligence(
    extracted_data: dict[str, Any],
    subsidies: dict[str, int],
    model_prediction: dict[str, Any] | None,
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