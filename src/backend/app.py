from __future__ import annotations

from http import HTTPStatus
from io import BytesIO
from pathlib import Path
import sys

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "src" / ".env")

from flask import Flask, jsonify, request, send_file

try:
    from .models import DocumentRecord, LawyerConfirmationRecord
    from .repository import InMemoryProcessRepository
    from .services.decision_service import DecisionModelService
    from .services.document_service import classify_document, extract_text_from_bytes
    from .services.export_service import build_json_export, build_xlsx_export
    from .services.extraction_service import StructuredExtractionService
    from .services.preprocessing_service import build_feature_vector
    from .services.intelligence_service import build_case_intelligence
except ImportError:  # pragma: no cover - permite executar como script
    from src.backend.models import DocumentRecord, LawyerConfirmationRecord
    from src.backend.repository import InMemoryProcessRepository
    from src.backend.services.decision_service import DecisionModelService
    from src.backend.services.document_service import classify_document, extract_text_from_bytes
    from src.backend.services.export_service import build_json_export, build_xlsx_export
    from src.backend.services.extraction_service import StructuredExtractionService
    from src.backend.services.preprocessing_service import build_feature_vector
    from src.backend.services.intelligence_service import build_case_intelligence


app = Flask(__name__)
repository = InMemoryProcessRepository()
extraction_service = StructuredExtractionService()
decision_service = DecisionModelService()


