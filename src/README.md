# Decision Engine — Política de Defesa e Acordos

Este projeto implementa um modelo de apoio à decisão para processos judiciais bancários.

A partir do **valor da causa** e da **disponibilidade dos documentos de defesa**, o sistema estima a chance de êxito do banco e recomenda uma das seguintes estratégias:

* **Defesa**
* **Acordo**

Caso a recomendação seja **Acordo**, um segundo modelo estima um score de risco financeiro e calcula um valor sugerido para o acordo.

---

## Como funciona

O fluxo do modelo é dividido em duas etapas principais:

```text
Dados do processo
        ↓
Modelo de Classificação - SVM
        ↓
Probabilidade de Êxito
        ↓
 ┌─────────────────────┐
 │                     │
P(Êxito) >= 0.70   P(Êxito) < 0.70
 │                     │
DEFESA                ACORDO
                       ↓
               Modelo de Regressão
                       ↓
                     Ridge
                       ↓
               Score entre 0 e 1
                       ↓
          Valor sugerido do acordo
```

---

# Entrada

Ao executar o programa:

```bash
python decision_engine.py
```

o sistema solicitará uma lista com exatamente **7 valores**.

Formato:

```python
[
    valor_da_causa,
    contrato,
    extrato,
    comprovante_credito,
    dossie,
    evolucao_divida,
    laudo_referenciado
]
```

A posição de cada elemento da lista é fixa:

```text
posição 0 → Valor da causa
posição 1 → Contrato
posição 2 → Extrato
posição 3 → Comprovante de crédito
posição 4 → Dossiê
posição 5 → Demonstrativo de evolução da dívida
posição 6 → Laudo referenciado
```

Para os documentos:

```text
1 = documento disponível
0 = documento não disponível
```

### Exemplo

```python
[10000, 1, 0, 1, 1, 0, 1]
```

Essa entrada representa:

```text
Valor da causa: R$ 10.000

Contrato: disponível
Extrato: não disponível
Comprovante de crédito: disponível
Dossiê: disponível
Demonstrativo de evolução da dívida: não disponível
Laudo referenciado: disponível
```

---

# Modelo de classificação — SVM

A primeira etapa utiliza uma **Support Vector Machine (SVM)** para estimar o resultado do processo.

Foi utilizado o modelo:

```python
LinearSVC
```

A variável alvo é definida como:

```text
1 → Êxito
0 → Não Êxito
```

Neste projeto:

* **Êxito** representa um resultado favorável ao banco;
* **Não Êxito** representa um resultado desfavorável, incluindo procedência, parcial procedência ou acordo.

As variáveis utilizadas pelo modelo são:

```text
Valor da causa
Contrato
Extrato
Comprovante de crédito
Dossiê
Demonstrativo de evolução da dívida
Laudo referenciado
Quantidade de documentos
```

As variáveis são padronizadas utilizando:

```python
StandardScaler
```

Como o `LinearSVC` não fornece probabilidades diretamente, foi utilizado:

```python
CalibratedClassifierCV
```

com calibração pelo método:

```text
sigmoid
```

Assim, o sistema consegue obter uma **probabilidade estimada de Êxito** para cada novo processo.

---

# Regra de decisão

Após calcular a probabilidade de Êxito, é utilizada a seguinte regra:

```text
P(Êxito) >= 0.70
        ↓
      DEFESA
```

e:

```text
P(Êxito) < 0.70
        ↓
      ACORDO
```

O threshold atualmente utilizado é:

```python
THRESHOLD_EXITO = 0.70
```

Ou seja, o sistema recomenda defesa somente quando a probabilidade estimada de um resultado favorável ao banco é de pelo menos **70%**.

---

# Modelo de regressão — Ridge

Quando a classificação indica **Acordo**, o sistema utiliza um segundo modelo para estimar a intensidade do possível prejuízo.

O modelo escolhido foi:

```python
Ridge Regression
```

