# ============================================================
# DECISION ENGINE - POLÍTICA DE ACORDOS
# ============================================================
#
# ENTRADA DO NOVO PROCESSO
# ------------------------------------------------------------
#
# Ao executar:
#
#     python decision_engine.py
#
# o programa solicitará uma lista com exatamente 7 valores:
#
# [
#     valor_da_causa,
#     contrato,
#     extrato,
#     comprovante_credito,
#     dossie,
#     evolucao_divida,
#     laudo_referenciado
# ]
#
#
# ORDEM DAS POSIÇÕES:
#
# posição 0 → Valor da causa
# posição 1 → Contrato
# posição 2 → Extrato
# posição 3 → Comprovante de crédito
# posição 4 → Dossiê
# posição 5 → Demonstrativo de evolução da dívida
# posição 6 → Laudo referenciado
#
#
# DOCUMENTOS:
#
# 1 = documento disponível
# 0 = documento não disponível
#
#
# EXEMPLO DE ENTRADA:
#
# [10000, 1, 0, 1, 1, 0, 1]
#
#
# O exemplo acima significa:
#
# Valor da causa = R$ 10.000
# Contrato = sim
# Extrato = não
# Comprovante = sim
# Dossiê = sim
# Evolução da dívida = não
# Laudo = sim
#
#
# FLUXO:
#
# 1. Carrega a base histórica
#
# 2. Treina SVM para prever:
#
#       Êxito     = 1
#       Não Êxito = 0
#
# 3. SVM estima a chance de Êxito
#
# 4. Se:
#
#       P(Êxito) >= 70%
#           → DEFESA
#
#       P(Êxito) < 70%
#           → ACORDO
#
# 5. Caso seja acordo:
#
#       Ridge estima score de 0 a 1
#
# 6. Valor sugerido:
#
#       score * valor da causa
#
# ============================================================


import ast
import numpy as np
import pandas as pd

from pathlib import Path

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV

from sklearn.linear_model import Ridge


# ============================================================
# CONFIGURAÇÕES
# ============================================================

THRESHOLD_EXITO = 0.70


# ============================================================
# CAMINHO DA BASE HISTÓRICA
# ============================================================

ARQUIVO_BASE = Path(
    "/Users/anapocai/Desktop/Estagio/Enter/"
    "Hackathon/Hackathon-Enter-Unicamp/data/"
    "Hackaton_Enter_Base_Candidatos.xlsx"
)


# ============================================================
# DOCUMENTOS
# ============================================================

COLUNAS_DOCUMENTOS = [

    "Contrato",

    "Extrato",

    "Comprovante de crédito",

    "Dossiê",

    "Demonstrativo de evolução da dívida",

    "Laudo referenciado"
]


# ============================================================
# FEATURES UTILIZADAS PELOS MODELOS
# ============================================================
#
# qtd_documentos é calculada automaticamente.
#
# ============================================================

FEATURES_MODELO = [

    "Valor da causa",

    "Contrato",

    "Extrato",

    "Comprovante de crédito",

    "Dossiê",

    "Demonstrativo de evolução da dívida",

    "Laudo referenciado",

    "qtd_documentos"
]


NUMERICAS = FEATURES_MODELO


# ============================================================
# 1. CARREGAR BASE HISTÓRICA
# ============================================================

