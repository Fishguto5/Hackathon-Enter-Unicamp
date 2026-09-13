from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

from ..models import SUBSIDY_DEFINITIONS


SUBJECT_BUCKETS = [
    "nao reconhecimento de emprestimo",
    "contestacao de cartao",
    "outro",
]
MACRO_BUCKETS = ["procedente", "improcedente", "acordo", "em analise", "outro"]
GENDER_BUCKETS = ["feminino", "masculino", "nao identificado"]


def sanitize_label(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "_", ascii_value.lower()).strip("_") or "outro"


def bucketize(value: str, allowed: list[str]) -> str:
    sanitized = sanitize_label(value)
    for item in allowed:
        if sanitized == sanitize_label(item):
            return sanitize_label(item)
    return "outro"


def build_feature_vector(
    extracted_data: dict[str, Any],
    subsidies: dict[str, int],
    *,
    document_count: int,
    combined_text: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    claim_amount = float(extracted_data.get("valor_causa") or 0.0)
    award_amount = float(extracted_data.get("valor_condenacao") or 0.0)
    subject_bucket = bucketize(str(extracted_data.get("assunto") or "outro"), SUBJECT_BUCKETS)
    macro_bucket = bucketize(str(extracted_data.get("resultado_macro") or "outro"), MACRO_BUCKETS)
    gender_bucket = bucketize(str(extracted_data.get("genero") or "nao identificado"), GENDER_BUCKETS)
    subsidy_score = sum(subsidies.values()) / max(len(SUBSIDY_DEFINITIONS), 1)

    feature_vector: dict[str, Any] = {
        "numero_processo": extracted_data.get("numero_processo", ""),
        "claim_amount_brl": round(claim_amount, 2),
        "claim_amount_log": round(math.log1p(max(claim_amount, 0.0)), 6),
        "award_amount_brl": round(award_amount, 2),
        "award_amount_log": round(math.log1p(max(award_amount, 0.0)), 6),
        "document_count": document_count,
        "text_length_chars": len(combined_text),
        "subsidy_coverage_ratio": round(subsidy_score, 4),
        "subject_bucket": subject_bucket,
        "macro_result_bucket": macro_bucket,
        "gender_bucket": gender_bucket,
    }

    for subsidy_key in SUBSIDY_DEFINITIONS:
        feature_vector[f"has_{subsidy_key}"] = int(subsidies.get(subsidy_key, 0))

    for bucket in SUBJECT_BUCKETS:
        feature_vector[f"subject__{sanitize_label(bucket)}"] = int(
            subject_bucket == sanitize_label(bucket)
        )
    feature_vector["subject__outro"] = int(subject_bucket == "outro")

    for bucket in MACRO_BUCKETS:
        feature_vector[f"macro__{sanitize_label(bucket)}"] = int(
            macro_bucket == sanitize_label(bucket)
        )
    feature_vector["macro__outro"] = int(macro_bucket == "outro")

    for bucket in GENDER_BUCKETS:
        feature_vector[f"gender__{sanitize_label(bucket)}"] = int(
            gender_bucket == sanitize_label(bucket)
        )

    preprocessing_summary = {
        "numeric_fields": [
            "claim_amount_brl",
            "claim_amount_log",
            "award_amount_brl",
            "award_amount_log",
            "document_count",
            "text_length_chars",
            "subsidy_coverage_ratio",
        ],
        "categorical_fields_encoded": [
            "subject_bucket",
            "macro_result_bucket",
            "gender_bucket",
        ],
        "binary_subsidies": [f"has_{subsidy}" for subsidy in SUBSIDY_DEFINITIONS],
        "missing_safe_defaults": {
            "strings": "Nao identificado/outro",
            "numbers": 0,
            "binary_flags": 0,
        },
    }

    return feature_vector, preprocessing_summary
