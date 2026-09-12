from __future__ import annotations

import io
import re
from typing import Iterable

from pypdf import PdfReader

from ..models import SUBSIDY_DEFINITIONS


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    if filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = [(page.extract_text() or "").strip() for page in reader.pages]
            text = "\n".join(chunk for chunk in pages_text if chunk)
            if text:
                return text, notes
            notes.append(
                "PDF sem texto embutido detectado. Para OCR real, conecte um provedor de visao/OCR."
            )
        except Exception as exc:  # pragma: no cover - caminho defensivo
            notes.append(f"Falha ao ler PDF '{filename}': {exc}")

    try:
        decoded_text = file_bytes.decode("utf-8")
        return decoded_text, notes
    except UnicodeDecodeError:
        notes.append(
            f"Arquivo '{filename}' nao possui texto legivel diretamente; extraido como vazio."
        )
        return "", notes


def detect_subsidies(filename: str, text: str) -> dict[str, int]:
    haystack = _normalize_text(f"{filename} {text}")
    matches: dict[str, int] = {}

    for subsidy_key, subsidy_definition in SUBSIDY_DEFINITIONS.items():
        keywords: Iterable[str] = subsidy_definition["keywords"]
        matches[subsidy_key] = int(any(keyword in haystack for keyword in keywords))

    return matches


def classify_document(filename: str, text: str) -> tuple[str, dict[str, int]]:
    """Classify a document locally when the structured API is unavailable."""
    haystack = _normalize_text(f"{filename} {text}")
    scores = {
        key: sum(keyword in haystack for keyword in definition["keywords"])
        for key, definition in SUBSIDY_DEFINITIONS.items()
    }
    best_key = max(scores, key=scores.get)
    if scores[best_key] == 0:
        return "nao identificado", {key: 0 for key in SUBSIDY_DEFINITIONS}
    return best_key, {key: int(key == best_key) for key in SUBSIDY_DEFINITIONS}