def carregar_base(caminho):

    if not caminho.exists():

        raise FileNotFoundError(

            f"\nArquivo não encontrado:\n"
            f"{caminho}\n"
        )


    print(
        "\nCarregando base histórica..."
    )


    # --------------------------------------------------------
    # RESULTADOS
    # --------------------------------------------------------

    df_resultados = pd.read_excel(

        caminho,

        sheet_name="Resultados dos processos"
    )


    # --------------------------------------------------------
    # SUBSÍDIOS
    # --------------------------------------------------------

    df_subsidios = pd.read_excel(

        caminho,

        sheet_name="Subsídios disponibilizados",

        header=1
    )


    # --------------------------------------------------------
    # CORRIGIR NOME DA CHAVE
    # --------------------------------------------------------

    if "Número do processos" in df_subsidios.columns:

        df_subsidios = df_subsidios.rename(

            columns={

                "Número do processos":
                "Número do processo"
            }
        )


    if "Número do processo" not in df_subsidios.columns:

        raise ValueError(

            "Não encontrei a coluna "
            "'Número do processo' "
            "na aba de subsídios."
        )


    # --------------------------------------------------------
    # JUNTAR RESULTADOS + SUBSÍDIOS
    # --------------------------------------------------------

    df = df_resultados.merge(

        df_subsidios,

        on="Número do processo",

        how="inner"
    )


    # --------------------------------------------------------
    # CONVERTER VALOR DA CAUSA
    # --------------------------------------------------------

    df["Valor da causa"] = pd.to_numeric(

        df["Valor da causa"],

        errors="coerce"
    )


    # --------------------------------------------------------
    # CONVERTER VALOR DA CONDENAÇÃO
    # --------------------------------------------------------

    df[
        "Valor da condenação/indenização"
    ] = pd.to_numeric(

        df[
            "Valor da condenação/indenização"
        ],

        errors="coerce"
    )


    # --------------------------------------------------------
    # CONVERTER DOCUMENTOS PARA NÚMERO
    # --------------------------------------------------------

    for coluna in COLUNAS_DOCUMENTOS:

        df[coluna] = pd.to_numeric(

            df[coluna],

            errors="coerce"

        ).fillna(0)


    # --------------------------------------------------------
    # QUANTIDADE DE DOCUMENTOS
    # --------------------------------------------------------

    df["qtd_documentos"] = (

        df[
            COLUNAS_DOCUMENTOS
        ]

        .sum(axis=1)
    )


    # --------------------------------------------------------
    # REMOVER LINHAS INVÁLIDAS
    # --------------------------------------------------------

    df = df.dropna(

        subset=[

            "Valor da causa",

            "Resultado macro",

            "Resultado micro"
        ]
    )


    print(

        f"Base carregada com "
        f"{len(df):,} processos."
    )


    return df


# ============================================================
# 2. PRÉ-PROCESSAMENTO
# ============================================================

def criar_preprocessor():

    return ColumnTransformer(

        transformers=[

            (

                "numericas",

                StandardScaler(),

                NUMERICAS

            )

        ]
    )


# ============================================================
# 3. TREINAR MODELO SVM
# ============================================================
#
# TARGET:
#
# 1 = Êxito
# 0 = Não Êxito
#
# ============================================================

def treinar_modelo_exito(df):


    print(

        "\nTreinando SVM para prever "
        "Êxito / Não Êxito..."
    )


    X = df[

        FEATURES_MODELO

    ].copy()


    y = (

        df[
            "Resultado macro"
        ]

        == "Êxito"

    ).astype(int)


    # --------------------------------------------------------
    # SVM
    # --------------------------------------------------------

    svm = Pipeline(

        steps=[

            (

                "preprocessor",

                criar_preprocessor()

            ),

            (

                "modelo",

                LinearSVC(

                    class_weight="balanced",

                    random_state=42

                )

            )

        ]
    )


    # --------------------------------------------------------
    # CALIBRAR PROBABILIDADES
    # --------------------------------------------------------
    #
    # LinearSVC sozinho não possui predict_proba().
    #
    # CalibratedClassifierCV permite obter uma
    # probabilidade estimada de Êxito.
    #
    # --------------------------------------------------------

    modelo = CalibratedClassifierCV(

        estimator=svm,

        method="sigmoid",

        cv=5
    )


    modelo.fit(

        X,

        y

    )


    print(
        "SVM treinada."
    )


    return modelo


# ============================================================
# 4. CRIAR BASE PARA O SCORE
# ============================================================
#
# Apenas casos históricos de Não Êxito.
#
#
# Acordo:
#
#       score = 0
#
#
# Parcial procedência:
#
#       score =
#
#       valor da condenação
#       -------------------
#       valor da causa
#
#
# Procedência:
#
#       score = 1
#
# ============================================================

