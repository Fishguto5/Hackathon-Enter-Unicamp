from __future__ import annotations

from http import HTTPStatus
from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "src" / ".env")

from flask import Flask, jsonify, request, send_file

from .models import DocumentRecord
from .repository import InMemoryProcessRepository
from .services.document_service import classify_document, extract_text_from_bytes
from .services.export_service import build_json_export, build_xlsx_export
from .services.extraction_service import StructuredExtractionService
from .services.preprocessing_service import build_feature_vector


app = Flask(__name__)
repository = InMemoryProcessRepository()
extraction_service = StructuredExtractionService()


def build_recommendation_summary(
    extracted_data: dict[str, object],
    subsidies: dict[str, int],
) -> str:
    macro_result = str(extracted_data.get("resultado_macro") or "").strip().lower()
    micro_result = str(extracted_data.get("resultado_micro") or "").strip()
    active_subsidies = [
        key.replace("_", " ")
        for key, value in subsidies.items()
        if value == 1
    ]

    if macro_result == "procedente":
        return (
            "Recomendacao gerada: avaliar acordo ou defesa mitigada, porque o material "
            f"extraido aponta tendencia procedente. Evidencia principal: {micro_result or 'nao identificado'}."
        )
    if macro_result == "improcedente":
        return (
            "Recomendacao gerada: priorizar defesa, porque a leitura dos autos sugere "
            f"tese improcedente. Evidencia principal: {micro_result or 'nao identificado'}."
        )
    if macro_result == "acordo":
        return (
            "Recomendacao gerada: abrir trilha de negociacao, porque os documentos indicam "
            f"espaco para solucao consensual. Contexto central: {micro_result or 'nao identificado'}."
        )

    if active_subsidies:
        return (
            "Recomendacao gerada: revisar a estrategia com base nos subsidios encontrados, "
            f"especialmente {', '.join(active_subsidies[:3])}."
        )

    return (
        "Recomendacao gerada: analise automatica concluida, mas a definicao final ainda "
        "depende de revisao juridica do advogado."
    )


def build_decision_reasons(
    extracted_data: dict[str, object],
    subsidies: dict[str, int],
    document_count: int,
) -> list[str]:
    reasons: list[str] = []
    process_number = str(extracted_data.get("numero_processo") or "nao identificado")
    subject = str(extracted_data.get("assunto") or "nao identificado")
    macro_result = str(extracted_data.get("resultado_macro") or "em analise")
    micro_result = str(extracted_data.get("resultado_micro") or "nao identificado")
    claim_amount = extracted_data.get("valor_causa")
    active_subsidies = [
        key.replace("_", " ")
        for key, value in subsidies.items()
        if value == 1
    ]
    missing_subsidies = [
        key.replace("_", " ")
        for key, value in subsidies.items()
        if value == 0
    ]

    reasons.append(
        f"O processo {process_number} foi classificado no assunto {subject} com resultado macro {macro_result}."
    )
    reasons.append(
        f"A leitura consolidada dos autos destacou o seguinte ponto central: {micro_result}."
    )
    reasons.append(
        f"Foram analisados {document_count} documentos no pipeline para compor a recomendacao automatica."
    )

    if isinstance(claim_amount, (int, float)) and claim_amount > 0:
        reasons.append(
            f"O valor da causa identificado foi de R$ {claim_amount:,.2f}, o que influencia a calibracao da estrategia."
        )

    if active_subsidies:
        reasons.append(
            "Os subsidios detectados e usados como sustentacao da analise foram: "
            f"{', '.join(active_subsidies[:4])}."
        )

    if missing_subsidies:
        reasons.append(
            "Ainda nao foram localizados todos os subsidios esperados; faltam: "
            f"{', '.join(missing_subsidies[:3])}."
        )

    return reasons


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/api/health", methods=["GET"])
def healthcheck():
    return jsonify({"status": "ok"})


@app.route("/api/processes", methods=["OPTIONS"])
@app.route("/api/processes/<process_id>", methods=["OPTIONS"])
@app.route("/api/processes/<process_id>/documents", methods=["OPTIONS"])
@app.route("/api/processes/<process_id>/analyze", methods=["OPTIONS"])
@app.route("/api/processes/<process_id>/finalize", methods=["OPTIONS"])
@app.route("/api/processes/<process_id>/export", methods=["OPTIONS"])
def options_handler(process_id: str | None = None):
    return ("", HTTPStatus.NO_CONTENT)


@app.route("/api/processes", methods=["GET"])
def list_processes():
    return jsonify([process.to_dict() for process in repository.list()])


@app.route("/api/processes", methods=["POST"])
def create_process():
    payload = request.get_json(silent=True) or {}
    process_name = str(payload.get("name") or "").strip()
    if not process_name:
        return jsonify({"error": "Informe um nome para o processo."}), HTTPStatus.BAD_REQUEST

    process = repository.create(process_name)
    return jsonify(process.to_dict()), HTTPStatus.CREATED


@app.route("/api/processes/<process_id>", methods=["GET"])
def get_process(process_id: str):
    process = repository.get(process_id)
    if not process:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND
    return jsonify(process.to_dict())