def build_recommendation_summary(
    model_prediction: dict[str, object] | None,
    extracted_data: dict[str, object],
    subsidies: dict[str, int],
) -> str:
    if model_prediction:
        strategy = str(model_prediction.get("strategy") or "").strip().lower()
        success_probability = float(model_prediction.get("probability_success") or 0.0) * 100
        threshold_success = float(model_prediction.get("threshold_success") or 0.0) * 100
        if strategy == "defesa":
            return (
                "Recomendacao gerada pelo modelo: defesa, porque a chance estimada de exito "
                f"do banco foi de {success_probability:.1f}%, acima do threshold de {threshold_success:.1f}%."
            )

        agreement_amount = model_prediction.get("agreement_amount_suggested")
        agreement_fragment = ""
        if isinstance(agreement_amount, (int, float)):
            agreement_fragment = f" Valor sugerido para abertura de negociacao: R$ {agreement_amount:,.2f}."

        return (
            "Recomendacao gerada pelo modelo: acordo, porque a chance estimada de exito "
            f"do banco foi de {success_probability:.1f}%, abaixo do threshold de {threshold_success:.1f}%."
            f"{agreement_fragment}"
        )

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
    model_prediction: dict[str, object] | None,
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

    if model_prediction:
        strategy = str(model_prediction.get("strategy") or "em revisao").upper()
        success_probability = float(model_prediction.get("probability_success") or 0.0) * 100
        failure_probability = float(model_prediction.get("probability_failure") or 0.0) * 100
        threshold_success = float(model_prediction.get("threshold_success") or 0.0) * 100
        reasons.append(
            f"O modelo de ML estimou {success_probability:.1f}% de chance de exito e {failure_probability:.1f}% de risco de nao exito, com threshold de {threshold_success:.1f}% para recomendar {strategy}."
        )

        agreement_amount = model_prediction.get("agreement_amount_suggested")
        adjusted_score = model_prediction.get("agreement_score_adjusted")
        if isinstance(agreement_amount, (int, float)) and isinstance(adjusted_score, (int, float)):
            reasons.append(
                f"Como o caso caiu em acordo, o score financeiro ajustado ficou em {adjusted_score:.3f}, resultando em valor sugerido de R$ {agreement_amount:,.2f}."
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
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
    return response


@app.route("/api/health", methods=["GET"])
def healthcheck():
    return jsonify({"status": "ok"})


def parse_optional_amount(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return round(parsed, 2)


def format_brl(value: float) -> str:
    formatted = f"{value:,.2f}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def has_rejected_prompt_injection_assessment(process: object) -> bool:
    documents = getattr(process, "documents", [])
    return any(
        isinstance(getattr(document, "security_assessment", None), dict)
        and document.security_assessment.get("decision") == "reject"
        for document in documents
    )


def without_internal_sanitizer_notes(notes: list[str]) -> list[str]:
    """Keep unconfirmed sanitizer signals out of the lawyer-facing activity log."""
    return [
        note
        for note in notes
        if "prompt injection" not in note.lower() and "sanitizer" not in note.lower()
    ]


def apply_prompt_injection_defense(process: object) -> None:
    """Apply the terminal defense when prompt injection is confirmed."""
    rejection_note = (
        "Defesa por prompt injection: tentativa identificada no pipeline. "
        "O acordo foi bloqueado e o conteudo sinalizado nao foi usado na analise juridica."
    )

    process.extracted_data = None
    process.subsidies = {key: 0 for key in process.subsidies}
    process.feature_vector = None
    process.model_prediction = None
    process.lawyer_confirmation = None
    process.preprocessing_summary = None
    process.case_intelligence = None
    process.recommendation_summary = rejection_note
    process.decision_reasons = [
        "Motivo da defesa: o sanitizer confirmou uma tentativa de prompt injection em pelo menos um documento.",
        "Protecao aplicada: o conteudo sinalizado nao foi enviado para extracao estruturada, modelo de ML ou proposta de acordo.",
    ]
    process.final_response = rejection_note
    process.analysis_state = "recusado_prompt_injection"
    if rejection_note not in process.processing_notes:
        process.processing_notes.append(rejection_note)
    process.touch(status="recusado_prompt_injection")


def build_final_decision_summary(
    lawyer_confirmation: LawyerConfirmationRecord | None,
) -> str | None:
    if not lawyer_confirmation:
        return None

    adherence_label = (
        "seguindo a recomendacao do algoritmo"
        if lawyer_confirmation.choice == "seguir_algoritmo"
        else "divergindo da recomendacao do algoritmo"
    )
    acceptance_label = (
        "aceita"
        if lawyer_confirmation.final_acceptance_status == "aceito"
        else "nao aceita"
    )

    if lawyer_confirmation.final_strategy == "acordo":
        if lawyer_confirmation.proposed_agreement_amount is not None:
            return (
                "Decisao final do advogado: acordo, "
                f"{adherence_label}, com decisao {acceptance_label}. "
                f"Valor final do acordo: R$ {format_brl(lawyer_confirmation.proposed_agreement_amount)}."
            )
        return (
            "Decisao final do advogado: acordo, "
            f"{adherence_label}, com decisao {acceptance_label}."
        )

    return (
        "Decisao final do advogado: defesa, "
        f"{adherence_label}, com decisao {acceptance_label}."
    )


def build_lawyer_confirmation_reasons(
    lawyer_confirmation: LawyerConfirmationRecord | None,
) -> list[str]:
    if not lawyer_confirmation:
        return []

    reasons = []
    if lawyer_confirmation.choice == "seguir_algoritmo":
        reasons.append(
            "O advogado confirmou que pretende seguir a estrategia prevista pelo algoritmo."
        )
    else:
        reasons.append(
            f"O advogado optou por nao seguir a predicao original e registrou a estrategia final como {lawyer_confirmation.final_strategy}."
        )

    reasons.append(
        "Na etapa final, a decisao do advogado foi marcada como "
        f"{'aceita' if lawyer_confirmation.final_acceptance_status == 'aceito' else 'nao aceita'}."
    )

    if lawyer_confirmation.final_strategy == "acordo" and lawyer_confirmation.proposed_agreement_amount is not None:
        reasons.append(
            "O valor final informado pelo advogado para o acordo foi de "
            f"R$ {format_brl(lawyer_confirmation.proposed_agreement_amount)}."
        )

    return reasons


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


@app.route("/api/processes/<process_id>", methods=["PATCH"])
def update_process(process_id: str):
    process = repository.get(process_id)
    if not process:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND

    payload = request.get_json(silent=True) or {}
    process_name = str(payload.get("name") or "").strip()
    if not process_name:
        return jsonify({"error": "Informe um nome valido para o processo."}), HTTPStatus.BAD_REQUEST

    process.name = process_name
    process.touch()
    repository.save(process)
    return jsonify(process.to_dict())


@app.route("/api/processes/<process_id>", methods=["DELETE"])
def delete_process(process_id: str):
    deleted = repository.delete(process_id)
    if not deleted:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND
    return jsonify({"deleted_process_id": process_id})


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

    # A new upload invalidates prior pipeline checks; the scan happens only on the next run.
    for document in process.documents:
        document.security_assessment = None
    process.extracted_data = None
    process.feature_vector = None
    process.model_prediction = None
    process.lawyer_confirmation = None
    process.preprocessing_summary = None
    process.case_intelligence = None
    process.recommendation_summary = None
    process.decision_reasons = []
    process.final_response = None
    process.analysis_state = "nao_iniciada"
    process.processing_notes = without_internal_sanitizer_notes(process.processing_notes)
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

    for document in process.documents:
        assessment = extraction_service.inspect_document_safety(
            document.filename,
            document.extracted_text,
        )
        # Only confirmed prompt injection is exposed to the case workflow.
        document.security_assessment = (
            assessment if assessment["decision"] == "reject" else None
        )
    if has_rejected_prompt_injection_assessment(process):
        apply_prompt_injection_defense(process)
        repository.save(process)
        return jsonify(process.to_dict())

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
    model_prediction, decision_notes = decision_service.predict(
        extracted_data,
        process.subsidies,
    )

    process.extracted_data = extracted_data
    process.feature_vector = feature_vector
    process.model_prediction = model_prediction
    process.case_intelligence = build_case_intelligence(
        extracted_data,
        process.subsidies,
        model_prediction,
        process.documents,
    )
    process.lawyer_confirmation = None
    process.preprocessing_summary = preprocessing_summary
    process.recommendation_summary = build_recommendation_summary(
        model_prediction,
        extracted_data,
        process.subsidies,
    )
    process.decision_reasons = build_decision_reasons(
        model_prediction,
        extracted_data,
        process.subsidies,
        len(process.documents),
    )
    process.final_response = None
    process.analysis_state = "recomendacao_gerada"
    process.processing_notes.extend(without_internal_sanitizer_notes(classification_notes))
    process.processing_notes.extend(without_internal_sanitizer_notes(extraction_notes))
    process.processing_notes.extend(decision_notes)
    process.touch(status="processado")
    repository.save(process)
    return jsonify(process.to_dict())


@app.route("/api/processes/<process_id>/finalize", methods=["POST"])
def finalize_process(process_id: str):
    process = repository.get(process_id)
    if not process:
        return jsonify({"error": "Processo nao encontrado."}), HTTPStatus.NOT_FOUND
    if has_rejected_prompt_injection_assessment(process):
        return (
            jsonify(
                {
                    "error": (
                        "O processo recebeu defesa automatica porque a verificacao de prompt injection "
                        "identificou uma tentativa em um documento."
                    )
                }
            ),
            HTTPStatus.CONFLICT,
        )
    if not process.feature_vector:
        return jsonify({"error": "Execute a analise antes de registrar a resposta definitiva."}), HTTPStatus.BAD_REQUEST

    payload = request.get_json(silent=True) or {}
    final_response = str(payload.get("final_response") or "").strip()
    confirmation_choice = str(payload.get("confirmation_choice") or "").strip().lower()
    final_strategy = str(payload.get("final_strategy") or "").strip().lower()
    final_acceptance_status = str(payload.get("final_acceptance_status") or "").strip().lower()
    proposed_agreement_amount = parse_optional_amount(payload.get("proposed_agreement_amount"))
    algorithm_strategy = None
    suggested_agreement_amount = None
    if process.model_prediction:
        algorithm_strategy = str(process.model_prediction.get("strategy") or "").strip().lower() or None
        raw_suggested_amount = process.model_prediction.get("agreement_amount_suggested")
        if isinstance(raw_suggested_amount, (int, float)):
            suggested_agreement_amount = round(float(raw_suggested_amount), 2)

    valid_choices = {"seguir_algoritmo", "seguir_outra_estrategia"}
    valid_strategies = {"defesa", "acordo"}
    valid_acceptance_statuses = {"aceito", "nao_aceito"}

    if confirmation_choice not in valid_choices:
        return (
            jsonify(
                {
                    "error": (
                        "Confirme se o advogado pretende seguir a recomendacao do algoritmo "
                        "ou registrar outra estrategia."
                    )
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    if final_acceptance_status not in valid_acceptance_statuses:
        return (
            jsonify(
                {
                    "error": (
                        "Informe se a decisao final do advogado foi aceita ou nao aceita."
                    )
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    if confirmation_choice == "seguir_algoritmo":
        if algorithm_strategy not in valid_strategies:
            return (
                jsonify(
                    {
                        "error": (
                            "A recomendacao do algoritmo ainda nao esta disponivel para "
                            "ser confirmada."
                        )
                    }
                ),
                HTTPStatus.BAD_REQUEST,
            )
        final_strategy = algorithm_strategy
    elif final_strategy not in valid_strategies:
        return (
            jsonify(
                {
                    "error": "Ao divergir do algoritmo, informe se a estrategia final sera defesa ou acordo."
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    if proposed_agreement_amount is not None and proposed_agreement_amount < 0:
        return (
            jsonify({"error": "O valor proposto para acordo nao pode ser negativo."}),
            HTTPStatus.BAD_REQUEST,
        )

    if final_strategy == "acordo":
        proposed_agreement_amount = proposed_agreement_amount or suggested_agreement_amount
        if proposed_agreement_amount is None:
            return (
                jsonify(
                    {
                        "error": (
                            "Informe um valor de acordo para concluir a escolha por acordo."
                        )
                    }
                ),
                HTTPStatus.BAD_REQUEST,
            )
    else:
        proposed_agreement_amount = None

    process.lawyer_confirmation = LawyerConfirmationRecord(
        choice=confirmation_choice,
        algorithm_strategy=algorithm_strategy,
        final_strategy=final_strategy,
        final_acceptance_status=final_acceptance_status,
        proposed_agreement_amount=proposed_agreement_amount,
        confirmed_at=process.updated_at,
    )
    process.recommendation_summary = build_final_decision_summary(process.lawyer_confirmation)
    process.decision_reasons = build_decision_reasons(
        process.model_prediction,
        process.extracted_data or {},
        process.subsidies,
        len(process.documents),
    ) + build_lawyer_confirmation_reasons(process.lawyer_confirmation)
    process.final_response = (
        final_response
        or process.recommendation_summary
        or process.final_response
        or "Resposta definitiva registrada pelo advogado."
    )
    process.analysis_state = "resposta_definitiva"
    if proposed_agreement_amount is not None:
        process.processing_notes.append(
            "Resposta definitiva do advogado registrada na plataforma com aderencia a preditao, aceite final e valor proposto de acordo."
        )
    else:
        process.processing_notes.append(
            "Resposta definitiva do advogado registrada na plataforma com aderencia a preditao e aceite final."
        )
    process.touch(status="processado")
    if process.lawyer_confirmation:
        process.lawyer_confirmation.confirmed_at = process.updated_at
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
    # O reloader do Flask recria o processo e apaga o repositorio em memoria.
    # Como os processos desta demo ficam apenas em RAM, isso gera 404 com IDs antigos.
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