def criar_base_score(df):


    df_score = df[

        df[
            "Resultado macro"
        ]

        == "Não Êxito"

    ].copy()


    # --------------------------------------------------------
    # EVITAR DIVISÃO POR ZERO
    # --------------------------------------------------------

    denominador = (

        df_score[
            "Valor da causa"
        ]

        .replace(

            0,

            np.nan

        )

    )


    # --------------------------------------------------------
    # PROPORÇÃO CONDENAÇÃO / VALOR DA CAUSA
    # --------------------------------------------------------

    df_score[
        "proporcao_condenacao"
    ] = (

        df_score[
            "Valor da condenação/indenização"
        ]

        / denominador

    )


    # --------------------------------------------------------
    # GARANTIR INTERVALO 0 - 1
    # --------------------------------------------------------

    df_score[
        "proporcao_condenacao"
    ] = (

        df_score[
            "proporcao_condenacao"
        ]

        .clip(

            0,

            1

        )

    )


    # --------------------------------------------------------
    # CRIAR SCORE HISTÓRICO
    # --------------------------------------------------------

    df_score[
        "score_desfecho"
    ] = np.select(


        [

            df_score[
                "Resultado micro"
            ].eq(
                "Acordo"
            ),


            df_score[
                "Resultado micro"
            ].eq(
                "Parcial procedência"
            ),


            df_score[
                "Resultado micro"
            ].eq(
                "Procedência"
            )

        ],


        [

            # ACORDO
            0.0,


            # PARCIAL PROCEDÊNCIA
            df_score[
                "proporcao_condenacao"
            ],


            # PROCEDÊNCIA
            1.0

        ],


        default=np.nan

    )


    # --------------------------------------------------------
    # REMOVER SCORES INVÁLIDOS
    # --------------------------------------------------------

    df_score = df_score.dropna(

        subset=[

            "score_desfecho"

        ]

    )


    return df_score


# ============================================================
# 5. TREINAR RIDGE
# ============================================================

def treinar_modelo_score(df):


    print(

        "\nTreinando Ridge para estimar "
        "o score do acordo..."
    )


    df_score = criar_base_score(

        df

    )


    X = df_score[

        FEATURES_MODELO

    ].copy()


    y = df_score[

        "score_desfecho"

    ]


    modelo = Pipeline(

        steps=[

            (

                "preprocessor",

                criar_preprocessor()

            ),

            (

                "modelo",

                Ridge(

                    alpha=1.0

                )

            )

        ]
    )


    modelo.fit(

        X,

        y

    )


    print(

        f"Ridge treinado com "
        f"{len(df_score):,} casos de Não Êxito."

    )


    return modelo


# ============================================================
# 6. RECEBER A LISTA DO TERMINAL
# ============================================================

def receber_entrada():

    print(
        "\n"
        "========================================"
    )

    print(
        "        ENTRADA DO PROCESSO"
    )

    print(
        "========================================"
    )


    print(
        "\nDigite uma lista no formato:\n"
    )


    print(

        "[valor_causa, contrato, extrato, "
        "comprovante, dossie, evolucao_divida, laudo]"

    )


    print(
        "\nOrdem:"
    )


    print(
        "posição 0 → Valor da causa"
    )

    print(
        "posição 1 → Contrato"
    )

    print(
        "posição 2 → Extrato"
    )

    print(
        "posição 3 → Comprovante de crédito"
    )

    print(
        "posição 4 → Dossiê"
    )

    print(
        "posição 5 → Demonstrativo de evolução da dívida"
    )

    print(
        "posição 6 → Laudo referenciado"
    )


    print(
        "\nDocumentos:"
    )

    print(
        "1 = disponível"
    )

    print(
        "0 = não disponível"
    )


    print(
        "\nExemplo:"
    )

    print(
        "[10000, 1, 0, 1, 1, 0, 1]"
    )


    while True:


        entrada_texto = input(

            "\nDigite a entrada: "

        )


        try:


            # ------------------------------------------------
            # TRANSFORMA TEXTO EM LISTA PYTHON
            # ------------------------------------------------

            entrada = ast.literal_eval(

                entrada_texto

            )


            # ------------------------------------------------
            # VERIFICAR SE É LISTA
            # ------------------------------------------------

            if not isinstance(

                entrada,

                list

            ):

                raise ValueError(

                    "A entrada deve ser uma lista."

                )


            # ------------------------------------------------
            # PRECISA TER 7 VALORES
            # ------------------------------------------------

            if len(entrada) != 7:

                raise ValueError(

                    "A lista deve possuir exatamente "
                    "7 valores."

                )


            # ------------------------------------------------
            # VALOR DA CAUSA
            # ------------------------------------------------

            if (

                not isinstance(

                    entrada[0],

                    (int, float)

                )

                or entrada[0] <= 0

            ):

                raise ValueError(

                    "O valor da causa deve ser "
                    "um número maior que zero."

                )


            # ------------------------------------------------
            # DOCUMENTOS DEVEM SER 0 OU 1
            # ------------------------------------------------

            if not all(

                valor in [0, 1]

                for valor in entrada[1:]

            ):

                raise ValueError(

                    "Os documentos devem ser "
                    "representados apenas por 0 ou 1."

                )


            return entrada


        except (

            ValueError,

            SyntaxError

        ) as erro:


            print(

                f"\nEntrada inválida: "
                f"{erro}"

            )


            print(

                "\nExemplo válido:"

            )


            print(

                "[10000, 1, 0, 1, 1, 0, 1]"

            )


