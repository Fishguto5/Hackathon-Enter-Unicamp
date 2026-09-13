export type LoginOptionId = 'lawyer' | 'employee'

export type LoginOption = {
  id: LoginOptionId
  label: string
  shortLabel: string
  description: string
}

type Metric = {
  label: string
  value: string
  description: string
  trend: number[]
}

type TaskItem = {
  title: string
  description: string
}

export type DashboardSectionId =
  | 'home'
  | 'insights'
  | 'cases'
  | 'triage'
  | 'policy'
  | 'negotiation'
  | 'subsidies'
  | 'results'

export type DashboardSection = {
  id: DashboardSectionId
  label: string
  shortDescription: string
  heroTitle: string
  heroDescription: string
  tag: string
  employeeMetrics: Metric[]
  employeeNarrative: string
  employeeTrend: number[]
  lawyerMetric: Metric
  lawyerNarrative: string
  lawyerTasks: TaskItem[]
}

export type PendingItem = {
  title: string
  caseNumber: string
  owner: string
  priority: 'critical' | 'medium' | 'low'
  priorityLabel: string
}

export const loginOptions: readonly LoginOption[] = [
  {
    id: 'lawyer',
    label: 'Advogado',
    shortLabel: 'Escritorio parceiro',
    description:
      'Cria processos, anexa PDFs e acompanha a extracao juridica estruturada do caso.',
  },
  {
    id: 'employee',
    label: 'Funcionario da empresa',
    shortLabel: 'Time Banco Unicamp',
    description:
      'Acompanha taxa de processos, economia com defesa e indicadores de aderencia da politica de acordos.',
  },
]

export const loginHighlights = [
  {
    title: 'Fluxo juridico com IA',
    description: 'Da ingestao dos autos ate a matriz pronta para classificacao em uma unica experiencia.',
  },
  {
    title: 'Operacao juridica centralizada',
    description: 'Perfis diferentes para advogado externo e time interno do banco, com contexto proprio.',
  },
]

