# Analise Hibrida de Casos

Este projeto analisa casos de emprestimo consignado a partir de PDFs e gera:

- extracao estruturada dos fatos;
- avaliacao das evidencias;
- score documental e risco juridico;
- recomendacao de defesa, acordo ou revisao humana;
- comparacao opcional com o `decision_engine` treinado na base historica.

## Entradas

O `rascunho.py` espera uma pasta raiz com subpastas de casos e arquivos PDF.

Exemplo da estrutura:

```text
casos/
  Caso_01_0801234-56-2024-8-10-0001/
    01_Autos_Processo_0801234-56-2024-8-10-0001.pdf
    02_Contrato_502348719.pdf
    03_Extrato_Bancario.pdf
    ...
  Caso_02_0654321-09-2024-8-04-0001/
    01_Autos_Processo_0654321-09-2024-8-04-0001.pdf
    02_Comprovante_de_Credito_BACEN.pdf
    ...
```

Entradas aceitas pelo script:

- `--input`: pasta raiz com os casos.
- `--output`: pasta onde os resultados serao salvos.
- `--policy`: arquivo JSON com pesos e parametros de politica documental.
- `--llm` ou `--no-llm`: ativa ou desativa a extracao por LLM.
- `--ocr`: tenta OCR em PDFs sem texto.
- `--model`: modelo usado na extracao LLM.
- `--decision-base`: planilha `.xlsx` para ativar o `decision_engine`.
- `--decision-profile`: perfil de politica do `decision_engine`.
- `--decision-all-profiles`: compara todos os perfis do `decision_engine`.

## Processo

O fluxo do `rascunho.py` acontece em camadas:

1. Descobre todos os PDFs dentro da pasta de entrada e agrupa por caso.
2. Extrai texto dos PDFs.
3. Classifica os documentos por tipo, como contrato, extrato, BACEN, dossie e laudo.
4. Extrai fatos relevantes, como numero do contrato, CPF, valor liberado, parcelas e datas.
5. Avalia evidencias e cruza informacoes entre documentos.
6. Calcula forca probatoria, risco e recomendacao com regras deterministicas.
7. Se a LLM estiver ativa, compara a extracao heuristica com a extracao da LLM.
8. Se houver `decision-base`, treina o `decision_engine` e roda uma segunda analise por caso.
9. Gera explicabilidade do score e registra a personalizacao usada na execucao.

## Saidas

Os principais arquivos gerados na pasta de saida sao:

- `cases.json`: resultado tecnico bruto de cada caso.
- `cases.sqlite3`: base SQLite com casos, documentos, evidencias e scores.
- `case_scores.csv`: resumo tabular dos scores.
- `report.md`: resumo curto dos casos.
- `comparison.md`: comparacao entre heuristica e LLM, quando a LLM estiver ativa.
- `resposta_final_casos_1_e_2.json`: resposta consolidada em JSON.
- `resposta_final_casos_1_e_2.md`: resumo consolidado em Markdown.
- `Caso_*_resposta.md`: resposta individual por caso.

## O que aparece em cada caso

Cada caso pode conter:

- `extracao_fatos`: fatos normalizados e suas origens;
- `evidencias`: status de cada evidencia relevante;
- `contradicoes`: lacunas, conflitos e documentos apenas referenciados;
- `ifp`: composicao do indice de forca probatoria;
- `risco_juridico`: fatores favoraveis ao banco e ao autor;
- `analise_financeira`: calculos possiveis e dados ausentes;
- `recomendacao`: saida operacional final;
- `explicabilidade_score`: fatores que mais aumentaram ou reduziram o score;
- `personalizacao`: politica e perfil usados;
- `analise_decision_engine`: segunda visao baseada na base historica.

## Exemplos de execucao

Execucao simples:

```powershell
python rascunho.py --output outputs_execucao --no-llm
```

Execucao com caminho explicito:

```powershell
python rascunho.py --input "C:\Users\letic\OneDrive\Área de Trabalho\hackathon\casos" --output outputs_execucao --no-llm
```

Execucao com `decision_engine`:

