from __future__ import annotations

import json
import os
import re
from typing import Any

from .document_service import classify_document
from ..models import SUBSIDY_DEFINITIONS

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - depende de ambiente externo
    OpenAI = None  # type: ignore[assignment]


CASE_NUMBER_PATTERN = re.compile(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b")
MONEY_PATTERN = re.compile(
    r"(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2}))",
    re.IGNORECASE,
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
        "fonte_extracao",
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
    digits_only = re.sub(r"[^0-9,\.]", "", value)
    normalized = digits_only.replace(".", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return 0.0


def _search_money(label: str, text: str, *, allow_global_fallback: bool = False) -> float:
    pattern = re.compile(fr"{label}[^0-9R$]{{0,20}}(R\$\s?\d[\d\.,]*)", re.IGNORECASE)
    match = pattern.search(text)
    if match:
        return parse_money(match.group(1))
    if not allow_global_fallback:
        return 0.0
    fallback = MONEY_PATTERN.search(text)
    return parse_money(fallback.group(1)) if fallback else 0.0


def _search_named_party(labels: list[str], text: str) -> str:
    for label in labels:
        pattern = re.compile(fr"{label}\s*[:\-]\s*(.+)", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            return match.group(1).splitlines()[0].strip(" .;:")
    return "Nao identificado"


def _infer_gender(text: str, plaintiff_name: str) -> str:
    lowered = text.lower()
    if "autora" in lowered or "requerente" in lowered and plaintiff_name.endswith("a"):
        return "feminino"
    if "autor" in lowered or "requerente" in lowered:
        return "masculino"
    if any(title in lowered for title in ["sra.", "senhora", "dona "]):
        return "feminino"
    if any(title in lowered for title in ["sr.", "senhor "]):
        return "masculino"
    return "nao identificado"


def heuristic_extract(case_name: str, combined_text: str) -> dict[str, Any]:
    normalized_text = re.sub(r"\s+", " ", combined_text)
    case_number_match = CASE_NUMBER_PATTERN.search(normalized_text)
    plaintiff_name = _search_named_party(
        ["autor", "autora", "requerente", "parte autora"],
        combined_text,
    )
    defendant_name = _search_named_party(
        ["reu", "re", "requerido", "banco", "parte re"],
        combined_text,
    )

    subject = "nao reconhecimento de emprestimo"
    lowered = normalized_text.lower()
    if "cartao" in lowered:
        subject = "contestacao de cartao"
    elif "emprestimo" in lowered or "consignado" in lowered:
        subject = "nao reconhecimento de emprestimo"

    macro_result = "em analise"
    if "procedente" in lowered:
        macro_result = "procedente"
    elif "improcedente" in lowered:
        macro_result = "improcedente"
    elif "acordo" in lowered:
        macro_result = "acordo"

    micro_result = "documentos recebidos aguardando classificacao"
    if "dano moral" in lowered:
        micro_result = "pedido com alegacao de dano moral"
    elif "desconto indevido" in lowered:
        micro_result = "alegacao de desconto indevido"

    claim_amount = _search_money("valor da causa", normalized_text, allow_global_fallback=True)
    award_amount = _search_money("condena", normalized_text)

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
        "fonte_extracao": "heuristica_local",
    }


class StructuredExtractionService:
    def __init__(self) -> None:
        self._api_key = os.getenv("OPENAI_API_KEY")
        self._model = os.getenv("OPENAI_MODEL", "gpt-5")

    def extract(self, case_name: str, combined_text: str) -> tuple[dict[str, Any], list[str]]:
        notes: list[str] = []
        heuristic = heuristic_extract(case_name, combined_text)

        if not combined_text.strip():
            notes.append("Nenhum texto legivel foi encontrado nos arquivos enviados.")
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
            "pedidos, sem inventar valores. Quando nao houver informacao suficiente, devolva "
            "valores neutros coerentes."
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
                                    f"Texto consolidado:\n{combined_text[:120000]}"
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
        if not self._api_key or OpenAI is None:
            notes.append(
                "OPENAI_API_KEY ausente ou SDK indisponivel. Classificacao local aplicada aos documentos."
            )
            return fallback, notes

        document_text = "\n\n".join(
            f"DOCUMENTO {index}: {filename}\n{ text[:30000]}"
            for index, (filename, text) in enumerate(documents)
        )
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
                    {"role": "user", "content": document_text[:120000]},
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
            result = json.loads(response.output_text).get("documents", [])
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
