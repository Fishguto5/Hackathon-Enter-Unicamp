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
  { key: 'evolucao_divida', label: 'Demonstrativo de evolucao da divida' },
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
  numero_contrato: 'Numero do contrato',
  cpf: 'CPF',
  beneficio_inss: 'Beneficio INSS',
  uf_residencia: 'UF de residencia',
  conta_creditada: 'Conta creditada',
  data_contratacao: 'Data da contratacao',
  data_liberacao_credito: 'Data da liberacao do credito',
  canal_contratacao: 'Canal de contratacao',
  valor_liberado: 'Valor liberado',
  valor_parcela: 'Valor da parcela',
  quantidade_parcelas: 'Quantidade de parcelas',
  valor_total_pactuado: 'Valor total pactuado',
  saldo_devedor: 'Saldo devedor',
  parcelas_liquidadas: 'Parcelas liquidadas',
  valor_pedido_danos_morais: 'Pedido de danos morais',
  alegacao_fraude: 'Alegacao de fraude',
  negacao_contratacao: 'Negacao da contratacao',
  alegacao_conta_nao_pertencente: 'Alegacao de conta nao pertencente',
  pedido_restituicao: 'Pedido de restituicao',
  pedido_danos_morais: 'Pedido de danos morais identificado',
}

export const pipelineStages = [
  {
    id: 'process',
    title: 'Criacao de um processo',
    description: 'O advogado inicia um novo caso antes de anexar os PDFs.',
  },
  {
    id: 'upload',
    title: 'Insercao de diversos arquivos PDF',
    description: 'Autos e subsidios entram na mesma pasta logica do processo.',
  },
  {
    id: 'extraction',
    title: 'Extracao de dados com OpenAI',
    description: 'A API identifica partes, valores, assunto e resultado.',
  },
  {
    id: 'subsidies',
    title: 'Tabela de subsidios 0/1',
    description: 'Cada documento disponivel marca 1; ausencia marca 0.',
  },
  {
    id: 'preprocess',
    title: 'Matriz pronta para ML',
    description: 'Os dados saem higienizados para classificacao e exportacao.',
  },
] as const
