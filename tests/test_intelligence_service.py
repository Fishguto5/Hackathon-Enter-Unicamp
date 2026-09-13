from __future__ import annotations

from types import SimpleNamespace
import unittest

from src.backend.services.intelligence_service import build_case_intelligence


class CaseIntelligenceTests(unittest.TestCase):
    def test_evidence_includes_its_source_context_and_facts(self) -> None:
        intelligence = build_case_intelligence(
            {
                "valor_causa": 25000.0,
                "valor_liberado": 8500.0,
                "data_liberacao_credito": "19/07/2023",
                "conta_creditada": "00012345-6",
            },
            {
                "contrato": 0,
                "extrato": 0,
                "comprovante_credito": 1,
                "dossie": 0,
                "evolucao_divida": 0,
                "laudo_referenciado": 0,
            },
            None,
            [
                SimpleNamespace(
                    filename="comprovante_credito.pdf",
                    classification="comprovante_credito",
                    extracted_text="COMPROVANTE DE CREDITO (BACEN)\nValor liberado R$ 8.500,00",
                )
            ],
        )
        evidence = next(item for item in intelligence["evidence"] if item["key"] == "comprovante_credito")

        self.assertEqual(evidence["source_documents"][0]["filename"], "comprovante_credito.pdf")
        self.assertIn("COMPROVANTE DE CREDITO", evidence["source_documents"][0]["excerpt"])
        self.assertIn("Credito informado: R$ 8.500,00.", evidence["facts_considered"])
        self.assertIn("Conta creditada: 00012345-6.", evidence["facts_considered"])


if __name__ == "__main__":
    unittest.main()
