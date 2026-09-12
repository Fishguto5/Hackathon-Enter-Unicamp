from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


SUBSIDY_DEFINITIONS = {
    "contrato": {
        "label": "Contrato",
        "keywords": ["contrato", "cedula de credito", "emprestimo consignado"],
    },
    "extrato": {
        "label": "Extrato",
        "keywords": ["extrato", "movimentacao", "lancamentos", "debito em conta"],
    },
    "comprovante_credito": {
        "label": "Comprovante de credito",
        "keywords": ["comprovante de credito", "credito liberado", "bacen", "ted"],
    },
    "dossie": {
        "label": "Dossie",
        "keywords": ["dossie", "biometria", "assinatura", "autenticidade"],
    },
    "evolucao_divida": {
        "label": "Demonstrativo de evolucao da divida",
        "keywords": ["evolucao da divida", "saldo devedor", "parcelas", "demonstrativo"],
    },
    "laudo_referenciado": {
        "label": "Laudo referenciado",
        "keywords": ["laudo referenciado", "sintese da operacao", "canal de contratacao"],
    },
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class DocumentRecord:
    id: str
    filename: str
    content_type: str
    size_bytes: int
    uploaded_at: str
    extracted_text: str
    subsidy_hits: dict[str, int]
    classification: str = "nao identificado"

    @classmethod
    def create(
        cls,
        *,
        filename: str,
        content_type: str,
        size_bytes: int,
        extracted_text: str,
        subsidy_hits: dict[str, int],
        classification: str = "nao identificado",
    ) -> "DocumentRecord":
        return cls(
            id=str(uuid4()),
            filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            uploaded_at=utc_now_iso(),
            extracted_text=extracted_text,
            subsidy_hits=subsidy_hits,
            classification=classification,
        )

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["text_preview"] = self.extracted_text[:400]
        payload.pop("extracted_text", None)
        return payload


@dataclass(slots=True)
class ProcessRecord:
    id: str
    name: str
    status: str
    analysis_state: str
    created_at: str
    updated_at: str
    documents: list[DocumentRecord] = field(default_factory=list)
    extracted_data: dict[str, Any] | None = None
    subsidies: dict[str, int] = field(default_factory=dict)
    feature_vector: dict[str, Any] | None = None
    preprocessing_summary: dict[str, Any] | None = None
    processing_notes: list[str] = field(default_factory=list)
    recommendation_summary: str | None = None
    decision_reasons: list[str] = field(default_factory=list)
    final_response: str | None = None

    @classmethod
    def create(cls, name: str) -> "ProcessRecord":
        return cls(
            id=str(uuid4()),
            name=name,
            status="criado",
            analysis_state="nao_iniciada",
            created_at=utc_now_iso(),
            updated_at=utc_now_iso(),
            subsidies={key: 0 for key in SUBSIDY_DEFINITIONS},
        )

    def touch(self, status: str | None = None) -> None:
        if status:
            self.status = status
        self.updated_at = utc_now_iso()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "analysis_state": self.analysis_state,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "documents": [document.to_dict() for document in self.documents],
            "document_count": len(self.documents),
            "extracted_data": self.extracted_data,
            "subsidies": self.subsidies,
            "feature_vector": self.feature_vector,
            "preprocessing_summary": self.preprocessing_summary,
            "processing_notes": self.processing_notes,
            "recommendation_summary": self.recommendation_summary,
            "decision_reasons": self.decision_reasons,
            "final_response": self.final_response,
        }