A regressão Ridge é uma regressão linear regularizada por L2. A regularização ajuda a reduzir a influência excessiva de variáveis correlacionadas e torna o modelo mais estável.


---

# Construção do score

O Ridge é treinado apenas com processos históricos classificados como **Não Êxito**.

O target utilizado varia entre:

```text
0 e 1
```

e é construído da seguinte maneira.

### Acordo

```text
score = 0
```

### Parcial procedência

O score corresponde à proporção entre a condenação e o valor original da causa:

```text
score = valor da condenação / valor da causa
```

O valor é limitado ao intervalo entre `0` e `1`.

### Procedência

```text
score = 1
```

Dessa forma:

```text
score próximo de 0
→ impacto financeiro histórico menor

score próximo de 1
→ impacto financeiro histórico maior
```

---

# Valor sugerido do acordo

Quando a recomendação é **Acordo**, o valor sugerido é calculado por:

```text
Valor sugerido = Score estimado × Valor da causa
```

Exemplo:

```text
Valor da causa = R$ 10.000

Score estimado = 0.40
```

Então:

```text
Valor sugerido do acordo = R$ 4.000
```

O score previsto pelo Ridge é limitado entre `0` e `1`, evitando sugestões negativas ou superiores ao valor integral da causa.

---

# Saída

O programa retorna as seguintes informações:

```text
Quantidade de documentos disponíveis
Chance estimada de Êxito
Risco estimado de Não Êxito
Recomendação
```

Caso a recomendação seja **Defesa**, a saída possui formato semelhante a:

```text
========================================
           RECOMENDAÇÃO
========================================

Documentos disponíveis: 6/6

Chance estimada de Êxito: 95.0%
Risco estimado de Não Êxito: 5.0%

RECOMENDAÇÃO: DEFESA

Não é recomendado propor acordo.
```

Caso a recomendação seja **Acordo**, também são apresentados o score e o valor sugerido:

```text
========================================
           RECOMENDAÇÃO
========================================

Documentos disponíveis: 2/6

Chance estimada de Êxito: 35.0%
Risco estimado de Não Êxito: 65.0%

RECOMENDAÇÃO: ACORDO

Score estimado: 0.420

Valor da causa:
R$ 10.000,00

Valor sugerido de acordo:
R$ 4.200,00
```

---

# Exemplo de execução

Execute:

```bash
python decision_engine.py
```

O terminal solicitará:

```text
Digite a entrada:
```

Insira, por exemplo:

```python
[10000, 1, 0, 1, 1, 0, 1]
```

e pressione `Enter`.

O sistema irá processar o caso e exibir a recomendação.

---

# Tecnologias utilizadas

* Python
* Pandas
* NumPy
* Scikit-learn
* LinearSVC
* CalibratedClassifierCV
* Ridge Regression
* StandardScaler

---

# Dependências

Para instalar as principais bibliotecas necessárias:

```bash
pip install pandas numpy scikit-learn openpyxl
```

---

# Base histórica

O programa utiliza uma base histórica contendo os resultados dos processos e a disponibilidade dos documentos de defesa.

Durante a execução, as tabelas de resultados e subsídios são combinadas pelo número do processo.

A base é utilizada para treinar:

1. o modelo SVM de classificação de Êxito/Não Êxito;
2. o modelo Ridge responsável pela estimativa do score financeiro.

O caminho da base deve estar corretamente configurado na variável:

```python
ARQUIVO_BASE
```

antes da execução do programa.

---

## Resumo

O sistema possui dois modelos complementares:

```text
SVM
↓
"Qual é a chance de o banco obter Êxito?"

        +

Ridge
↓
"Se a estratégia for acordo, qual deve ser a magnitude do valor?"
```

Com isso, a solução transforma os dados históricos dos processos em uma recomendação objetiva de **Defesa ou Acordo**, acompanhada da probabilidade estimada de Êxito e, quando aplicável, de um valor sugerido para negociação.