export const dashboardSections: readonly DashboardSection[] = [
  {
    id: 'home',
    label: 'Inicio',
    shortDescription: 'Visao geral das frentes mais importantes do dia.',
    heroTitle: 'Visao consolidada da operacao juridica',
    heroDescription: 'Prioridades do dia, aderencia da politica e atalhos para navegar pela plataforma.',
    tag: 'Dashboard central',
    employeeMetrics: [
      {
        label: 'Taxa de processos elegiveis',
        value: '68%',
        description: 'Casos com documentacao suficiente para decidir entre defesa e acordo.',
        trend: [40, 48, 42, 55, 61, 68],
      },
      {
        label: 'Economia com defesa',
        value: 'R$ 2,4 mi',
        description: 'Valor total preservado ao optar por defesa nos casos com melhor lastro.',
        trend: [28, 31, 37, 44, 56, 63],
      },
    ],
    employeeNarrative:
      'A tela principal para funcionarios resume o comportamento da carteira e destaca ganhos financeiros, consistencia de decisao e gargalos da operacao.',
    employeeTrend: [38, 52, 45, 61, 58, 74],
    lawyerMetric: {
      label: 'Fila principal',
      value: '124 casos',
      description: 'Pendentes de triagem inicial ou atualizacao de estrategia.',
      trend: [56, 62, 59, 66, 72, 78],
    },
    lawyerNarrative:
      'Ao entrar, o advogado enxerga o mapa da operacao e pode abrir cada tela clicando no card correspondente do dashboard.',
    lawyerTasks: [
      {
        title: 'Triagem inicial',
        description: 'Revise distribuicoes recentes e confirme os documentos essenciais antes de decidir.',
      },
      {
        title: 'Prioridades criticas',
        description: 'Concentre a agenda nos casos com prazo processual curto e contato de acordo pendente.',
      },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    shortDescription: 'Impacto juridico, financeiro e governanca da carteira.',
    heroTitle: 'Leitura executiva da carteira com foco em resultado',
    heroDescription: 'Transforma os processos da base em indicadores de exito, perdas evitadas, acordos e overrides.',
    tag: 'Painel executivo',
    employeeMetrics: [
      {
        label: 'Taxa de exito',
        value: '0%',
        description: 'Percentual de vitorias mapeadas entre os casos com desfecho identificado.',
        trend: [0, 8, 12, 18, 24, 30],
      },
    ],
    employeeNarrative:
      'A tela de insights traduz a carteira processual em eficiencia juridica, economia projetada e qualidade da interacao entre time humano e recomendacao algoritmica.',
    employeeTrend: [8, 16, 24, 36, 44, 58],
    lawyerMetric: {
      label: 'Leitura da carteira',
      value: 'Insights do banco',
      description: 'Resumo executivo focado no impacto da operacao para a instituicao financeira.',
      trend: [10, 14, 21, 29, 38, 46],
    },
    lawyerNarrative:
      'Esta tela foi desenhada para o usuario interno do banco acompanhar resultado, risco e governanca da operacao.',
    lawyerTasks: [
      {
        title: 'Saude da carteira',
        description: 'Verifique a relacao entre vitorias, acordos e perdas em processos com desfecho identificado.',
      },
      {
        title: 'Governanca de override',
        description: 'Entenda quando a intervencao humana agregou valor frente a recomendacao da IA.',
      },
    ],
  },
  {
    id: 'cases',
    label: 'Casos',
    shortDescription: 'Acompanhamento individual dos processos recebidos.',
    heroTitle: 'Andamento de cada processo em uma visao operacional unica',
    heroDescription: 'Monitora fase atual, proximas etapas e pendencias para cada caso inserido pelo advogado.',
    tag: 'Carteira processual',
    employeeMetrics: [
      {
        label: 'Casos monitorados',
        value: '0',
        description: 'Processos recebidos do fluxo do advogado e acompanhados pelo banco.',
        trend: [18, 24, 33, 42, 51, 60],
      },
    ],
    employeeNarrative:
      'A tela de casos consolida o andamento real de cada processo, mostrando em que fase ele esta e qual a proxima acao necessaria.',
    employeeTrend: [22, 35, 44, 52, 61, 72],
    lawyerMetric: {
      label: 'Casos ativos',
      value: '0',
      description: 'Resumo da carteira em processamento pelo advogado.',
      trend: [20, 28, 34, 45, 54, 62],
    },
    lawyerNarrative:
      'Visao consolidada de processos ativos e do progresso do pipeline para cada caso.',
    lawyerTasks: [
      {
        title: 'Atualizar carteira',
        description: 'Garantir que os documentos do processo estejam completos e consistentes.',
      },
      {
        title: 'Concluir pendencias',
        description: 'Executar o pipeline dos processos ainda nao processados.',
      },
    ],
  },
  {
    id: 'triage',
    label: 'Analise inicial',
    shortDescription: 'Entrada dos autos e classificacao do caso.',
    heroTitle: 'Documentos, risco e contexto do processo em um unico ponto',
    heroDescription: 'Organiza autos e subsidios para acelerar a primeira recomendacao.',
    tag: 'Entrada da operacao',
    employeeMetrics: [
      {
        label: 'Casos triados no dia',
        value: '317',
        description: 'Volume processado pelo fluxo de leitura inicial e classificacao.',
        trend: [36, 41, 53, 58, 62, 70],
      },
    ],
    employeeNarrative:
      'A triagem permite enxergar o volume que entrou, quanto ja esta classificado e quais casos ainda aguardam subsidios.',
    employeeTrend: [22, 34, 47, 55, 63, 71],
    lawyerMetric: {
      label: 'Entradas do dia',
      value: '48 novas entradas',
      description: 'Casos aguardando leitura de autos e enquadramento no motivo de contestacao.',
      trend: [22, 34, 39, 44, 47, 52],
    },
    lawyerNarrative:
      'Aqui o advogado consegue saber rapidamente quantos processos novos precisam de leitura e qual contexto juridico predomina na fila.',
    lawyerTasks: [
      {
        title: 'Autos recebidos',
        description: 'Conferir peticao inicial, procuracao e extrato para identificar o tipo de alegacao.',
      },
      {
        title: 'Subsidios faltantes',
        description: 'Marcar casos em que o contrato ou comprovante de credito ainda nao foi anexado.',
      },
    ],
  },
  {
    id: 'policy',
    label: 'Politica de acordos',
    shortDescription: 'Regras para defesa ou proposta de acordo.',
    heroTitle: 'Consistencia da politica aplicada em toda a carteira',
    heroDescription: 'Mostra onde a decisao juridica aderiu ou desviou do racional esperado.',
    tag: 'Governanca',
    employeeMetrics: [
      {
        label: 'Aderencia a politica',
        value: '91%',
        description: 'Decisoes tomadas de acordo com as faixas de risco e de oferta definidas.',
        trend: [52, 58, 63, 72, 81, 91],
      },
    ],
    employeeNarrative:
      'A visao de governanca destaca onde a politica esta sendo seguida e onde ha espacamento entre recomendacao e decisao efetiva.',
    employeeTrend: [49, 56, 59, 66, 73, 91],
    lawyerMetric: {
      label: 'Desvios de politica',
      value: '12 alertas',
      description: 'Casos cuja estrategia sugerida exige justificativa antes do envio.',
      trend: [68, 59, 44, 36, 24, 18],
    },
    lawyerNarrative:
      'O card leva para a tela onde o advogado confirma se a recomendacao de acordo ou defesa esta aderente ao racional do banco.',
    lawyerTasks: [
      {
        title: 'Faixa de risco',
        description: 'Verificar se o caso possui elementos suficientes para propor acordo em vez de contestacao.',
      },
      {
        title: 'Justificativas abertas',
        description: 'Registrar desvios quando a estrategia sugerida nao fizer sentido para o caso concreto.',
      },
    ],
  },
  {
    id: 'negotiation',
    label: 'Negociacoes',
    shortDescription: 'Andamento das propostas de acordo com as partes.',
    heroTitle: 'Status das tratativas em tempo real',
    heroDescription: 'Centraliza propostas enviadas, contrapropostas e acordos em aprovacao.',
    tag: 'Relacao com a parte autora',
    employeeMetrics: [
      {
        label: 'Acordos em andamento',
        value: '146',
        description: 'Negociacoes abertas com retorno esperado nas proximas 48 horas.',
        trend: [26, 35, 42, 48, 59, 65],
      },
    ],
    employeeNarrative:
      'A tela mostra a temperatura das negociacoes e se a politica atual esta produzindo acordos mais baratos e rapidos.',
    employeeTrend: [31, 43, 40, 55, 62, 69],
    lawyerMetric: {
      label: 'Negociacoes ativas',
      value: '39 follow-ups',
      description: 'Contrapropostas e retornos pendentes para concluir tratativas.',
      trend: [18, 24, 31, 37, 42, 49],
    },
    lawyerNarrative:
      'Na rotina do advogado, esta pagina resume o que ja foi ofertado, o que precisa de retorno e o que escalou para nova decisao.',
    lawyerTasks: [
      {
        title: 'Propostas expirando',
        description: 'Revisar conversas sem resposta para evitar perda de timing na composicao.',
      },
      {
        title: 'Contrapropostas',
        description: 'Checar se a nova oferta segue o teto esperado pela politica.',
      },
    ],
  },
  {
    id: 'subsidies',
    label: 'Subsidios',
    shortDescription: 'Base documental enviada pelo banco.',
    heroTitle: 'Qualidade documental para sustentar a defesa',
    heroDescription: 'Monitora completude dos arquivos e impacto disso nas decisoes.',
    tag: 'Base de defesa',
    employeeMetrics: [
      {
        label: 'Subsidios completos',
        value: '84%',
        description: 'Casos com contrato, comprovante e historico bancario disponiveis.',
        trend: [44, 56, 61, 70, 76, 84],
      },
    ],
    employeeNarrative:
      'Quando a completude cai, a empresa perde previsibilidade. Esta visao ajuda a priorizar reforco documental com rapidez.',
    employeeTrend: [60, 64, 66, 72, 78, 84],
    lawyerMetric: {
      label: 'Pendencias documentais',
      value: '27 dossies',
      description: 'Pastas com documentos faltantes ou pendentes de validacao.',
      trend: [62, 55, 47, 38, 29, 25],
    },
    lawyerNarrative:
      'O advogado acessa essa tela para conferir se ha base suficiente para sustentar a defesa ou justificar uma proposta de acordo.',
    lawyerTasks: [
      {
        title: 'Comprovantes faltantes',
        description: 'Solicitar ao banco documentos essenciais antes da definicao final da estrategia.',
      },
      {
        title: 'Extratos conflitantes',
        description: 'Sinalizar casos em que a cronologia dos descontos ainda precisa de revisao.',
      },
    ],
  },
  {
    id: 'results',
    label: 'Resultados',
    shortDescription: 'Eficacia da politica e desempenho acumulado.',
    heroTitle: 'Leitura rapida do impacto financeiro e juridico',
    heroDescription: 'Compara volume encerrado, economia gerada e padrao de resposta do contencioso.',
    tag: 'Performance',
    employeeMetrics: [
      {
        label: 'Economia projetada',
        value: 'R$ 4,1 mi',
        description: 'Estimativa considerando defesa bem-sucedida e acordos abaixo do teto de risco.',
        trend: [24, 33, 45, 57, 69, 82],
      },
    ],
    employeeNarrative:
      'Resultados consolidados ajudam a avaliar se a politica escolhida realmente reduz desembolso e melhora a previsibilidade.',
    employeeTrend: [35, 39, 51, 57, 68, 82],
    lawyerMetric: {
      label: 'Encerramentos',
      value: '93 encerrados',
      description: 'Casos finalizados neste ciclo com estrategia registrada na plataforma.',
      trend: [19, 28, 37, 49, 68, 74],
    },
    lawyerNarrative:
      'O dashboard direciona o advogado para uma leitura sintetica do que foi concluido e do efeito das estrategias adotadas.',
    lawyerTasks: [
      {
        title: 'Casos finalizados',
        description: 'Atualizar desfechos para retroalimentar a leitura de risco e a politica futura.',
      },
      {
        title: 'Aprendizados',
        description: 'Identificar padroes de sucesso e derrota para calibrar as proximas decisoes.',
      },
    ],
  },
]

export const pendingItems: readonly PendingItem[] = [
  {
    title: 'Prazo de contestacao',
    caseNumber: 'Proc. 40219-88.2026.8.26.0100',
    owner: 'Responsavel: Escrit. Atlas',
    priority: 'critical',
    priorityLabel: 'Alta',
  },
  {
    title: 'Contraproposta acima do teto',
    caseNumber: 'Proc. 15502-13.2026.8.19.0001',
    owner: 'Responsavel: Time Banco Unicamp',
    priority: 'medium',
    priorityLabel: 'Media',
  },
  {
    title: 'Contrato ausente nos subsidios',
    caseNumber: 'Proc. 00091-22.2026.8.13.0400',
    owner: 'Responsavel: Escrit. Litoral',
    priority: 'critical',
    priorityLabel: 'Alta',
  },
  {
    title: 'Aguardando retorno da autora',
    caseNumber: 'Proc. 39844-21.2026.8.01.0001',
    owner: 'Responsavel: Operacao conciliacao',
    priority: 'low',
    priorityLabel: 'Baixa',
  },
]