```powershell
python rascunho.py `
  --input "C:\Users\letic\OneDrive\Área de Trabalho\hackathon\casos" `
  --output outputs_hibrido `
  --no-llm `
  --decision-base "C:\Users\letic\Downloads\Hackaton_Enter_Base_Candidatos (1).xlsx" `
  --decision-profile medio_risco `
  --decision-all-profiles
```

Execucao com politica personalizada:

```powershell
python rascunho.py --output outputs_alto --no-llm --policy policy_profiles\alto_risco.json
```

## Politicas

Os perfis em `policy_profiles/` alteram a sensibilidade da analise documental.

- `baixo_risco.json`: mais conservador.
- `medio_risco.json`: equilibrado.
- `alto_risco.json`: mais agressivo.

No `decision_engine`, o perfil altera principalmente:

- threshold de defesa;
- meta de economia no acordo.

No `rascunho.py`, a politica altera principalmente:

- pesos efetivos;
- risco base;
- multiplicadores das evidencias;
- prioridade e leitura final do caso.

## Como verificar se funcionou

Sinais de execucao correta:

- o terminal mostra `Analisando Caso_01...` e `Analisando Caso_02...`;
- ao final aparece `Concluído. Resultados salvos em ...`;
- a pasta de saida contem `cases.json` e `resposta_final_casos_1_e_2.md`.

## Observacoes

- Se o script disser que a pasta de entrada nao existe, confira o valor de `--input`.
- O padrao atual do `--input` e a propria pasta do projeto.
- Se a LLM nao estiver configurada, o fluxo pode usar o fallback local.
- Se a base historica nao for informada, a parte de `decision_engine` nao sera executada.

## Prompt De Produto E Site

Use o texto abaixo como prompt para documentacao, pitch, design de tela ou alinhamento de produto:

```text
Quero apresentar um produto juridico-financeiro com inteligencia em camadas.

O diferencial nao e apenas prever "acordo" ou "defesa". O sistema combina:
1. analise historica de carteira para decisao estrategica;
2. analise documental do caso para medir qualidade real da prova;
3. camada futura de custo e simulacao financeira.

Quero que a explicacao destaque que modelos simples de mercado usam so variaveis rasas, como valor da causa, comarca, resultado historico e quantidade de documentos.

Nosso diferencial e usar variaveis probatorias e operacionais, como:
- contrato integral ou apenas referenciado;
- extrato bancario presente ou ausente;
- comprovante BACEN;
- dossie de validacao;
- biometria validada;
- gravacao;
- titularidade da conta de destino;
- movimentacao posterior do credito;
- inconsistencias entre documentos;
- canal de contratacao;
- alegacao de fraude;
- confianca da extracao;
- perfil de politica aplicado.

Explique que isso torna a recomendacao mais explicavel, auditavel e aderente a operacao.

Mostre tambem como visualizar isso no site em 3 modulos:

Modulo 1 - Decisao Estrategica
- chance de exito;
- risco de nao exito;
- defesa ou acordo;
- valor sugerido de acordo;
- comparacao por perfil de risco;
- metricas agregadas da carteira.

Modulo 2 - Analise Documental
- fatos extraidos;
- evidencias presentes, ausentes e referenciadas;
- IFP;
- risco juridico;
- contradicoes;
- revisao humana;
- explicabilidade do score.

Modulo 3 - Simulacao de Custo
- custo esperado da defesa;
- custo esperado do acordo;
- economia potencial;
- prioridade financeira.

Explique que os documentos nao servem apenas para revisar o caso, mas tambem para enriquecer futuras features de custo, score e estrategia.

No final, escreva uma mensagem forte de produto:
"Nosso diferencial nao esta apenas no modelo, mas na engenharia das variaveis. Em vez de usar so dados processuais e financeiros, incorporamos variaveis documentais e probatorias que refletem a forca real do caso. Isso torna a recomendacao mais explicavel, auditavel e aderente a operacao juridica."
```

## Variaveis Atuais No `rascunho.py`

Hoje o motor documental usa principalmente estas variaveis:

### Fatos extraidos

- `process_number`
- `contract_number`
- `cpf`
- `uf`
- `released_amount`
- `installment_value`
- `installment_count`
- `contract_date`
- `benefit_inss`
- `account`
- `author_name`