@app.route("/api/processes/<process_id>/documents", methods=["POST"])
def upload_documents(process_id: str):
    process = repository.get(process_id)
    if not process:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND

    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "Envie ao menos um arquivo PDF."}), HTTPStatus.BAD_REQUEST

    batch_notes: list[str] = []
    for file_storage in files:
        file_bytes = file_storage.read()
        extracted_text, notes = extract_text_from_bytes(file_bytes, file_storage.filename or "documento")
        document_type, subsidy_hits = classify_document(
            file_storage.filename or "", extracted_text
        )
        document = DocumentRecord.create(
            filename=file_storage.filename or "documento.pdf",
            content_type=file_storage.mimetype or "application/pdf",
            size_bytes=len(file_bytes),
            extracted_text=extracted_text,
            subsidy_hits=subsidy_hits,
            classification=document_type,
        )
        process.documents.append(document)
        batch_notes.extend(notes)

        for subsidy_key, hit in subsidy_hits.items():
            process.subsidies[subsidy_key] = max(process.subsidies.get(subsidy_key, 0), hit)

    process.extracted_data = None
    process.feature_vector = None
    process.preprocessing_summary = None
    process.recommendation_summary = None
    process.decision_reasons = []
    process.final_response = None
    process.analysis_state = "nao_iniciada"
    process.processing_notes.extend(batch_notes)
    process.touch(status="documentos_recebidos")
    repository.save(process)
    return jsonify(process.to_dict()), HTTPStatus.CREATED


@app.route("/api/processes/<process_id>/analyze", methods=["POST"])
def analyze_process(process_id: str):
    process = repository.get(process_id)
    if not process:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND
    if not process.documents:
        return jsonify({"error": "Anexe documentos antes de processar."}), HTTPStatus.BAD_REQUEST

    classified_documents, classification_notes = extraction_service.classify_documents(
        [(document.filename, document.extracted_text) for document in process.documents]
    )
    process.subsidies = {key: 0 for key in process.subsidies}
    document_sections = []
    for document, classification in zip(process.documents, classified_documents):
        document.classification = classification["document_type"]
        document.subsidy_hits = classification["subsidy_hits"]
        for subsidy_key, hit in document.subsidy_hits.items():
            process.subsidies[subsidy_key] = max(process.subsidies.get(subsidy_key, 0), hit)
        document_sections.append(
            f"Arquivo: {document.filename}\n"
            f"Tipo classificado: {document.classification}\n{document.extracted_text}"
        )
    combined_text = "\n\n".join(document_sections)
    extracted_data, extraction_notes = extraction_service.extract(process.name, combined_text)
    feature_vector, preprocessing_summary = build_feature_vector(
        extracted_data,
        process.subsidies,
        document_count=len(process.documents),
        combined_text=combined_text,
    )

    process.extracted_data = extracted_data
    process.feature_vector = feature_vector
    process.preprocessing_summary = preprocessing_summary
    process.recommendation_summary = build_recommendation_summary(
        extracted_data,
        process.subsidies,
    )
    process.decision_reasons = build_decision_reasons(
        extracted_data,
        process.subsidies,
        len(process.documents),
    )
    process.final_response = None
    process.analysis_state = "recomendacao_gerada"
    process.processing_notes.extend(classification_notes)
    process.processing_notes.extend(extraction_notes)
    process.touch(status="processado")
    repository.save(process)
    return jsonify(process.to_dict())


@app.route("/api/processes/<process_id>/finalize", methods=["POST"])
def finalize_process(process_id: str):
    process = repository.get(process_id)
    if not process:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND
    if not process.feature_vector:
        return jsonify({"error": "Execute a analise antes de registrar a resposta definitiva."}), HTTPStatus.BAD_REQUEST

    payload = request.get_json(silent=True) or {}
    final_response = str(payload.get("final_response") or "").strip()
    process.final_response = (
        final_response
        or process.final_response
        or process.recommendation_summary
        or "Resposta definitiva registrada pelo advogado."
    )
    process.analysis_state = "resposta_definitiva"
    process.processing_notes.append("Resposta definitiva do advogado registrada na plataforma.")
    process.touch(status="processado")
    repository.save(process)
    return jsonify(process.to_dict())


@app.route("/api/processes/<process_id>/export", methods=["GET"])
def export_process(process_id: str):
    process = repository.get(process_id)
    if not process:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND
    if not process.feature_vector:
        return jsonify({"error": "Execute o pipeline antes de exportar."}), HTTPStatus.BAD_REQUEST

    export_format = (request.args.get("format") or "json").lower()
    payload = process.to_dict()

    if export_format == "xlsx":
        file_bytes = build_xlsx_export(payload)
        return send_file(
            BytesIO(file_bytes),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"{process.name}-features.xlsx",
        )

    file_bytes = build_json_export(payload)
    return send_file(
        BytesIO(file_bytes),
        mimetype="application/json",
        as_attachment=True,
        download_name=f"{process.name}-features.json",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
