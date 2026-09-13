# Setup e Execução

Esta solução agora possui:

- `frontend/`: interface React/Vite para criar processos, anexar PDFs, rodar o pipeline e exportar resultados
- `src/backend/`: API Flask com processamento em memória, extração estruturada via OpenAI e geração da matriz de features

## Pré-requisitos

- Python 3.11 ou superior
- Node.js 18 ou superior
- npm 9 ou superior

## Variáveis de Ambiente

Copie `.env.example` para `.env` na raiz do projeto e preencha:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5
VITE_API_BASE_URL=http://127.0.0.1:5000
DECISION_MODEL_BUNDLE_PATH=data/decision_model_bundle.pkl
```

Se `OPENAI_API_KEY` não estiver definida, o backend executa um fallback heurístico local para a extração dos campos.
O backend também aceita `.env` dentro de `src/`, mas a chave deve ser uma chave nova e válida.
Se `DECISION_MODEL_BUNDLE_PATH` não for definida, o backend tenta carregar `data/decision_model_bundle.pkl`.

## Instalação do Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r src/backend/requirements.txt
```

## Execução do Backend

```bash
source .venv/bin/activate
python3 -m src.backend.app
```

O backend sobe por padrão em `http://127.0.0.1:5000`.

Ao clicar em **Rodar pipeline**, a API envia todos os documentos do processo para duas análises
estruturadas: classificação individual dos subsídios e extração dos dados centrais dos autos.
Em seguida, ela monta a entrada do modelo de ML e retorna a recomendação estruturada de `defesa`
ou `acordo`, incluindo probabilidade de êxito e valor sugerido de acordo quando aplicável.
O botão **Exportar XLSX** gera uma aba `tabela_subsidios` com as colunas `Número do processos`,
`Contrato`, `Extrato`, `Comprovante de crédito`, `Dossiê`, `Demonstrativo de evolução da dívida`
e `Laudo referenciado`.

## Instalação do Frontend

```bash
cd frontend
npm install
```

## Execução do Frontend

```bash
cd frontend
npm run dev
```

O Vite exibirá a URL local no terminal. Abra o endereço informado no navegador.

## Scripts disponíveis

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
```

## Testes do Sanitizer

O repositório agora inclui uma suíte `unittest` para o sanitizer anti prompt injection e para a integração
do fluxo real de extração do advogado:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

Para uma avaliação real opcional com fixtures fictícias de controle e variantes adversariais:

```bash
OPENAI_API_KEY=... python3 -m src.backend.run_prompt_injection_real_eval
```

Consulte [docs/SANITIZER.md](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/docs/SANITIZER.md:1) para detalhes de arquitetura, limites e cobertura.

## Fluxo esperado

1. Criar um processo na interface.
2. Anexar PDFs de autos e subsídios.
3. Rodar o pipeline.
4. Revisar os campos extraídos, a tabela 0/1 dos subsídios e a matriz de features.
5. Exportar `JSON` ou `XLSX`.

## Dados

Coloque os arquivos fornecidos na pasta `data/`. Consulte [`data/README.md`](./data/README.md) para instruções detalhadas.

## Machine Learning

Para os requisitos especificos do algoritmo de ML, treino e geracao do bundle `.pkl`, consulte [docs/ML_REQUIREMENTS.md](/home/gustavo-fernandes/Hackathon-Enter-Unicamp/docs/ML_REQUIREMENTS.md:1).

## Estrutura do Projeto

```text
├── frontend/         # aplicação React com Vite
├── src/backend/      # API Flask e serviços do pipeline jurídico
├── src/              # código-fonte complementar da solução
├── data/             # dados não versionados
├── docs/             # apresentação e documentação
├── .env.example      # variáveis de ambiente necessárias
├── SETUP.md          # este arquivo
└── README.md         # descrição do desafio
```
