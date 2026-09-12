# Requisitos Para Rodar o Algoritmo de ML

Este arquivo consolida tudo o que e necessario para treinar, exportar e consumir o algoritmo de Machine Learning usado pela politica de acordos, sem alterar o arquivo [decision_engine.py](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/src/decision_engine.py:1).

## Objetivo

O fluxo atual de ML faz duas coisas:

1. Treina um modelo de classificacao para recomendar `Defesa` ou `Acordo`.
2. Treina um modelo de regressao para sugerir o valor do acordo quando a recomendacao for `Acordo`.

O bundle exportado em `.pkl` serve para o backend Flask carregar esses modelos sem precisar retreinar a cada execucao.

## Arquivos Envolvidos

- [src/decision_engine.py](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/src/decision_engine.py:1): logica original do algoritmo
- [src/export_decision_model_bundle.py](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/src/export_decision_model_bundle.py:1): script auxiliar para gerar o `.pkl`
- [data/Hackaton_Enter_Base_Candidatos.xlsx](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/data/Hackaton_Enter_Base_Candidatos.xlsx): base historica usada no treino

## Pre-Requisitos

### Sistema

- Python `3.10+`
- `pip`
- Ambiente virtual recomendado

### Bibliotecas Python

Instale as dependencias do projeto com:

```bash
pip install -r requirements.txt
```

Se quiser isolar o ambiente:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Arquivo usado:

- [requirements.txt](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/requirements.txt:1)

## Estrutura Esperada da Base

O algoritmo espera uma planilha Excel com pelo menos estas abas:

- `Resultados dos processos`
- `Subsídios disponibilizados`

Observacoes importantes:

- a aba `Subsídios disponibilizados` e lida com `header=1`
- se existir a coluna `Número do processos`, o proprio algoritmo ja renomeia para `Número do processo`
- a base precisa conter as colunas usadas no treino, como `Valor da causa`, `Resultado macro`, `Resultado micro` e `Valor da condenação/indenização`

## Features Esperadas Pelo Modelo

O modelo trabalha com estas colunas:

```text
Valor da causa
Contrato
Extrato
Comprovante de crédito
Dossiê
Demonstrativo de evolução da dívida
Laudo referenciado
qtd_documentos
```

As seis colunas de documentos devem ser binarias:

```text
1 = documento presente
0 = documento ausente
```

`qtd_documentos` deve ser a soma dessas seis colunas.

## Como Gerar o Arquivo `.pkl`

### Rodando a partir da raiz do projeto

Se voce estiver em:

```text
/home/gustavo-fernandes/Hackathon-Enter-Unicamp
```

rode:

```bash
python3 src/export_decision_model_bundle.py \
  --base "data/Hackaton_Enter_Base_Candidatos.xlsx" \
  --output "data/decision_model_bundle.pkl"
```

### Rodando a partir da pasta `src`

Se voce estiver em:

```text
/home/gustavo-fernandes/Hackathon-Enter-Unicamp/src
```

rode:

```bash
python3 export_decision_model_bundle.py \
  --base "../data/Hackaton_Enter_Base_Candidatos.xlsx" \
  --output "../data/decision_model_bundle.pkl"
```

## Conteudo do Bundle Exportado

O arquivo `.pkl` salvo pelo exportador contem:

- `models["classificacao_exito"]`
- `models["regressao_score"]`
- `threshold_exito`
- `features_modelo`
- `colunas_documentos`
- `input_schema`
- `smoke_test`

## Como Carregar no Backend

Exemplo minimo:

```python
import pickle

with open("data/decision_model_bundle.pkl", "rb") as file_pointer:
    bundle = pickle.load(file_pointer)

modelo_classificacao = bundle["models"]["classificacao_exito"]
modelo_score = bundle["models"]["regressao_score"]
threshold_exito = bundle["threshold_exito"]
features_modelo = bundle["features_modelo"]
```

## Como Montar a Entrada no Backend

Para fazer predicao no backend, monte um `DataFrame` com a mesma estrutura do treino:

```python
import pandas as pd

dados = pd.DataFrame(
    [
        {
            "Valor da causa": 10000.0,
            "Contrato": 1,
            "Extrato": 0,
            "Comprovante de crédito": 1,
            "Dossiê": 1,
            "Demonstrativo de evolução da dívida": 0,
            "Laudo referenciado": 1,
            "qtd_documentos": 4,
        }
    ]
)
```

Observacao importante:

- a ordem e o nome das colunas devem bater exatamente com o modelo treinado

## Erros Mais Comuns

### 1. `No such file or directory`

Causa comum:

- rodar `python3 src/export_decision_model_bundle.py` quando ja esta dentro da pasta `src`

Correto dentro de `src`:

```bash
python3 export_decision_model_bundle.py \
  --base "../data/Hackaton_Enter_Base_Candidatos.xlsx" \
  --output "../data/decision_model_bundle.pkl"
```

### 2. `ModuleNotFoundError: No module named 'pandas'`

Causa:

- dependencias Python ainda nao instaladas no ambiente atual

Solucao:

```bash
pip install -r requirements.txt
```

### 3. `FileNotFoundError` na base historica

Causa:

- caminho da planilha incorreto
- uso do caminho antigo fixo dentro de `decision_engine.py`

Solucao:

- sempre passar `--base` com o caminho real da planilha

### 4. Erro de colunas ausentes ou nomes diferentes

Causa:

- a base nao bate com o formato esperado pelo treino

Solucao:

- validar nomes das colunas nas abas do Excel
- manter exatamente os nomes usados pelo algoritmo

## Boas Praticas

- nao alterar a logica de [src/decision_engine.py](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/src/decision_engine.py:1) so para exportar o modelo
- usar [src/export_decision_model_bundle.py](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/src/export_decision_model_bundle.py:1) como camada de integracao
- manter o `.pkl` fora do versionamento; o projeto ja ignora `*.pkl`
- sempre regenerar o `.pkl` quando a base de treino mudar

## Checklist Rapido

- [ ] Python instalado
- [ ] Ambiente virtual ativado
- [ ] Dependencias instaladas com `pip install -r requirements.txt`
- [ ] Base historica presente em `data/Hackaton_Enter_Base_Candidatos.xlsx`
- [ ] Comando executado a partir do diretorio correto
- [ ] Arquivo `data/decision_model_bundle.pkl` gerado com sucesso
- [ ] Backend carregando o bundle e montando o `DataFrame` com as colunas corretas
