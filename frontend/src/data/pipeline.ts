export type SubsidyKey =
  | 'contrato'
  | 'extrato'
  | 'comprovante_credito'
  | 'dossie'
  | 'evolucao_divida'
  | 'laudo_referenciado'

export const subsidyCatalog: ReadonlyArray<{ key: SubsidyKey; label: string }> = [
  { key: 'contrato', label: 'Contrato' },
  { key: 'extrato', label: 'Extrato' },
  { key: 'comprovante_credito', label: 'Comprovante de credito' },
  { key: 'dossie', label: 'Dossie' },
  { key: 'evolucao_divida', label: 'Evolucao da divida' },
  { key: 'laudo_referenciado', label: 'Laudo referenciado' },
]

export const extractedFieldLabels: Record<string, string> = {
  nome_autor: 'Nome de quem esta processando',
  nome_reu: 'Quem esta sendo processado',
  valor_causa: 'Valor da causa',
  assunto: 'Assunto',
  resultado_macro: 'Resultado macro',
  resultado_micro: 'Resultado micro',
  valor_condenacao: 'Valor da condenacao/indenizacao',
  numero_processo: 'Numero do processo',
  genero: 'Genero',
  resumo_analitico: 'Resumo analitico',
  fonte_extracao: 'Fonte da extracao',
}

export const pipelineStages = [
  {
    id: 'ingestao',
    title: 'Ingestao e OCR/Transcricao',
    description: 'Recebe PDFs, extrai texto e consolida o material do processo.',
  },
  {
    id: 'extracao',
    title: 'Extracao estruturada via LLM',
    description: 'Identifica os campos juridicos e organiza os subsidios.',
  },
  {
    id: 'tabela',
    title: 'Tabela de subsidios 0/1',
    description: 'Marca presenca ou ausencia dos documentos de defesa.',
  },
  {
    id: 'preprocessamento',
    title: 'Pre-processamento',
    description: 'Normaliza, codifica e gera a matriz pronta para ML.',
  },
  {
    id: 'exportacao',
    title: 'Exportacao em memoria',
    description: 'Disponibiliza JSON e XLSX para uso posterior.',
  },
] as const