### Alegacoes e sinais do caso

- `denies_contract`
- `claims_fraud`
- `claims_account_not_owned`
- `requests_refund`
- `requests_moral_damages`

### Evidencias documentais

- `contract`
- `bank_statement`
- `bacen_proof`
- `dossier`
- `biometrics`
- `recording`
- `account_ownership`
- `credit_movement`

### Status possiveis de evidencia

- `present_and_verified`
- `present_but_unverified`
- `referenced_only`
- `missing`
- `contradicted`

### Variaveis derivadas

- `completude_documental`
- `coerencia_documental`
- `forca_probatoria`
- `risco_derrota`
- `exposicao_proxy`
- `score_economico`
- `score_tempo`
- `score_provisionamento_proxy`
- `prioridade_acordo`
- `recomendacao`
- `confianca`

## Entradas, Saidas E IFCP

`IFCP` significa **Indice de Forca do Caso Probatorio**. No JSON, os campos antigos `ifp` e `componentes_ifp` continuam existindo por compatibilidade; eles representam o mesmo indice.

### 1. Entradas do sistema

| Grupo | Variaveis | Para que servem |
| --- | --- | --- |
| Arquivos | PDFs dentro de `--input` | Fonte primaria dos fatos e evidencias do caso. |
| Configuracao | `--policy`, `--llm`, `--ocr` | Define politica, metodo de extracao e tratamento de PDFs escaneados. |
| Fatos extraidos | processo, contrato, CPF, UF, valor liberado, parcelas, datas, conta | Identificam o caso e permitem cruzamentos entre documentos. |
| Alegacoes | fraude, desconhecimento do contrato, conta nao pertencente ao autor, pedido de devolucao e danos morais | Adicionam sinais de risco e orientam a revisao. |
| Evidencias | contrato, extrato, BACEN, dossie, biometria, gravacao, titularidade e movimentacao do credito | Medem a qualidade da prova da contratacao e do recebimento. |

Cada evidencia recebe um `status`: `present_and_verified`, `present_but_unverified`, `referenced_only`, `missing` ou `contradicted`.

### 2. Como o IFCP e calculado

O calculo usa o peso da evidencia e a qualidade do seu status. Assim, um documento apenas citado nao vale o mesmo que um documento anexado e validado.

| Evidencia | Peso maximo |
| --- | ---: |
| contrato | 20 |
| extrato bancario | 20 |
| comprovante BACEN | 15 |
| dossie | 15 |
| biometria | 10 |
| gravacao | 5 |
| titularidade da conta | 10 |
| movimentacao posterior do credito | 5 |

| Status | Multiplicador | Efeito |
| --- | ---: | --- |
| `present_and_verified` | 1.0 | peso total |
| `present_but_unverified` | 0.6 | evidencia parcial |
| `referenced_only` | 0.3 | apenas referencia |
| `missing` | 0.0 | nao contribui |
| `contradicted` | -0.5 | reduz a forca |

```text
contribuicao = peso_maximo x multiplicador_do_status
soma_evidencias = soma de todas as contribuicoes
IFCP = limite_0_100(soma_evidencias - penalidades)
```

Exemplo: contrato com peso `20` e status `present_and_verified` gera `20 x 1.0 = 20` pontos. Extrato ausente gera `20 x 0.0 = 0` pontos. Se houver uma inconsistencia de CPF com penalidade `30`, ela e subtraida depois da soma das evidencias.

Penalidades podem ser aplicadas por conta contestada, valor divergente, CPF divergente, numero de contrato divergente, evidencia contradita, contrato ausente e biometria ausente. O resultado final sempre fica entre `0` e `100`.

### 3. Saidas principais e por que existem

| Saida | O que responde |
| --- | --- |
| `extracao_fatos` | Quais fatos foram encontrados e em qual documento. |
| `evidencias` | Quais provas existem, qual o status e qual a fonte. |
| `ifp` / `ifcp` | Qual a forca documental do caso e como ela foi calculada. |
| `risco_juridico` | Quais fatores favorecem o banco ou o autor e qual o risco estimado. |
| `analise_financeira` | Quais valores financeiros existem e quais calculos ainda dependem de dados ausentes. |
| `recomendacao` | Se a proxima acao sugerida e defesa, acordo ou revisao humana. |
| `explicabilidade_score` | Quais fatores aumentaram ou reduziram os scores. |
| `analise_decision_engine` | Probabilidade historica de exito e, quando aplicavel, valor sugerido de acordo. |

