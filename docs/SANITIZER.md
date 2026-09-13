# Sanitizer Anti Prompt Injection

## Mapa real do repositório

- Encontrado: API Flask em `src/backend/app.py`, com o fluxo do advogado em `POST /api/processes/<process_id>/analyze`.
- Encontrado: extração de texto/PDF em `src/backend/services/document_service.py`.
- Encontrado: classificação documental e extração estruturada via OpenAI em `src/backend/services/extraction_service.py`.
- Encontrado: esquemas reais `EXTRACTION_SCHEMA` e `DOCUMENT_CLASSIFICATION_SCHEMA` no mesmo serviço.
- Não encontrado: sanitizer anti prompt injection prévio.
- Não encontrado: suíte de testes automatizados pré-existente.
- Lacuna conhecida: PDFs sem texto embutido continuam fora da cobertura do sanitizer enquanto não houver OCR/visão.

## Núcleo geral

Arquivo: `src/backend/security/prompt_injection_sanitizer.py`

Responsabilidades:

- normalização conservadora e idempotente de quebras de linha;
- remoção registrada de controles ASCII proibidos, zero-width e controles bidirecionais;
- detecção explicável de tentativas de override de instruções, papéis privilegiados, manipulação de campos, esquema e política;
- decisão explícita `allow`, `review` ou `reject`;
- retorno com `text`, `findings`, `changes`, `source_reference` e `policy_version`.

O núcleo é determinístico, não depende de Flask, banco, rede ou OpenAI e pode ser testado isoladamente.

## Adaptador EnterOS

Arquivo: `src/backend/services/prompt_injection_adapter.py`

Responsabilidades:

- aplicar o núcleo sobre o texto consolidado enviado à extração;
- aplicar o núcleo sobre o lote real de documentos enviado à classificação;
- bloquear o envio automático ao modelo quando a decisão for `review` ou `reject`;
- transformar falhas do sanitizer em bloqueio explícito, sem enviar texto bruto.

## Integração no fluxo real

Arquivo: `src/backend/services/extraction_service.py`

Pontos protegidos:

- `StructuredExtractionService.extract(...)`
- `StructuredExtractionService.classify_documents(...)`

Comportamento:

- `allow`: o texto tratado segue para o modelo.
- `review` ou `reject`: o texto não é enviado ao modelo; o fluxo cai no fallback local já existente.
- falha do sanitizer: o texto também não é enviado ao modelo; o fallback local é usado.
- resposta do modelo: validada localmente contra o esquema real antes do uso.

## Testes

Framework adotado: `unittest` da biblioteca padrão, porque o repositório não tinha suíte prévia.

Arquivos:

- `tests/test_prompt_injection_sanitizer.py`
- `tests/test_extraction_service_integration.py`

Coberturas implementadas:

- preservação de português, valores e linguagem jurídica legítima;
- conteúdo adversarial fictício;
- Unicode invisível e controles bidirecionais;
- limites explícitos;
- determinismo e idempotência;
- integração com mocks do cliente OpenAI;
- bloqueio do envio automático em `review`, `reject` e falha do sanitizer;
- validação de saída por esquema.

## Comandos

Rodar os testes:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

Rodar apenas a suíte do sanitizer:

```bash
python3 -m unittest tests.test_prompt_injection_sanitizer
```

Rodar apenas a integração do serviço:

```bash
python3 -m unittest tests.test_extraction_service_integration
```

Avaliação real com documentos fictícios de controle e variante adversarial:

```bash
OPENAI_API_KEY=... python3 -m src.backend.run_prompt_injection_real_eval
```

## Limitações atuais

- Não há OCR/visão; logo, conteúdo só presente em imagem não é inspecionado.
- As regras são heurísticas e explicáveis; elas reduzem risco, mas não provam ausência de ataque.
- A avaliação contra modelo real foi preparada com fixtures fictícias, mas depende de rede e chave válidas para execução.
