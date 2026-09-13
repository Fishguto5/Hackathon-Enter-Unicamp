from __future__ import annotations

import os
import pickle
from pathlib import Path
from typing import Any

try:
    import pandas as pd
except ImportError:  # pragma: no cover - depende do ambiente
    pd = None  # type: ignore[assignment]


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_BUNDLE_PATH = PROJECT_ROOT / "data" / "decision_model_bundle.pkl"
SUBSIDY_TO_MODEL_COLUMN = {
    "contrato": "Contrato",
    "extrato": "Extrato",
    "comprovante_credito": "Comprovante de crédito",
    "dossie": "Dossiê",
    "evolucao_divida": "Demonstrativo de evolução da dívida",
    "laudo_referenciado": "Laudo referenciado",
}


def get_bundle_path() -> Path:
    configured_path = os.getenv("DECISION_MODEL_BUNDLE_PATH")
    if configured_path:
        return Path(configured_path).expanduser().resolve()
    return DEFAULT_BUNDLE_PATH


def get_savings_target(claim_amount: float) -> float:
    if claim_amount <= 2000:
        return 0.00
    if claim_amount <= 5000:
        return 0.05
    if claim_amount <= 10000:
        return 0.10
    if claim_amount <= 20000:
        return 0.15
    if claim_amount <= 50000:
        return 0.20
    return 0.25


class DecisionModelService:
    def __init__(self, bundle_path: Path | None = None) -> None:
        self._bundle_path = bundle_path or get_bundle_path()
        self._bundle: dict[str, Any] | None = None
        self._load_error: str | None = None

    @property
    def bundle_path(self) -> Path:
        return self._bundle_path

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def _load_bundle(self) -> dict[str, Any] | None:
        if self._bundle is not None:
            return self._bundle
        if self._load_error is not None:
            return None
        if pd is None:
            self._load_error = (
                "Dependencia pandas ausente; nao foi possivel carregar o bundle do modelo."
            )
            return None
        if not self._bundle_path.exists():
            self._load_error = (
                f"Bundle do modelo nao encontrado em {self._bundle_path}."
            )
            return None

        try:
            with self._bundle_path.open("rb") as file_pointer:
                self._bundle = pickle.load(file_pointer)
            return self._bundle
        except Exception as exc:  # pragma: no cover - caminho defensivo
            self._load_error = f"Falha ao carregar bundle do modelo: {exc}"
            return None

    def is_available(self) -> bool:
        return self._load_bundle() is not None

    def predict(
        self,
        extracted_data: dict[str, Any],
        subsidies: dict[str, int],
    ) -> tuple[dict[str, Any] | None, list[str]]:
        notes: list[str] = []
        bundle = self._load_bundle()
        if bundle is None or pd is None:
            if self._load_error:
                notes.append(self._load_error)
            return None, notes

        try:
            input_frame = self._build_input_frame(
                extracted_data=extracted_data,
                subsidies=subsidies,
                features_modelo=bundle["features_modelo"],
            )
            models = bundle["models"]
            classification_model = models["classificacao_exito"]
            score_model = models["regressao_score"]
            threshold_success = float(bundle["threshold_exito"])

            probabilities = classification_model.predict_proba(input_frame)[0]
            classes = list(classification_model.classes_)
            if 1 not in classes:
                raise ValueError("A classe 1 (exito) nao foi encontrada no classificador.")

            success_index = classes.index(1)
            success_probability = float(probabilities[success_index])
            failure_probability = float(1 - success_probability)
            strategy = "defesa" if success_probability >= threshold_success else "acordo"

            claim_amount = float(input_frame.iloc[0]["Valor da causa"])
            raw_score = float(score_model.predict(input_frame)[0])
            agreement_score = min(max(raw_score, 0.0), 1.0)
            savings_target = get_savings_target(claim_amount)
            adjusted_score = min(max(agreement_score * (1 - savings_target), 0.0), 1.0)
            agreement_amount = max(claim_amount * adjusted_score, 0.0)

            return {
                "strategy": strategy,
                "probability_success": round(success_probability, 6),
                "probability_failure": round(failure_probability, 6),
                "threshold_success": threshold_success,
                "claim_amount_brl": round(claim_amount, 2),
                "document_count": int(input_frame.iloc[0]["qtd_documentos"]),
                "bundle_path": str(self._bundle_path),
                "bundle_created_at": bundle.get("created_at"),
                "model_input": input_frame.iloc[0].to_dict(),
                "agreement_score_predicted": round(agreement_score, 6)
                if strategy == "acordo"
                else None,
                "agreement_savings_target": round(savings_target, 6)
                if strategy == "acordo"
                else None,
                "agreement_score_adjusted": round(adjusted_score, 6)
                if strategy == "acordo"
                else None,
                "agreement_amount_suggested": round(agreement_amount, 2)
                if strategy == "acordo"
                else None,
            }, notes
        except Exception as exc:  # pragma: no cover - caminho defensivo
            notes.append(f"Falha ao executar a inferencia do modelo de decisao: {exc}")
            return None, notes

    def _build_input_frame(
        self,
        *,
        extracted_data: dict[str, Any],
        subsidies: dict[str, int],
        features_modelo: list[str],
    ):
        if pd is None:  # pragma: no cover - guard defensivo
            raise RuntimeError("pandas indisponivel")

        claim_amount = float(extracted_data.get("valor_causa") or 0.0)
        model_row = {
            "Valor da causa": claim_amount,
        }

        for subsidy_key, model_column in SUBSIDY_TO_MODEL_COLUMN.items():
            model_row[model_column] = int(subsidies.get(subsidy_key, 0))

        model_row["qtd_documentos"] = sum(
            int(model_row[column_name]) for column_name in SUBSIDY_TO_MODEL_COLUMN.values()
        )

        missing_columns = [column_name for column_name in features_modelo if column_name not in model_row]
        if missing_columns:
            raise ValueError(
                "Nao foi possivel montar a entrada do modelo; faltam colunas: "
                + ", ".join(missing_columns)
            )

        ordered_row = {column_name: model_row[column_name] for column_name in features_modelo}
        return pd.DataFrame([ordered_row])
