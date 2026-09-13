from __future__ import annotations

import io
import json
from typing import Any

from openpyxl import Workbook

from ..models import SUBSIDY_DEFINITIONS


def build_json_export(process_payload: dict[str, Any]) -> bytes:
    return json.dumps(process_payload, ensure_ascii=False, indent=2).encode("utf-8")


def build_xlsx_export(process_payload: dict[str, Any]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "tabela_subsidios"
    headers = [
        "Número do processos",
        "Contrato",
        "Extrato",
        "Comprovante de crédito",
        "Dossiê",
        "Demonstrativo de evolução da dívida",
        "Laudo referenciado",
    ]
    sheet.append(headers)

    extracted_data = process_payload.get("extracted_data") or {}
    subsidies = process_payload.get("subsidies") or {}
    sheet.append(
        [
            extracted_data.get("numero_processo", process_payload.get("name", "")),
            int(subsidies.get("contrato", 0)),
            int(subsidies.get("extrato", 0)),
            int(subsidies.get("comprovante_credito", 0)),
            int(subsidies.get("dossie", 0)),
            int(subsidies.get("evolucao_divida", 0)),
            int(subsidies.get("laudo_referenciado", 0)),
        ]
    )
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer.read()