No JSON novo, `ifcp` tambem informa `variaveis_entrada`, `formula`, `componentes_ifp`, `soma_evidencias_antes_das_penalidades`, `total_penalidades`, `principais_lacunas` e `por_que_o_resultado`. Isso permite explicar cada ponto sem reconstruir o calculo manualmente.

## Formula Atual Do Risco

O risco juridico hoje segue esta logica simplificada:

```text
risco = risco_inicial
      + adicional_por_fraude
      + adicional_por_conta_contestada
      + adicional_por_documento_essencial_ausente
      + adicional_por_inconsistencia
      - 0.5 * forca_probatoria
```

Depois disso, o valor e truncado para ficar entre `0` e `100`.

## Metricas Que O `rascunho.py` Ja Tem Hoje

### Metricas por caso

- completude documental;
- coerencia documental;
- forca probatoria;
- classificacao da forca;
- risco de derrota;
- risco de fraude;
- exposicao proxy;
- score economico;
- score tempo;
- score de provisionamento proxy;
- prioridade de acordo;
- recomendacao;
- confianca;
- contribuicoes por evidencia;
- status das evidencias;
- pesos efetivos da politica;
- explicabilidade do score;
- personalizacao da politica;
- analise opcional do `decision_engine`.

### Metricas agregadas de contratacao

- indice medio de forca probatoria;
- mediana do IFP;
- taxa de documentacao completa;
- taxa de inconsistencia documental;
- taxa de documentos ausentes;
- taxa de validacao biometrica;
- taxa de conta de destino compativel;
- taxa de credito movimentado pelo titular;
- distribuicao de casos por canal de contratacao;
- taxa de risco por canal;
- tempo medio para recuperar evidencias;
- taxa de casos encaminhados para revisao humana.

### Metricas agregadas de judicializacao

- taxa de exito;
- taxa de nao exito;
- valor medio da condenacao;
- mediana da condenacao;
- condenacao media sobre valor da causa;
- taxa de acordo;
- taxa de aceitacao;
- valor medio dos acordos;
- economia media por acordo;
- economia liquida media;
- tempo medio ate encerramento;
- custo medio por processo;
- quantidade de processos ativos;
- taxa de encerramento no periodo.

Observacao:
parte dessas metricas ainda sai como `null` quando o dado nao existe nos documentos ou no historico do caso.

### Metricas agregadas de decisao

- precisao de recomendacoes de defesa;
- recall de casos perdidos;
- taxa de falsos acordos;
- quantidade de perdas evitadas;
- valor de perdas evitadas;
- taxa de revisao humana;
- taxa de override pelos advogados;
- qualidade dos overrides;
- regret economico medio;
- economia potencial nao capturada;
- acordos desnecessarios;
- oportunidades perdidas.

## Como Visualizar Isso No Site

Uma boa organizacao visual seria:

### Tela 1 - Dashboard Executivo

- total de casos;
- taxa de acerto;
- taxa de acordo;
- distribuicao por perfil;
- canais com maior risco;
- economia gerada;
- casos em revisao humana.

### Tela 2 - Raio-X Do Caso

- documentos enviados;
- fatos extraidos;
- IFP;
- risco juridico;
- evidencias presentes e ausentes;
- contradicoes;
- recomendacao;
- explicabilidade do score;
- comparacao entre motor documental e `decision_engine`.

### Tela 3 - Simulador De Politica

- perfil conservador, medio e agressivo;
- threshold de defesa;
- meta de economia;
- impacto esperado em acordos, defesa e revisao humana.

### Tela 4 - Visao De Evolucao Do Produto

- quais variaveis ja entram no score;
- quais documentos estao enriquecendo o modelo;
- como o modulo documental pode melhorar o modulo de custo no futuro;
- como novas features documentais podem recalibrar estrategia e acordo.
