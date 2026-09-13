from __future__ import annotations

import unittest

from src.backend.models import SUBSIDY_DEFINITIONS
from src.backend.services.document_service import classify_document


class DocumentClassificationTests(unittest.TestCase):
    def test_specific_document_signatures_override_generic_contract_terms(self) -> None:
        cases = (
            (
                "01_Autos_Processo_1234567-89-2026-8-26-0100.pdf",
                "Peticao inicial de acao declaratoria de inexistencia de debito.",
                "dossie",
            ),
            (
                "02_Comprovante_de_Credito_BACEN.pdf",
                "COMPROVANTE DE CREDITO (BACEN). Data da liberacao do credito.",
                "comprovante_credito",
            ),
            (
                "03_Demonstrativo_Evolucao_Divida.pdf",
                "Demonstrativo de evolucao da divida. Saldo devedor em aberto.",
                "evolucao_divida",
            ),
            (
                "04_Laudo_Referenciado.pdf",
                "LAUDO REFERENCIADO DA OPERACAO DE CREDITO. Contrato de emprestimo.",
                "laudo_referenciado",
            ),
        )

        for filename, text, expected_type in cases:
            with self.subTest(filename=filename):
                document_type, hits = classify_document(filename, text)

                self.assertEqual(document_type, expected_type)
                self.assertEqual(
                    hits,
                    {key: int(key == expected_type) for key in SUBSIDY_DEFINITIONS},
                )


if __name__ == "__main__":
    unittest.main()
