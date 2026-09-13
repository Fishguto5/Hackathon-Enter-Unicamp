from __future__ import annotations

import argparse
import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from decision_engine import (
    ARQUIVO_BASE,
    COLUNAS_DOCUMENTOS,
    FEATURES_MODELO,
    THRESHOLD_EXITO,
    carregar_base,
    criar_caso,
    recomendar_estrategia,
    treinar_modelo_exito,
    treinar_modelo_score,
)


DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "decision_model_bundle.pkl"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Treina os modelos definidos em decision_engine.py e exporta "
            "um bundle .pkl para consumo no backend."
        )
    )
    parser.add_argument(
        "--base",
        type=Path,
        default=ARQUIVO_BASE,
        help="Caminho da base historica .xlsx.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Arquivo .pkl de saida.",
    )
    return parser.parse_args()


def build_bundle(base_path: Path) -> dict[str, Any]:
    dataframe = carregar_base(base_path)
    modelo_classificacao = treinar_modelo_exito(dataframe)
    modelo_score = treinar_modelo_score(dataframe)

    sample_case = criar_caso([10000, 1, 0, 1, 1, 0, 1])
    sample_result = recomendar_estrategia(
        dados=sample_case,
        modelo_classificacao=modelo_classificacao,
        modelo_score=modelo_score,
        threshold_exito=THRESHOLD_EXITO,
    )

    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_base_path": str(base_path),
        "threshold_exito": THRESHOLD_EXITO,
        "features_modelo": FEATURES_MODELO,
        "colunas_documentos": COLUNAS_DOCUMENTOS,
        "input_schema": [
            {"position": 0, "field": "valor_da_causa", "type": "float"},
            {"position": 1, "field": "contrato", "type": "int"},
            {"position": 2, "field": "extrato", "type": "int"},
            {"position": 3, "field": "comprovante_credito", "type": "int"},
            {"position": 4, "field": "dossie", "type": "int"},
            {"position": 5, "field": "evolucao_divida", "type": "int"},
            {"position": 6, "field": "laudo_referenciado", "type": "int"},
        ],
        "models": {
            "classificacao_exito": modelo_classificacao,
            "regressao_score": modelo_score,
        },
        "smoke_test": {
            "input": [10000, 1, 0, 1, 1, 0, 1],
            "result": sample_result,
        },
    }


def main() -> None:
    args = parse_args()
    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    bundle = build_bundle(args.base.resolve())

    with output_path.open("wb") as file_pointer:
        pickle.dump(bundle, file_pointer)

    print(f"Bundle salvo em: {output_path}")
    print("Conteudo exportado:")
    print("- modelo_classificacao: classificacao_exito")
    print("- modelo_score: regressao_score")
    print(f"- threshold_exito: {bundle['threshold_exito']}")
    print(f"- features: {len(bundle['features_modelo'])}")


if __name__ == "__main__":
    main()
