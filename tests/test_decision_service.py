from __future__ import annotations

import unittest

from src.backend.services.decision_service import DecisionModelService


class DecisionModelServiceTests(unittest.TestCase):
    def test_model_input_uses_the_correct_documentary_evidence(self) -> None:
        prediction, notes = DecisionModelService().predict(
            {"valor_causa": 25000.0},
            {
                "contrato": 0,
                "extrato": 0,
                "comprovante_credito": 1,
                "dossie": 1,
                "evolucao_divida": 1,
                "laudo_referenciado": 1,
            },
        )

        self.assertEqual(notes, [])
        self.assertIsNotNone(prediction)
        self.assertEqual(
            prediction["model_input"],
            {
                "Valor da causa": 25000.0,
                "Contrato": 0.0,
                "Extrato": 0.0,
                "Comprovante de crédito": 1.0,
                "Dossiê": 1.0,
                "Demonstrativo de evolução da dívida": 1.0,
                "Laudo referenciado": 1.0,
                "qtd_documentos": 4.0,
            },
        )


if __name__ == "__main__":
    unittest.main()