# ============================================================
# 7. TRANSFORMAR LISTA EM DATAFRAME
# ============================================================

def criar_caso(entrada):


    novo_caso = pd.DataFrame({


        "Valor da causa": [

            entrada[0]

        ],


        "Contrato": [

            entrada[1]

        ],


        "Extrato": [

            entrada[2]

        ],


        "Comprovante de crédito": [

            entrada[3]

        ],


        "Dossiê": [

            entrada[4]

        ],


        "Demonstrativo de evolução da dívida": [

            entrada[5]

        ],


        "Laudo referenciado": [

            entrada[6]

        ]

    })


    return novo_caso


# ============================================================
# 8. RECOMENDAR ESTRATÉGIA
# ============================================================

def recomendar_estrategia(

    dados,

    modelo_classificacao,

    modelo_score,

    threshold_exito=0.70

):


    dados = dados.copy()


    # --------------------------------------------------------
    # CALCULAR QUANTIDADE DE DOCUMENTOS
    # --------------------------------------------------------

    dados[

        "qtd_documentos"

    ] = (

        dados[

            COLUNAS_DOCUMENTOS

        ]

        .sum(axis=1)

    )


    X_novo = dados[

        FEATURES_MODELO

    ]


    # ========================================================
    # PROBABILIDADE DE ÊXITO
    # ========================================================

    probabilidades = (

        modelo_classificacao

        .predict_proba(

            X_novo

        )

    )


    classes = list(

        modelo_classificacao.classes_

    )


    if 1 not in classes:

        raise ValueError(

            "O modelo não possui a classe 1 "
            "representando Êxito."

        )


    indice_exito = (

        classes.index(1)

    )


    prob_exito = (

        probabilidades[

            :,

            indice_exito

        ]

    )


    prob_nao_exito = (

        1

        -

        prob_exito

    )


    # ========================================================
    # DECISÃO
    # ========================================================
    #
    # P(Êxito) >= 70%
    #
    #       DEFESA
    #
    # P(Êxito) < 70%
    #
    #       ACORDO
    #
    # ========================================================

    recomendacao = np.where(


        prob_exito

        >= threshold_exito,


        "Defesa",


        "Acordo"

    )


    # ========================================================
    # SCORE ESTIMADO PELO RIDGE
    # ========================================================

    score_estimado = (

        modelo_score

        .predict(

            X_novo

        )

    )


    score_estimado = np.clip(

        score_estimado,

        0,

        1

    )


    # ========================================================
    # VALOR DO ACORDO
    # ========================================================

    valor_causa = (

        dados[

            "Valor da causa"

        ]

        .astype(float)

        .values

    )


    valor_acordo = (

        score_estimado

        *

        valor_causa

    )


    # --------------------------------------------------------
    # SE FOR DEFESA:
    #
    # NÃO EXISTE VALOR DE ACORDO
    # --------------------------------------------------------

    score_final = np.where(


        recomendacao

        == "Acordo",


        score_estimado,


        np.nan

    )


    valor_final = np.where(


        recomendacao

        == "Acordo",


        valor_acordo,


        np.nan

    )


    # ========================================================
    # RESULTADO
    # ========================================================

    resultado = pd.DataFrame({


        "Chance de Êxito":

            prob_exito,


        "Risco de Não Êxito":

            prob_nao_exito,


        "Recomendação":

            recomendacao,


        "Score estimado":

            score_final,


        "Valor sugerido do acordo":

            valor_final

    })


    return resultado


