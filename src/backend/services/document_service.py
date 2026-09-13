from __future__ import annotations

import io
import re
from typing import Iterable
import unicodedata

from pypdf import PdfReader

from ..models import SUBSIDY_DEFINITIONS


DOCUMENT_TYPE_SIGNATURES = {
    "comprovante_credito": (
        "comprovante de credito",
        "comprovante de operacao de credito",
        "codigo bacen",
        "circular bacen",
        "data da liberacao do credito",
    ),
    "laudo_referenciado": (
        "laudo referenciado",
        "laudo referenciado da operacao",
        "canal de contratacao e evidencias",
        "sintese da operacao",
    ),
    "evolucao_divida": (
        "demonstrativo de evolucao da divida",
        "saldo devedor em aberto",
        "parcelas liquidadas",
    ),
    "dossie": (
        "peticao inicial",
        "acao declaratoria",
        "autos do processo",
    ),
    "extrato": (
        "extrato bancario",
        "extrato de movimentacao",
        "lancamentos da conta",
    ),
    "contrato": (
        "cedula de credito",
        "contrato de emprestimo",
        "termo de contratacao",
    ),
}


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", normalized.lower()).strip()


def normalize_pdf_extraction_artifacts(text: str) -> str:
    """Remove the DEL glyph that pypdf can emit for non-text PDF layout marks."""
    return text.replace("\x7f", " ")


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    if filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = [(page.extract_text() or "").strip() for page in reader.pages]
            text = normalize_pdf_extraction_artifacts(
                "\n".join(chunk for chunk in pages_text if chunk)
            )
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
    """Classify locally with document signatures before generic keyword fallback."""
    normalized_filename = _normalize_text(filename)
    normalized_text = _normalize_text(text)
    heading = normalized_text[:2000]

    # A document title is stronger evidence than generic words such as "contrato".
    for document_type, signatures in DOCUMENT_TYPE_SIGNATURES.items():
        if any(
            signature in normalized_filename or signature in heading
            for signature in signatures
        ):
            return document_type, {
                key: int(key == document_type) for key in SUBSIDY_DEFINITIONS
            }

    haystack = f"{normalized_filename} {normalized_text}"
    scores = {
        key: sum(keyword in haystack for keyword in definition["keywords"])
        for key, definition in SUBSIDY_DEFINITIONS.items()
    }
    best_key = max(scores, key=scores.get)
    if scores[best_key] == 0:
        return "nao identificado", {key: 0 for key in SUBSIDY_DEFINITIONS}
    return best_key, {key: int(key == best_key) for key in SUBSIDY_DEFINITIONS}