# ============================================================
# 9. MOSTRAR RESULTADO
# ============================================================

def mostrar_resultado(

    resultado,

    novo_caso

):


    linha = resultado.iloc[0]


    chance_exito = linha[

        "Chance de Êxito"

    ]


    risco = linha[

        "Risco de Não Êxito"

    ]


    recomendacao = linha[

        "Recomendação"

    ]


    qtd_documentos = (

        novo_caso[

            COLUNAS_DOCUMENTOS

        ]

        .sum(axis=1)

        .iloc[0]

    )


    print(
        "\n"
        "========================================"
    )

    print(
        "           RECOMENDAÇÃO"
    )

    print(
        "========================================"
    )


    print(

        f"\nDocumentos disponíveis: "
        f"{int(qtd_documentos)}/6"

    )


    print(

        f"\nChance estimada de Êxito: "
        f"{chance_exito:.1%}"

    )


    print(

        f"Risco estimado de Não Êxito: "
        f"{risco:.1%}"

    )


    print(

        f"\nRECOMENDAÇÃO: "
        f"{recomendacao.upper()}"

    )


    # ========================================================
    # CASO: ACORDO
    # ========================================================

    if recomendacao == "Acordo":


        score = linha[

            "Score estimado"

        ]


        valor = linha[

            "Valor sugerido do acordo"

        ]


        valor_causa = (

            novo_caso.iloc[0][

                "Valor da causa"

            ]

        )


        print(

            f"\nScore estimado: "
            f"{score:.3f}"

        )


        print(

            f"Valor da causa: "
            f"R$ {valor_causa:,.2f}"

        )


        print(

            f"Valor sugerido de acordo: "
            f"R$ {valor:,.2f}"

        )


    # ========================================================
    # CASO: DEFESA
    # ========================================================

    else:


        print(

            "\nProbabilidade de Êxito superior "
            f"ao threshold de "
            f"{THRESHOLD_EXITO:.0%}."

        )


        print(

            "Não é recomendado propor acordo."

        )


    print(
        "\n========================================\n"
    )


# ============================================================
# 10. FUNÇÃO PRINCIPAL
# ============================================================

def main():


    # ========================================================
    # CARREGAR BASE
    # ========================================================

    df = carregar_base(

        ARQUIVO_BASE

    )


    # ========================================================
    # TREINAR SVM
    # ========================================================

    modelo_svm = treinar_modelo_exito(

        df

    )


    # ========================================================
    # TREINAR RIDGE
    # ========================================================

    modelo_ridge = treinar_modelo_score(

        df

    )


    # ========================================================
    # RECEBER ENTRADA PELO TERMINAL
    # ========================================================

    entrada = receber_entrada()


    # ========================================================
    # TRANSFORMAR ENTRADA EM DATAFRAME
    # ========================================================

    novo_caso = criar_caso(

        entrada

    )


    # ========================================================
    # GERAR RECOMENDAÇÃO
    # ========================================================

    resultado = recomendar_estrategia(


        dados=novo_caso,


        modelo_classificacao=
            modelo_svm,


        modelo_score=
            modelo_ridge,


        threshold_exito=
            THRESHOLD_EXITO

    )


    # ========================================================
    # MOSTRAR RESULTADO
    # ========================================================

    mostrar_resultado(

        resultado,

        novo_caso

    )


# ============================================================
# EXECUTAR
# ============================================================

if __name__ == "__main__":

    main()