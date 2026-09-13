import { FormEvent, useEffect, useState } from 'react'
import homeFilledIcon from '../assets/home-filled.svg'
import {
  type PendingItem,
  type DashboardSection,
  type LoginOptionId,
} from '../data/dashboard'
import { extractedFieldLabels, subsidyCatalog } from '../data/pipeline'
import {
  analyzeProcess,
  createProcess,
  deleteProcess,
  downloadProcessExport,
  finalizeProcess,
  listProcesses,
  type LegalProcess,
  updateProcess,
  uploadProcessDocuments,
} from '../lib/api'

type LawyerConfirmationChoice = '' | 'seguir_algoritmo' | 'seguir_outra_estrategia'
type StrategyOption = 'defesa' | 'acordo'
type FinalAcceptanceStatus = '' | 'aceito' | 'nao_aceito'

type MainDashboardProps = {
  activeSection: DashboardSection['id']
  onLogout: () => void
  onSectionSelect: (sectionId: DashboardSection['id']) => void
  role: LoginOptionId
  sections: readonly DashboardSection[]
}

type ChartDatum = {
  label: string
  shortLabel?: string
  value: number
}

type InsightMetricCard = {
  label: string
  value: string
  description: string
  impact: string
  supportingLabel: string
  tone: 'emerald' | 'cyan' | 'amber' | 'violet'
}

type InsightChartPoint = {
  title: string
  shortLabel: string
  value: number
  secondaryValue: string
}

type InsightChartSeries = {
  label: string
  colorClassName: string
  lineStyle?: 'solid' | 'dashed'
  points: InsightChartPoint[]
}

type EmployeeInsightsSnapshot = {
  metrics: InsightMetricCard[]
  chart: {
    title: string
    description: string
    spotlight: string
    series: InsightChartSeries[]
  }
}

const EXECUTIVE_INSIGHTS_FIXTURE = {
  cliente: 'Banco Cliente S/A',
  plataforma: 'ENTER',
  periodo: '2026_Q4',
  resumo_kpis: {
    perdas_evitadas_total_brl: 1640000,
    perdas_evitadas_q4_brl: 650000,
    crescimento_roi_pct: 35,
    taxa_exito_atual_pct: 87.4,
    baseline_historico_pct: 55,
    gap_de_valor_pct: 32.4,
    taxa_acordo_pct: 42.1,
    adesao_plataforma_pct: 94.2,
    casos_seguidos_q4: 1507,
    total_casos_q4: 1600,
    predatorias_bloqueadas_total: 129,
  },
  grafico_evolucao_trimestral: [
    {
      trimestre: 'Q1',
      processos: 1250,
      saved_losses_brl: 180000,
      exito_com_enter_pct: 74,
      baseline_sem_enter_pct: 55,
      adesao_plataforma_pct: 82,
      taxa_acordo_pct: 31,
      predatorias_bloqueadas: 34,
    },
    {
      trimestre: 'Q2',
      processos: 1480,
      saved_losses_brl: 320000,
      exito_com_enter_pct: 79.5,
      baseline_sem_enter_pct: 55,
      adesao_plataforma_pct: 88.5,
      taxa_acordo_pct: 36.2,
      predatorias_bloqueadas: 42,
    },
    {
      trimestre: 'Q3',
      processos: 1310,
      saved_losses_brl: 490000,
      exito_com_enter_pct: 82.8,
      baseline_sem_enter_pct: 55,
      adesao_plataforma_pct: 91.2,
      taxa_acordo_pct: 39,
      predatorias_bloqueadas: 28,
    },
    {
      trimestre: 'Q4',
      processos: 1600,
      saved_losses_brl: 650000,
      exito_com_enter_pct: 87.4,
      baseline_sem_enter_pct: 55,
      adesao_plataforma_pct: 94.2,
      taxa_acordo_pct: 42.1,
      predatorias_bloqueadas: 25,
    },
  ],
} as const

const statusLabels: Record<string, string> = {
  criado: 'Criado',
  documentos_recebidos: 'Documentos recebidos',
  processado: 'Processado',
  recusado_prompt_injection: 'Defesa por prompt injection aplicada',
}

const analysisStateLabels: Record<string, string> = {
  nao_iniciada: 'Análise nao iniciada',
  recusado_prompt_injection: 'Defesa por prompt injection aplicada',
  recomendacao_gerada: 'Recomendaçao gerada',
  resposta_definitiva: 'Resposta definitiva enviada',
}

export function MainDashboard(props: MainDashboardProps) {
  if (props.role === 'lawyer') {
    return <LawyerPipelineDashboard onLogout={props.onLogout} />
  }

  return <EmployeeDashboard {...props} />
}

function EmployeeDashboard({
  activeSection,
  onLogout,
  onSectionSelect,
  role,
  sections,
}: MainDashboardProps) {
  const [processes, setProcesses] = useState<LegalProcess[]>([])
  const [casesError, setCasesError] = useState<string | null>(null)
  const visibleSections = sections.filter(
    (section) =>
      !['triage', 'policy', 'negotiation', 'subsidies', 'results'].includes(section.id),
  )
  const currentSection =
    visibleSections.find((section) => section.id === activeSection) ?? visibleSections[0]
  const roleLabel = role === 'employee' ? 'Funcionario da empresa' : 'Advogado externo'
  const pendingQueue = buildPendingQueue(processes)

  useEffect(() => {
    void loadProcesses()
  }, [])

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeSection)) {
      onSectionSelect('home')
    }
  }, [activeSection, onSectionSelect, visibleSections])

  async function loadProcesses() {
    try {
      const items = await listProcesses()
      setProcesses(items)
      setCasesError(null)
    } catch (loadError) {
      setCasesError(
        loadError instanceof Error ? loadError.message : 'Falha ao carregar os processos.',
      )
    }
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar__brand">
          <span className="brand-mark__icon" />
          <div>
            <strong>EnterOS</strong>
            <p>{roleLabel}</p>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Navegacao principal">
          {visibleSections.map((section) => {
            const isActive = section.id === activeSection

            return (
              <button
                key={section.id}
                type="button"
                className={`workspace-nav__item${isActive ? ' is-active' : ''}`}
                onClick={() => onSectionSelect(section.id)}
              >
                <img src={homeFilledIcon} alt="" aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="workspace-sidebar__footer">
          <button type="button" className="ghost-button" onClick={onLogout}>
            Trocar perfil
          </button>
        </div>
      </aside>

      <section className="workspace-main">
        <WorkspaceHeader heroTitle={currentSection.heroTitle} />

        <EmployeeOverview
          activeSection={activeSection}
          casesError={casesError}
          onCasesRefresh={loadProcesses}
          processes={processes}
          onSectionSelect={onSectionSelect}
          sections={visibleSections}
        />
      </section>

      <aside className="workspace-aside">
        <div className="pending-card">
          <div className="pending-card__header">
            <div>
              <p className="pending-card__eyebrow">Fila priorizada</p>
              <h2>Pendencias judiciais</h2>
            </div>
            <span className="pending-card__count">{pendingQueue.length} itens</span>
          </div>

          <div className="pending-list">
            {pendingQueue.length === 0 ? (
              <article className="pending-item">
                <div className="pending-item__row">
                  <strong>Sem pendencias</strong>
                  <span>Concluido</span>
                </div>
                <p>Nao ha processos pendentes no momento.</p>
                <small>Todos os casos atuais ja foram processados.</small>
              </article>
            ) : (
              pendingQueue.map((item) => (
                <PendingCard key={item.caseNumber} item={item} />
              ))
            )}
          </div>
        </div>
      </aside>
    </main>
  )
}

type OverviewProps = Pick<
  MainDashboardProps,
  'activeSection' | 'onSectionSelect' | 'sections'
> & {
  casesError: string | null
  onCasesRefresh: () => Promise<void>
  processes: LegalProcess[]
}

function EmployeeOverview({
  activeSection,
  casesError,
  onCasesRefresh,
  processes,
  onSectionSelect,
  sections,
}: OverviewProps) {
  const currentSection =
    sections.find((section) => section.id === activeSection) ?? sections[0]
  const metrics = buildEmployeeSectionMetrics(currentSection.id, processes)
  const focusChart = buildEmployeeFocusChart(currentSection.id, processes)

  if (currentSection.id === 'insights') {
    return <EmployeeInsightsView processes={processes} />
  }

  if (currentSection.id === 'cases') {
    return (
      <EmployeeCasesView
        casesError={casesError}
        onRefresh={onCasesRefresh}
        processes={processes}
      />
    )
  }

  if (currentSection.id === 'additional_analysis') {
    return (
      <EmployeeAdditionalAnalysisView
        casesError={casesError}
        onRefresh={onCasesRefresh}
        processes={processes}
      />
    )
  }

  return (
    <div className="workspace-content">
      <section className="metrics-grid" aria-label="Indicadores principais">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <div className="metric-card__top">
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
              <small>{metric.supportingLabel}</small>
            </div>
            <MiniChart data={metric.data} emphasis="high" />
            <p>{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="insights-grid">
        <article className="detail-card detail-card--wide">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Resumo operacional</span>
              <h2>{currentSection.label}</h2>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onSectionSelect(currentSection.id)}
            >
              Tela ativa
            </button>
          </div>

          <p>{currentSection.employeeNarrative}</p>

          <MiniChart data={focusChart} emphasis="high" size="expanded" />
        </article>

        <article className="detail-card">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Atalhos</span>
              <h2>Explorar telas</h2>
            </div>
          </div>

          <div className="shortcut-list">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`shortcut-card${section.id === activeSection ? ' is-active' : ''}`}
                onClick={() => onSectionSelect(section.id)}
              >
                <strong>{section.label}</strong>
                <span>{section.shortDescription}</span>
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function EmployeeAdditionalAnalysisView({
  casesError,
  onRefresh,
  processes,
}: {
  casesError: string | null
  onRefresh: () => Promise<void>
  processes: LegalProcess[]
}) {
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(processes[0]?.id ?? null)
  const [defenseOperationalCost, setDefenseOperationalCost] = useState('')
  const [agreementOperationalCost, setAgreementOperationalCost] = useState('')
  const [customAgreementValue, setCustomAgreementValue] = useState('')
  const selectedProcess =
    processes.find((process) => process.id === selectedProcessId) ?? processes[0] ?? null
  const intelligence = selectedProcess?.case_intelligence
  const modelPrediction = selectedProcess?.model_prediction
  const extractedClaimAmount = selectedProcess?.extracted_data?.valor_causa
  const claimAmount = modelPrediction?.claim_amount_brl ?? (
    typeof extractedClaimAmount === 'number' ? extractedClaimAmount : 0
  )
  const suggestedAgreement = modelPrediction?.agreement_amount_suggested ??
    intelligence?.expected_agreement_cost_brl ?? 0
  const currentAgreement = selectedProcess?.lawyer_confirmation?.proposed_agreement_amount ?? suggestedAgreement
  const defenseOperatingAmount = Math.max(parseAmountInput(defenseOperationalCost) ?? 0, 0)
  const agreementOperatingAmount = Math.max(parseAmountInput(agreementOperationalCost) ?? 0, 0)
  const customAgreementAmount = Math.max(parseAmountInput(customAgreementValue) ?? currentAgreement, 0)
  const defenseExposure = intelligence?.expected_defense_cost_brl ?? 0
  const scenarios = [
    {
      id: 'defesa',
      label: 'Defesa',
      description: 'Exposicao esperada caso a tese seja mantida, somada ao custo operacional informado.',
      predictedAmount: defenseExposure,
      operatingAmount: defenseOperatingAmount,
      totalAmount: defenseExposure + defenseOperatingAmount,
    },
    {
      id: 'acordo-sugerido',
      label: 'Acordo recomendado',
      description: 'Valor sugerido pelo modelo, acrescido do custo operacional da negociacao.',
      predictedAmount: suggestedAgreement,
      operatingAmount: agreementOperatingAmount,
      totalAmount: suggestedAgreement + agreementOperatingAmount,
    },
    {
      id: 'acordo-personalizado',
      label: 'Acordo personalizado',
      description: 'Cenario hipotetico com a proposta de acordo informada pelo usuario.',
      predictedAmount: customAgreementAmount,
      operatingAmount: agreementOperatingAmount,
      totalAmount: customAgreementAmount + agreementOperatingAmount,
    },
  ]
  const lowestCost = Math.min(...scenarios.map((scenario) => scenario.totalAmount))

  useEffect(() => {
    setSelectedProcessId((current) =>
      current && processes.some((process) => process.id === current) ? current : processes[0]?.id ?? null,
    )
  }, [processes])

  useEffect(() => {
    setDefenseOperationalCost('')
    setAgreementOperationalCost('')
    setCustomAgreementValue(currentAgreement > 0 ? String(currentAgreement) : '')
  }, [selectedProcess?.id, currentAgreement])

  return (
    <div className="workspace-content">
      <section className="cost-simulator-hero">
        <div>
          <span className="detail-card__eyebrow">Analise adicional</span>
          <h2>Simulador de custos e cenarios</h2>
          <p>
            Compare a exposicao financeira estimada para defesa com o acordo recomendado pelo modelo e
            uma proposta personalizada. Os cenarios nao alteram a recomendação registrada no processo.
          </p>
        </div>
        <div className="cost-simulator-hero__actions">
          <label htmlFor="additional-analysis-process">Processo analisado</label>
          <select
            id="additional-analysis-process"
            value={selectedProcess?.id ?? ''}
            onChange={(event) => setSelectedProcessId(event.target.value)}
            disabled={processes.length === 0}
          >
            {processes.length === 0 ? (
              <option value="">Nenhum processo disponivel</option>
            ) : (
              processes.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.name}
                </option>
              ))
            )}
          </select>
          <button type="button" className="ghost-button" onClick={() => void onRefresh()}>
            Atualizar dados
          </button>
        </div>
      </section>

      {casesError ? <p className="pipeline-alert pipeline-alert--error">{casesError}</p> : null}

      {!selectedProcess ? (
        <section className="detail-card">
          <p className="empty-state">Nenhum processo esta disponivel para analise documental.</p>
        </section>
      ) : !intelligence ? (
        <section className="detail-card">
          <span className="detail-card__eyebrow">Aguardando analise</span>
          <h2>Suba os arquivos do processo</h2>
          <p className="empty-state">
            O processo precisa de uma recomendação e de um risco juridico calculado antes de comparar os
            cenarios de custo.
          </p>
        </section>
      ) : (
        <>
          <section className="cost-forecast-grid" aria-label="Bases da previsao de custos">
            <article className="cost-forecast-card cost-forecast-card--claim">
              <span>Valor da causa</span>
              <strong>{formatCurrency(claimAmount)}</strong>
              <small>Base financeira usada para estimar a exposicao.</small>
            </article>
            <article className="cost-forecast-card">
              <span>Risco juridico</span>
              <strong>{formatPercentage(intelligence.legal_risk / 100)}</strong>
              <small>Risco ajustado pela qualidade das evidencias documentais.</small>
            </article>
            <article className="cost-forecast-card">
              <span>Recomendação vigente</span>
              <strong>{modelPrediction?.strategy?.toUpperCase() ?? 'EM REVISAO'}</strong>
              <small>
                {modelPrediction
                  ? `Chance de nao exito: ${formatPercentage(modelPrediction.probability_failure)}.`
                  : 'Sem probabilidade do modelo disponivel.'}
              </small>
            </article>
          </section>

          <section className="cost-input-card">
            <div className="cost-section-header">
              <div>
                <span className="detail-card__eyebrow">Parametros de cenario</span>
                <h2>Ajuste somente os custos que a plataforma ainda nao possui</h2>
              </div>
            </div>
            <div className="cost-input-grid">
              <label>
                Custo operacional da defesa (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  value={defenseOperationalCost}
                  onChange={(event) => setDefenseOperationalCost(event.target.value)}
                  placeholder="Ex.: 1.500,00"
                />
              </label>
              <label>
                Custo operacional do acordo (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  value={agreementOperationalCost}
                  onChange={(event) => setAgreementOperationalCost(event.target.value)}
                  placeholder="Ex.: 500,00"
                />
              </label>
              <label>
                Proposta personalizada de acordo (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  value={customAgreementValue}
                  onChange={(event) => setCustomAgreementValue(event.target.value)}
                  placeholder="Valor sugerido pelo modelo"
                />
              </label>
            </div>
            <p className="cost-input-card__note">
              Custos operacionais sao parametros de simulacao e nao sao gravados na decisão do advogado.
            </p>
          </section>

          <section className="cost-scenarios-card">
            <div className="cost-section-header">
              <div>
                <span className="detail-card__eyebrow">Possibilidades atuais</span>
                <h2>Comparacao financeira por estrategia</h2>
              </div>
              <span className="cost-scenarios-card__tag">Menor custo destacado</span>
            </div>
            <div className="cost-scenarios-grid">
              {scenarios.map((scenario) => {
                const isLowestCost = scenario.totalAmount === lowestCost
                const potentialSavings = Math.max(claimAmount - scenario.totalAmount, 0)

                return (
                  <article key={scenario.id} className={`cost-scenario${isLowestCost ? ' is-lowest-cost' : ''}`}>
                    <div className="cost-scenario__header">
                      <span>{scenario.label}</span>
                      {isLowestCost ? <small>Menor custo</small> : null}
                    </div>
                    <strong>{formatCurrency(scenario.totalAmount)}</strong>
                    <p>{scenario.description}</p>
                    <div className="cost-scenario__breakdown">
                      <span>Previsão atual <b>{formatCurrency(scenario.predictedAmount)}</b></span>
                      <span>Operacional <b>{formatCurrency(scenario.operatingAmount)}</b></span>
                      <span>Exposiçao evitada <b>{formatCurrency(potentialSavings)}</b></span>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="cost-method-card">
            <span className="detail-card__eyebrow">Como a previsao e calculada</span>
            <p>
              A defesa usa a exposicao esperada calculada pelo risco juridico e pelo valor da causa. O
              acordo recomendado usa o valor retornado pelo modelo. A proposta personalizada permite
              testar um novo valor, sem alterar a recomendacao automatica ou a decisão final.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function EmployeeInsightsView({ processes }: { processes: LegalProcess[] }) {
  const insights = buildEmployeeInsights(processes)

  return (
    <div className="workspace-content">
      <section className="executive-metrics-grid" aria-label="Metricas executivas">
        {insights.metrics.map((metric) => (
          <article
            key={metric.label}
            className={`metric-card executive-metric-card executive-metric-card--${metric.tone}`}
          >
            <div className="metric-card__top">
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
              <small>{metric.supportingLabel}</small>
            </div>

            <p>{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="executive-chart-card" aria-label="Evolucao dos insights">
        <div className="detail-card__header executive-chart-card__header">
          <div>
            <span className="detail-card__eyebrow">Impacto direto</span>
            <h2>{insights.chart.title}</h2>
          </div>
          <span className="detail-card__tag">{insights.chart.spotlight}</span>
        </div>

        <p>{insights.chart.description}</p>
        <ExecutiveLineChart series={insights.chart.series} />
      </section>
    </div>
  )
}

function EmployeeCasesView({
  casesError,
  onRefresh,
  processes,
}: {
  casesError: string | null
  onRefresh: () => Promise<void>
  processes: LegalProcess[]
}) {
  const caseSummaries = processes.map(buildCaseSummary)
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(processes[0]?.id ?? null)
  const createdSeries = buildRecentCreationsSeries(processes)
  const pipelineSeries = buildPipelineDistributionSeries(processes)
  const selectedProcess =
    processes.find((process) => process.id === selectedProcessId) ?? processes[0] ?? null
  const selectedSummary = selectedProcess ? buildCaseSummary(selectedProcess) : null

  useEffect(() => {
    setSelectedProcessId((current) =>
      current && processes.some((process) => process.id === current) ? current : processes[0]?.id ?? null,
    )
  }, [processes])

  return (
    <div className="workspace-content">
      <section className="metrics-grid" aria-label="Resumo de casos">
        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Total de processos</span>
              <strong>{processes.length}</strong>
            </div>
            <small>carteira sincronizada</small>
          </div>
          <MiniChart data={createdSeries} emphasis="high" />
          <p>Casos inseridos pelo advogado e disponiveis para acompanhamento do banco.</p>
        </article>

        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Pendentes</span>
              <strong>{caseSummaries.filter((item) => item.isPending).length}</strong>
            </div>
            <small>exigem proxima acao</small>
          </div>
          <MiniChart data={pipelineSeries} emphasis="high" />
          <p>Processos que ainda nao chegaram ao fim do pipeline ou dependem de revisao.</p>
        </article>
      </section>

      <section className="insights-grid">
        <article className="detail-card detail-card--wide">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Tela de casos</span>
              <h2>Andamento por processo</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => void onRefresh()}>
              Atualizar
            </button>
          </div>

          {casesError ? <p>{casesError}</p> : null}

          <div className="case-board">
            {caseSummaries.length === 0 ? (
              <article className="case-card case-card--empty">
                <strong>Nenhum processo encontrado</strong>
                <p>Os containers dos processos aparecerao aqui com o estado atual e a proxima etapa.</p>
              </article>
            ) : (
              caseSummaries.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`case-card case-card--button${item.id === selectedProcessId ? ' is-active' : ''}`}
                  onClick={() => setSelectedProcessId(item.id)}
                >
                  <div className="case-card__header">
                    <div>
                      <span className="detail-card__eyebrow">Container</span>
                      <h3>{`Processo ${String(index + 1).padStart(2, '0')}`}</h3>
                    </div>
                    <span className={`case-stage-badge${item.isPending ? ' is-pending' : ' is-complete'}`}>
                      {item.phaseLabel}
                    </span>
                  </div>

                  <div className="case-card__meta">
                    <span>Estado atual</span>
                    <strong>{item.currentStep}</strong>
                  </div>

                  <div className="case-card__meta">
                    <span>Proxima etapa</span>
                    <strong>{item.nextStep}</strong>
                  </div>

                  <div className="case-card__footer">
                    <span>{item.updatedLabel}</span>
                    <span>{item.statusLabel}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Detalhes</span>
              <h2>Visao do processo selecionado</h2>
            </div>
          </div>

          {!selectedProcess || !selectedSummary ? (
            <p>Selecione um container para abrir os dados especificos do processo.</p>
          ) : (
            <div className="lawyer-process-detail">
              <div className="lawyer-summary-block">
                <span>Estado atual</span>
                <strong>{selectedSummary.currentStep}</strong>
                <p>Proxima etapa: {selectedSummary.nextStep}</p>
              </div>

              <div className="lawyer-detail-grid">
                {buildLawyerProcessFacts(selectedProcess).map((item) => (
                  <article key={item.label} className="lawyer-detail-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <div className="lawyer-summary-block">
                <span>Recomendação consolidada</span>
                <strong>{selectedProcess.recommendation_summary ?? 'Análise ainda nao concluida.'}</strong>
                <p>{selectedSummary.updatedLabel}</p>
              </div>

              <div className="lawyer-summary-block">
                <span>Razões da decisão</span>
                {selectedProcess.decision_reasons.length === 0 ? (
                  <p>As razões da decisão aparecerao aqui depois que o pipeline concluir a análise.</p>
                ) : (
                  <div className="case-next-list">
                    {selectedProcess.decision_reasons.map((reason, index) => (
                      <article
                        key={`${selectedProcess.id}-reason-${index}`}
                        className="case-next-card case-next-card--reason"
                      >
                        <div className="case-next-card__header">
                          <strong>{getDecisionReasonTitle(reason, index)}</strong>
                        </div>
                        <p>{reason}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  )
}

function LawyerPipelineDashboard({ onLogout }: Pick<MainDashboardProps, 'onLogout'>) {
  const [processes, setProcesses] = useState<LegalProcess[]>([])
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'overview' | 'cases'>('overview')
  const [processName, setProcessName] = useState('')
  const [processNameDraft, setProcessNameDraft] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [finalResponseDraft, setFinalResponseDraft] = useState('')
  const [lastAutoFinalResponse, setLastAutoFinalResponse] = useState('')
  const [confirmationChoice, setConfirmationChoice] = useState<LawyerConfirmationChoice>('')
  const [alternativeStrategy, setAlternativeStrategy] = useState<StrategyOption>('defesa')
  const [finalAcceptanceStatus, setFinalAcceptanceStatus] = useState<FinalAcceptanceStatus>('')
  const [proposedAgreementValue, setProposedAgreementValue] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    void loadProcesses()
  }, [])

  async function loadProcesses() {
    try {
      const items = await listProcesses()
      setProcesses(items)
      setSelectedProcessId((current) =>
        current && items.some((process) => process.id === current) ? current : items[0]?.id ?? null,
      )
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar processos.')
    }
  }

  const selectedProcess =
    processes.find((process) => process.id === selectedProcessId) ?? processes[0] ?? null

  useEffect(() => {
    if (!selectedProcess) {
      setProcessNameDraft('')
      setFinalResponseDraft('')
      setLastAutoFinalResponse('')
      setConfirmationChoice('')
      setAlternativeStrategy('defesa')
      setFinalAcceptanceStatus('')
      setProposedAgreementValue('')
      return
    }

    const nextConfirmationChoice =
      (selectedProcess.lawyer_confirmation?.choice as LawyerConfirmationChoice | undefined) ?? ''
    const nextAlternativeStrategy =
      (selectedProcess.lawyer_confirmation?.final_strategy as StrategyOption | undefined) ??
      (selectedProcess.model_prediction?.strategy === 'acordo' ? 'acordo' : 'defesa')
    const nextFinalAcceptanceStatus =
      (selectedProcess.lawyer_confirmation?.final_acceptance_status as FinalAcceptanceStatus | undefined) ??
      ''
    const nextProposedAgreementValue =
      selectedProcess.lawyer_confirmation?.proposed_agreement_amount !== null &&
      selectedProcess.lawyer_confirmation?.proposed_agreement_amount !== undefined
        ? String(selectedProcess.lawyer_confirmation.proposed_agreement_amount)
        : selectedProcess.model_prediction?.agreement_amount_suggested !== null &&
            selectedProcess.model_prediction?.agreement_amount_suggested !== undefined
          ? String(selectedProcess.model_prediction.agreement_amount_suggested)
          : ''
    const nextCurrentFinalStrategy = getCurrentFinalStrategy(
      selectedProcess,
      nextConfirmationChoice,
      nextAlternativeStrategy,
    )
    const nextLiveAgreementAmount =
      nextCurrentFinalStrategy === 'acordo' && nextProposedAgreementValue.trim()
        ? parseAmountInput(nextProposedAgreementValue)
        : null
    const nextDisplayedAgreementAmount = getDisplayedAgreementAmount(
      selectedProcess,
      nextLiveAgreementAmount,
    )
    const nextAutoFinalResponse = buildSuggestedFinalResponse(
      selectedProcess,
      nextCurrentFinalStrategy,
      nextDisplayedAgreementAmount,
      nextConfirmationChoice,
      nextFinalAcceptanceStatus,
    )

    setProcessNameDraft(selectedProcess.name)
    setFinalResponseDraft(selectedProcess.final_response ?? nextAutoFinalResponse)
    setLastAutoFinalResponse(nextAutoFinalResponse)
    setConfirmationChoice(nextConfirmationChoice)
    setAlternativeStrategy(nextAlternativeStrategy)
    setFinalAcceptanceStatus(nextFinalAcceptanceStatus)
    setProposedAgreementValue(nextProposedAgreementValue)
  }, [selectedProcess])

  useEffect(() => {
    if (!selectedProcess) {
      return
    }

    const currentFinalStrategy = getCurrentFinalStrategy(
      selectedProcess,
      confirmationChoice,
      alternativeStrategy,
    )
    const liveAgreementAmount =
      currentFinalStrategy === 'acordo' && proposedAgreementValue.trim()
        ? parseAmountInput(proposedAgreementValue)
        : null
    const displayedAgreementAmount = getDisplayedAgreementAmount(
      selectedProcess,
      liveAgreementAmount,
    )
    const nextAutoFinalResponse = buildSuggestedFinalResponse(
      selectedProcess,
      currentFinalStrategy,
      displayedAgreementAmount,
      confirmationChoice,
      finalAcceptanceStatus,
    )

    if (nextAutoFinalResponse === lastAutoFinalResponse) {
      return
    }

    setFinalResponseDraft((current) =>
      current === lastAutoFinalResponse ? nextAutoFinalResponse : current,
    )
    setLastAutoFinalResponse(nextAutoFinalResponse)
  }, [
    selectedProcess,
    confirmationChoice,
    alternativeStrategy,
    finalAcceptanceStatus,
    proposedAgreementValue,
    lastAutoFinalResponse,
  ])

  function replaceProcess(updated: LegalProcess) {
    setProcesses((current) => {
      const remaining = current.filter((process) => process.id !== updated.id)
      return [updated, ...remaining]
    })
    setSelectedProcessId(updated.id)
  }

  function removeProcess(processId: string) {
    const remaining = processes.filter((process) => process.id !== processId)
    setProcesses(remaining)
    setSelectedProcessId((current) => (current === processId ? remaining[0]?.id ?? null : current))
  }

  async function handleCreateProcess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!processName.trim()) {
      setError('Informe um nome para o processo.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const created = await createProcess(processName.trim())
      replaceProcess(created)
      setProcessName('')
      setActiveView('overview')
      setFeedback('Processo criado com sucesso. Agora voce ja pode anexar os PDFs.')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Falha ao criar o processo.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleUploadDocuments() {
    if (!selectedProcess || pendingFiles.length === 0) {
      setError('Selecione um processo e escolha ao menos um arquivo PDF.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const updated = await uploadProcessDocuments(selectedProcess.id, pendingFiles)
      replaceProcess(updated)
      setPendingFiles([])
      setFeedback('Arquivos enviados. Rode o pipeline para validar os arquivos e gerar a analise.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Falha ao enviar documentos.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleAnalyzeProcess() {
    if (!selectedProcess) {
      setError('Crie um processo antes de rodar o pipeline.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const updated = await analyzeProcess(selectedProcess.id)
      replaceProcess(updated)
      setActiveView('cases')
      setFeedback(
        hasRejectedPromptInjection(updated)
          ? 'Defesa por prompt injection aplicada. Nenhuma recomendacao juridica ou proposta de acordo foi gerada.'
          : 'Pipeline concluido. A recomendacao e as razoes da analise foram atualizadas.',
      )
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error ? analyzeError.message : 'Falha ao executar o pipeline.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function handleFinalizeProcess() {
    if (!selectedProcess) {
      setError('Selecione um processo para registrar a resposta definitiva.')
      return
    }
    if (!confirmationChoice) {
      setError('Confirme se o advogado pretende seguir a recomendacao do algoritmo ou outra estrategia.')
      return
    }
    if (confirmationChoice === 'seguir_algoritmo' && !selectedProcess.model_prediction?.strategy) {
      setError('A recomendacao estruturada do algoritmo ainda nao esta disponivel para confirmacao.')
      return
    }
    if (!finalAcceptanceStatus) {
      setError('Informe se a decisão final do advogado foi aceita ou nao aceita.')
      return
    }
    const currentFinalStrategy = getCurrentFinalStrategy(
      selectedProcess,
      confirmationChoice,
      alternativeStrategy,
    )
    if (currentFinalStrategy === 'acordo' && !proposedAgreementValue.trim()) {
      setError('Informe o valor de acordo que deve seguir para a proposta final.')
      return
    }
    const parsedAgreementValue =
      currentFinalStrategy === 'acordo' ? Number(proposedAgreementValue.replace(',', '.')) : undefined
    if (
      currentFinalStrategy === 'acordo' &&
      (parsedAgreementValue === undefined || Number.isNaN(parsedAgreementValue) || parsedAgreementValue < 0)
    ) {
      setError('Informe um valor de acordo valido.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const updated = await finalizeProcess(selectedProcess.id, {
        final_response: finalResponseDraft.trim(),
        confirmation_choice: confirmationChoice,
        final_acceptance_status: finalAcceptanceStatus,
        final_strategy:
          confirmationChoice === 'seguir_outra_estrategia' ? alternativeStrategy : undefined,
        proposed_agreement_amount:
          currentFinalStrategy === 'acordo' && parsedAgreementValue !== undefined
            ? parsedAgreementValue
            : undefined,
      })
      replaceProcess(updated)
      setFeedback('Confirmacao do advogado e resposta definitiva registradas no processo.')
    } catch (finalizeError) {
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : 'Falha ao registrar a resposta definitiva.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function handleExport(format: 'json' | 'xlsx') {
    if (!selectedProcess) {
      setError('Nenhum processo selecionado para exportacao.')
      return
    }

    setError(null)
    setFeedback(null)

    try {
      await downloadProcessExport(selectedProcess.id, format)
      setFeedback(`Exportacao ${format.toUpperCase()} iniciada.`)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Falha ao exportar os dados.')
    }
  }

  async function handleUpdateProcessName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProcess) {
      setError('Selecione um processo para alterar o nome.')
      return
    }
    if (!processNameDraft.trim()) {
      setError('Informe um nome valido para o processo.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const updated = await updateProcess(selectedProcess.id, {
        name: processNameDraft.trim(),
      })
      replaceProcess(updated)
      setFeedback('Nome do processo atualizado com sucesso.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Falha ao atualizar o processo.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDeleteProcess() {
    if (!selectedProcess) {
      setError('Selecione um processo para excluir.')
      return
    }

    const confirmed = window.confirm(
      `Deseja realmente excluir o processo "${selectedProcess.name}"? Essa acao nao pode ser desfeita.`,
    )
    if (!confirmed) {
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      await deleteProcess(selectedProcess.id)
      removeProcess(selectedProcess.id)
      setFeedback('Processo excluido com sucesso.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir o processo.')
    } finally {
      setIsBusy(false)
    }
  }

  const processStatus = selectedProcess ? getProcessStatusLabel(selectedProcess) : 'Sem selecao'
  const lawyerHeader =
    activeView === 'overview'
      ? {
          heroTitle: 'Visao consolidada da operacao juridica',
          heroDescription:
            'Crie processos, suba PDFs e acompanhe o pipeline de extracao ate a recomendacao automatica.',
          tag: 'Dashboard central',
          sectionLabel: 'Inicio',
          roleLabel: 'Advogado externo',
        }
      : {
          heroTitle: 'Carteira de processos criados com leitura orientada por status',
          heroDescription:
            'Abra cada caso para revisar os dados principais, a recomendacao gerada e as razoes da decisão automatica.',
          tag: 'Tela de processos',
          sectionLabel: 'Processos',
          roleLabel: 'Advogado externo',
        }

  return (
    <main className="pipeline-shell">
      <aside className="pipeline-sidebar">
        <div className="workspace-sidebar__brand">
          <span className="brand-mark__icon" />
          <div>
            <strong>EnterOS</strong>
            <p>Advogado externo</p>
          </div>
        </div>

        <div className="pipeline-sidebar__block">
          <span className="pipeline-sidebar__eyebrow">Navegacao</span>
          <div className="pipeline-nav">
            <button
              type="button"
              className={`pipeline-nav__item${activeView === 'overview' ? ' is-active' : ''}`}
              onClick={() => setActiveView('overview')}
            >
              <strong>Operacao</strong>
              <span>Criar processo, subir PDFs e rodar pipeline</span>
            </button>
            <button
              type="button"
              className={`pipeline-nav__item${activeView === 'cases' ? ' is-active' : ''}`}
              onClick={() => setActiveView('cases')}
            >
              <strong>Processos</strong>
              <span>Revisar status, recomendacao e resposta final</span>
            </button>
          </div>
        </div>

        <button type="button" className="ghost-button" onClick={onLogout}>
          Trocar perfil
        </button>
      </aside>

      <section className="workspace-main pipeline-main">
        <WorkspaceHeader heroTitle={lawyerHeader.heroTitle} />

        {error ? <div className="pipeline-alert pipeline-alert--error">{error}</div> : null}
        {feedback ? <div className="pipeline-alert pipeline-alert--success">{feedback}</div> : null}

        {activeView === 'overview' ? (
          <LawyerOverviewScreen
            isBusy={isBusy}
            onAnalyze={handleAnalyzeProcess}
            onCreateProcess={handleCreateProcess}
            onExport={handleExport}
            onProcessNameChange={setProcessName}
            onSelectProcess={setSelectedProcessId}
            onUpload={handleUploadDocuments}
            pendingFiles={pendingFiles}
            processName={processName}
            processStatus={processStatus}
            processes={processes}
            selectedProcess={selectedProcess}
            setPendingFiles={setPendingFiles}
          />
        ) : (
          <LawyerProcessesScreen
            alternativeStrategy={alternativeStrategy}
            confirmationChoice={confirmationChoice}
            finalResponseDraft={finalResponseDraft}
            finalAcceptanceStatus={finalAcceptanceStatus}
            isBusy={isBusy}
            onFinalize={handleFinalizeProcess}
            onAlternativeStrategyChange={setAlternativeStrategy}
            onFinalAcceptanceStatusChange={setFinalAcceptanceStatus}
            onConfirmationChoiceChange={setConfirmationChoice}
            onDeleteProcess={handleDeleteProcess}
            onFinalResponseDraftChange={setFinalResponseDraft}
            onProcessNameDraftChange={setProcessNameDraft}
            onProposedAgreementValueChange={setProposedAgreementValue}
            onRefresh={loadProcesses}
            onSelectProcess={setSelectedProcessId}
            processes={processes}
            processNameDraft={processNameDraft}
            proposedAgreementValue={proposedAgreementValue}
            selectedProcess={selectedProcess}
            onUpdateProcessName={handleUpdateProcessName}
          />
        )}
      </section>
    </main>
  )
}

function LawyerOverviewScreen({
  isBusy,
  onAnalyze,
  onCreateProcess,
  onExport,
  onProcessNameChange,
  onSelectProcess,
  onUpload,
  pendingFiles,
  processName,
  processStatus,
  processes,
  selectedProcess,
  setPendingFiles,
}: {
  isBusy: boolean
  onAnalyze: () => Promise<void>
  onCreateProcess: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onExport: (format: 'json' | 'xlsx') => Promise<void>
  onProcessNameChange: (value: string) => void
  onSelectProcess: (processId: string) => void
  onUpload: () => Promise<void>
  pendingFiles: File[]
  processName: string
  processStatus: string
  processes: LegalProcess[]
  selectedProcess: LegalProcess | null
  setPendingFiles: (files: File[]) => void
}) {
  const recommendationReadyCount = processes.filter(
    (process) => process.analysis_state === 'recomendacao_gerada',
  ).length
  const pendingUploadCount = processes.filter((process) => process.document_count === 0).length
  const recentProcesses = processes.slice(0, 4)
  const createdSeries = buildRecentCreationsSeries(processes)
  const documentSeries = buildDocumentReadinessSeries(processes)
  const analysisSeries = buildAnalysisStateSeries(processes)

  return (
    <>
      <section className="metrics-grid" aria-label="Resumo do fluxo do advogado">
        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Processos criados</span>
              <strong>{processes.length}</strong>
            </div>
            <small>carteira atual</small>
          </div>
          <MiniChart data={createdSeries} emphasis="high" />
          <p>Todos os casos criados pelo advogado ficam disponiveis para upload, analise e revisao.</p>
        </article>

        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Sem documentos</span>
              <strong>{pendingUploadCount}</strong>
            </div>
            <small>aguardando PDFs</small>
          </div>
          <MiniChart data={documentSeries} emphasis="high" />
          <p>Casos que ainda precisam receber os autos e subsidios para entrar no pipeline.</p>
        </article>

        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Recomendacoes prontas</span>
              <strong>{recommendationReadyCount}</strong>
            </div>
            <small>aguardando revisao</small>
          </div>
          <MiniChart data={analysisSeries} emphasis="high" />
          <p>Processos cuja analise automatica ja gerou dados estruturados e racional de decisão.</p>
        </article>
      </section>

      <section className="pipeline-grid">
        <article className="pipeline-card">
          <div className="pipeline-card__header">
            <div>
              <span className="detail-card__eyebrow">Etapa 1</span>
              <h2>Criacao de processo</h2>
            </div>
            <span className="pipeline-card__tag">Entrada</span>
          </div>

          <form className="pipeline-form" onSubmit={onCreateProcess}>
            <label htmlFor="process-name">Nome do processo</label>
            <input
              id="process-name"
              value={processName}
              onChange={(event) => onProcessNameChange(event.target.value)}
              placeholder="Ex.: Jose Raimundo x Banco UFMG"
              disabled={isBusy}
              required
            />

            <button type="submit" className="submit-button" disabled={isBusy}>
              {isBusy ? 'Processando...' : 'Criar processo'}
            </button>
          </form>
        </article>

        <article className="pipeline-card">
          <div className="pipeline-card__header">
            <div>
              <span className="detail-card__eyebrow">Processos criados</span>
              <h2>Processos Recentes</h2>
            </div>
            <span className="pipeline-card__tag">{processes.length} registros</span>
          </div>

          <div className="process-list">
            {recentProcesses.length === 0 ? (
              <p className="empty-state">Nenhum processo criado ainda.</p>
            ) : (
              recentProcesses.map((process) => (
                <button
                  key={process.id}
                  type="button"
                  className={`process-list__item${process.id === selectedProcess?.id ? ' is-active' : ''}`}
                  onClick={() => onSelectProcess(process.id)}
                >
                  <strong>{process.name}</strong>
                  <span>{getAnalysisStateLabel(process.analysis_state)}</span>
                  <small>{process.document_count} documentos</small>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="pipeline-grid pipeline-grid--wide">
        <article className="pipeline-card">
          <div className="pipeline-card__header">
            <div>
              <span className="detail-card__eyebrow">Etapas 2 e 3</span>
              <h2>Insercao de PDFs e extracao</h2>
            </div>
            <span className="pipeline-card__tag">{processStatus}</span>
          </div>

          {selectedProcess ? (
            <>
              <div className="process-summary">
                <div>
                  <span>Processo selecionado</span>
                  <strong>{selectedProcess.name}</strong>
                </div>
                <div>
                  <span>Ultima atualizacao</span>
                  <strong>{formatDateTime(selectedProcess.updated_at)}</strong>
                </div>
              </div>

              <div className="pipeline-form">
                <label htmlFor="process-files">Arquivos PDF do processo</label>
                <input
                  id="process-files"
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(event) => setPendingFiles(Array.from(event.target.files ?? []))}
                  disabled={isBusy}
                />

                <div className="pipeline-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void onUpload()}
                    disabled={isBusy || pendingFiles.length === 0}
                  >
                    Enviar documentos
                  </button>
                  <button
                    type="button"
                    className="submit-button"
                    onClick={() => void onAnalyze()}
                    disabled={isBusy || selectedProcess.document_count === 0}
                  >
                    Rodar pipeline
                  </button>
                </div>
              </div>

              <div className="document-preview-list">
                {selectedProcess.documents.length === 0 ? (
                  <p className="empty-state">Anexe os autos e os subsidios para iniciar.</p>
                ) : (
                  selectedProcess.documents.map((document) => (
                    <article key={document.id} className="document-preview-card">
                      <strong>{document.filename}</strong>
                      {document.security_assessment ? <DocumentSecurityResult document={document} /> : null}
                    </article>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="empty-state">Crie um processo para habilitar a insercao dos PDFs.</p>
          )}
        </article>

        <article className="pipeline-card">
          <div className="pipeline-card__header">
            <div>
              <span className="detail-card__eyebrow">Campos extraidos</span>
              <h2>Dados estruturados</h2>
            </div>
          </div>

          {selectedProcess?.extracted_data ? (
            <div className="field-grid">
              {Object.entries(selectedProcess.extracted_data)
                .filter(([key]) => key !== 'fonte_extracao')
                .map(([key, value]) => (
                <article key={key} className="field-card">
                  <span>{extractedFieldLabels[key] ?? key}</span>
                  <strong>{formatValue(value)}</strong>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Os campos extraidos aparecerao aqui apos o processamento.</p>
          )}
        </article>
      </section>

      <section className="pipeline-grid pipeline-grid--wide">
        <article className="pipeline-card">
          <div className="pipeline-card__header">
            <div>
              <span className="detail-card__eyebrow">Etapa 4</span>
              <h2>Tabela de subsidios</h2>
            </div>
            <span className="pipeline-card__tag">0 / 1</span>
          </div>

          <div className="subsidy-grid">
            {subsidyCatalog.map((subsidy) => {
              const active = selectedProcess?.subsidies?.[subsidy.key] === 1

              return (
                <article key={subsidy.key} className={`subsidy-card${active ? ' is-active' : ''}`}>
                  <span>{subsidy.label}</span>
                  <strong>{active ? '1' : '0'}</strong>
                </article>
              )
            })}
          </div>
        </article>

        <article className="pipeline-card">
          <div className="pipeline-card__header">
            <div>
              <span className="detail-card__eyebrow">Etapa 5</span>
              <h2>Matriz de features</h2>
            </div>
            <span className="pipeline-card__tag">
              {selectedProcess?.feature_vector ? Object.keys(selectedProcess.feature_vector).length : 0} colunas
            </span>
          </div>

          {selectedProcess?.feature_vector ? (
            <>
              <div className="feature-table">
                {Object.entries(selectedProcess.feature_vector).map(([key, value]) => (
                  <div key={key} className="feature-table__row">
                    <span>{key}</span>
                    <strong>{formatValue(value)}</strong>
                  </div>
                ))}
              </div>

              <div className="pipeline-actions">
                <button type="button" className="ghost-button" onClick={() => void onExport('json')}>
                  Exportar JSON
                </button>
                <button type="button" className="submit-button" onClick={() => void onExport('xlsx')}>
                  Exportar XLSX
                </button>
              </div>
            </>
          ) : (
            <p className="empty-state">A matriz pronta para ML aparecera aqui apos a analise.</p>
          )}
        </article>
      </section>

      {selectedProcess?.processing_notes?.length ? (
        <section className="pipeline-card">
          <div className="pipeline-card__header">
            <div>
              <span className="detail-card__eyebrow">Observacoes</span>
              <h2>Notas do processamento</h2>
            </div>
          </div>

          <div className="notes-list">
            {selectedProcess.processing_notes.map((note, index) => (
              <p key={`${selectedProcess.id}-note-${index}`}>{note}</p>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

function DocumentSecurityPanel({
  documents,
}: {
  documents: LegalProcess['documents']
}) {
  const inspectedDocuments = documents.filter((document) => document.security_assessment)

  if (inspectedDocuments.length === 0) {
    return null
  }

  return (
    <section className="document-security-panel">
      <div className="document-security-panel__header">
        <div>
          <span className="detail-card__eyebrow">Prompt injection confirmado</span>
          <h3>Arquivos com tentativa identificada</h3>
        </div>
        <span className="pipeline-card__tag">{inspectedDocuments.length} arquivos avaliados</span>
      </div>
      <p className="document-security-panel__description">
        Apenas arquivos com prompt injection confirmado sao exibidos nesta lista.
      </p>
      <div className="document-security-panel__list">
        {inspectedDocuments.map((document) => (
          <article key={document.id} className="document-security-panel__item">
            <strong>{document.filename}</strong>
            <DocumentSecurityResult document={document} />
          </article>
        ))}
      </div>
    </section>
  )
}

function DocumentSecurityResult({
  document,
}: {
  document: LegalProcess['documents'][number]
}) {
  const assessment = document.security_assessment

  if (!assessment || assessment.decision !== 'reject') {
    return null
  }

  const status = getDocumentSecurityStatus()

  return (
    <div className={`document-security-result is-${assessment.decision}`}>
      <div className="document-security-result__header">
        <div>
          <span>{status.eyebrow}</span>
          <strong>{status.title}</strong>
        </div>
        <small>{assessment.finding_count} achados</small>
      </div>
      <p>{status.description}</p>

      {assessment.findings.length > 0 ? (
        <ul className="document-security-result__findings">
          {assessment.findings.map((finding, index) => (
            <li key={`${document.id}-${finding.rule_id}-${index}`}>
              <strong>{getSecurityFindingLabel(finding.rule_id)}</strong>
              <span>
                {finding.line_numbers.length > 0
                  ? `Linhas ${finding.line_numbers.join(', ')} do conteudo inspecionado.`
                  : 'Sinal identificado na verificacao consolidada do arquivo.'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {assessment.change_count > 0 ? (
        <small className="document-security-result__changes">
          {assessment.change_count} transformacoes de normalizacao registradas antes da verificacao.
        </small>
      ) : null}
    </div>
  )
}

function LawyerProcessesScreen({
  alternativeStrategy,
  confirmationChoice,
  finalResponseDraft,
  finalAcceptanceStatus,
  isBusy,
  onFinalize,
  onAlternativeStrategyChange,
  onFinalAcceptanceStatusChange,
  onConfirmationChoiceChange,
  onDeleteProcess,
  onFinalResponseDraftChange,
  onProcessNameDraftChange,
  onProposedAgreementValueChange,
  onRefresh,
  onSelectProcess,
  processes,
  processNameDraft,
  proposedAgreementValue,
  selectedProcess,
  onUpdateProcessName,
}: {
  alternativeStrategy: StrategyOption
  confirmationChoice: LawyerConfirmationChoice
  finalResponseDraft: string
  finalAcceptanceStatus: FinalAcceptanceStatus
  isBusy: boolean
  onFinalize: () => Promise<void>
  onAlternativeStrategyChange: (value: StrategyOption) => void
  onFinalAcceptanceStatusChange: (value: FinalAcceptanceStatus) => void
  onConfirmationChoiceChange: (value: LawyerConfirmationChoice) => void
  onDeleteProcess: () => Promise<void>
  onFinalResponseDraftChange: (value: string) => void
  onProcessNameDraftChange: (value: string) => void
  onProposedAgreementValueChange: (value: string) => void
  onRefresh: () => Promise<void>
  onSelectProcess: (processId: string) => void
  processes: LegalProcess[]
  processNameDraft: string
  proposedAgreementValue: string
  selectedProcess: LegalProcess | null
  onUpdateProcessName: (event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
  const recommendationReadyCount = processes.filter(
    (process) => process.analysis_state === 'recomendacao_gerada',
  ).length
  const finalResponseCount = processes.filter(
    (process) => process.analysis_state === 'resposta_definitiva',
  ).length
  const hasRejectedDocument = hasRejectedPromptInjection(selectedProcess)
  const selectedSummary = selectedProcess ? buildCaseSummary(selectedProcess) : null
  const createdSeries = buildRecentCreationsSeries(processes)
  const reviewSeries = buildAnalysisStateSeries(processes)
  const finalSeries = buildCompletionSeries(processes)
  const currentFinalStrategy = selectedProcess
    ? getCurrentFinalStrategy(selectedProcess, confirmationChoice, alternativeStrategy)
    : null
  const isAgreementFlow = currentFinalStrategy === 'acordo'
  const liveAgreementAmount =
    isAgreementFlow && proposedAgreementValue.trim()
      ? parseAmountInput(proposedAgreementValue)
      : null
  const displayedAgreementAmount = selectedProcess
    ? getDisplayedAgreementAmount(selectedProcess, liveAgreementAmount)
    : null
  const displayedRecommendationText = selectedProcess
    ? getDisplayedRecommendationText(
        selectedProcess,
        currentFinalStrategy,
        displayedAgreementAmount,
        confirmationChoice,
        finalAcceptanceStatus,
      )
    : null
  const spotlightStrategy = selectedProcess
    ? getDisplayedStrategy(selectedProcess, currentFinalStrategy)
    : null
  const canFinalizeProcess =
    Boolean(selectedProcess?.feature_vector) &&
    !hasRejectedDocument
  return (
    <>
      <section className="metrics-grid" aria-label="Resumo da carteira processual">
        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Carteira total</span>
              <strong>{processes.length}</strong>
            </div>
            <small>processos criados</small>
          </div>
          <MiniChart data={createdSeries} emphasis="high" />
          <p>Visualizacao consolidada de todos os casos que passaram pela criacao do processo.</p>
        </article>

        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Em revisao</span>
              <strong>{recommendationReadyCount}</strong>
            </div>
            <small>recomendacao pronta</small>
          </div>
          <MiniChart data={reviewSeries} emphasis="high" />
          <p>Casos cuja analise automatica ja terminou e aguardam a validacao do advogado.</p>
        </article>

        <article className="metric-card">
          <div className="metric-card__top">
            <div>
              <span>Finalizados</span>
              <strong>{finalResponseCount}</strong>
            </div>
            <small>resposta registrada</small>
          </div>
          <MiniChart data={finalSeries} emphasis="high" />
          <p>Processos em que o advogado ja consolidou a resposta definitiva na plataforma.</p>
        </article>
      </section>

      <section className="insights-grid lawyer-cases-layout">
        <article className="detail-card detail-card--wide">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Tela de processos</span>
              <h2>Containers dos processos criados</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => void onRefresh()}>
              Atualizar
            </button>
          </div>

          <div className="lawyer-process-board">
            {processes.length === 0 ? (
              <article className="case-card case-card--empty">
                <strong>Nenhum processo criado</strong>
                <p>Assim que um processo for criado e receber documentos, ele aparecera aqui como container clicavel.</p>
              </article>
            ) : (
              processes.map((process) => {
                const caseSummary = buildCaseSummary(process)

                return (
                  <button
                    key={process.id}
                    type="button"
                    className={`lawyer-process-card${process.id === selectedProcess?.id ? ' is-active' : ''}`}
                    onClick={() => onSelectProcess(process.id)}
                  >
                    <div className="lawyer-process-card__top">
                      <span className="detail-card__eyebrow">Processo</span>
                      <span className={`case-stage-badge${caseSummary.isPending ? ' is-pending' : ' is-complete'}`}>
                        {getAnalysisStateLabel(process.analysis_state)}
                      </span>
                    </div>
                    <strong>{process.name}</strong>
                    <p>{caseSummary.currentStep}</p>
                    <small>{caseSummary.caseNumber}</small>
                  </button>
                )
              })
            )}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Detalhe do processo</span>
              <h2>Dados principais e estado</h2>
            </div>
          </div>

          {!selectedProcess || !selectedSummary ? (
            <p>Selecione um processo para abrir os dados principais, o estado da analise e as razoes da decisão.</p>
          ) : (
            <div className="lawyer-process-detail">
              <section className="lawyer-summary-block lawyer-summary-block--form">
                <span>Gestao do processo</span>
                <form className="pipeline-form" onSubmit={onUpdateProcessName}>
                  <label htmlFor="edit-process-name">Nome do processo</label>
                  <input
                    id="edit-process-name"
                    value={processNameDraft}
                    onChange={(event) => onProcessNameDraftChange(event.target.value)}
                    placeholder="Atualize o nome exibido do processo"
                    disabled={isBusy}
                    required
                  />

                  <div className="pipeline-actions process-management-actions">
                    <button type="submit" className="submit-button" disabled={isBusy}>
                      {isBusy ? 'Salvando...' : 'Salvar alteracao'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button danger-button"
                      onClick={() => void onDeleteProcess()}
                      disabled={isBusy}
                    >
                      Excluir processo
                    </button>
                  </div>
                </form>
              </section>

              <div className="lawyer-process-detail__header">
                <strong>{selectedProcess.name}</strong>
                <div className="lawyer-status-row">
                  <span className="detail-card__tag">{selectedSummary.statusLabel}</span>
                  <span className="detail-card__tag">{getAnalysisStateLabel(selectedProcess.analysis_state)}</span>
                </div>
              </div>

              <div className="lawyer-detail-grid">
                {buildLawyerProcessFacts(selectedProcess).map((item) => (
                  <article key={item.label} className="lawyer-detail-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <div className="lawyer-summary-block">
                <span>Estado atual</span>
                <strong>{selectedSummary.currentStep}</strong>
                <p>Proxima etapa: {selectedSummary.nextStep}</p>
              </div>

              {selectedProcess.documents.length > 0 ? (
                <DocumentSecurityPanel documents={selectedProcess.documents} />
              ) : null}

              {selectedProcess.model_prediction ? (
                <section className="decision-spotlight">
                  <div className="decision-spotlight__hero">
                    <span className="decision-spotlight__eyebrow">Recomendacao principal</span>
                    <strong className={`decision-spotlight__title is-${spotlightStrategy ?? selectedProcess.model_prediction.strategy}`}>
                      {(spotlightStrategy ?? selectedProcess.model_prediction.strategy).toUpperCase()}
                    </strong>
                    <p>{displayedRecommendationText ?? 'A analise ainda nao foi iniciada para este processo.'}</p>
                  </div>

                  <div className="decision-spotlight__metrics">
                    <article className="decision-metric-card">
                      <span>Chance de exito</span>
                      <strong>{formatPercentage(selectedProcess.model_prediction.probability_success)}</strong>
                      <small>Threshold da politica: {formatPercentage(selectedProcess.model_prediction.threshold_success)}</small>
                    </article>
                    <article className="decision-metric-card">
                      <span>{selectedProcess.lawyer_confirmation ? 'Valor final de acordo' : 'Valor sugerido de acordo'}</span>
                      <strong>
                        {displayedAgreementAmount === null
                          ? 'Nao se aplica'
                          : formatCurrency(displayedAgreementAmount)}
                      </strong>
                      <small>
                        {displayedAgreementAmount === null
                          ? 'Recomendacao atual orienta defesa.'
                          : selectedProcess.lawyer_confirmation
                            ? 'Valor que sera considerado como referencia final do acordo.'
                            : 'O advogado pode editar esse valor na confirmacao.'}
                      </small>
                    </article>
                    <article className="decision-metric-card">
                      <span>Estrategia final em edicao</span>
                      <strong>{currentFinalStrategy ? currentFinalStrategy.toUpperCase() : 'PENDENTE'}</strong>
                      <small>
                        {selectedProcess.lawyer_confirmation
                          ? `Ultima confirmacao: ${buildConfirmationLabel(selectedProcess.lawyer_confirmation.choice)}`
                          : 'Aguardando escolha do advogado.'}
                      </small>
                    </article>
                  </div>
                </section>
              ) : hasRejectedDocument ? (
                <section className="decision-spotlight">
                  <div className="decision-spotlight__hero">
                    <span className="decision-spotlight__eyebrow">Encaminhamento por prompt injection</span>
                    <strong className="decision-spotlight__title is-defesa">DEFESA</strong>
                    <p>{selectedProcess.recommendation_summary}</p>
                  </div>
                  <div className="decision-spotlight__metrics">
                    <article className="decision-metric-card">
                      <span>Motivo da defesa</span>
                      <strong>Prompt injection</strong>
                      <small>O sanitizer identificou uma tentativa de fraude.</small>
                    </article>
                    <article className="decision-metric-card">
                      <span>Protecao aplicada</span>
                      <strong>Acordo bloqueado</strong>
                      <small>O documento sinalizado nao foi encaminhado para o modelo de ML.</small>
                    </article>
                  </div>
                </section>
              ) : (
                <div className="lawyer-summary-block">
                  <span>Recomendacao do algoritmo</span>
                  <strong>A analise ainda nao foi iniciada para este processo.</strong>
                  <p>Assim que o pipeline terminar, defesa ou acordo aparecerao em destaque aqui.</p>
                </div>
              )}

              <div className="lawyer-summary-block lawyer-summary-block--form">
                <span>Confirmacao do advogado</span>
                <strong>
                  {selectedProcess.lawyer_confirmation
                    ? buildConfirmationLabel(selectedProcess.lawyer_confirmation.choice)
                    : 'Escolha obrigatória antes de registrar a resposta definitiva.'}
                </strong>
                {selectedProcess.model_prediction ? (
                  <div className="decision-form">
                    <div className="decision-choice-grid">
                      <button
                        type="button"
                        className={`decision-choice-card${confirmationChoice === 'seguir_algoritmo' ? ' is-active' : ''}`}
                        onClick={() => onConfirmationChoiceChange('seguir_algoritmo')}
                        disabled={isBusy || !selectedProcess.feature_vector}
                      >
                        <span className="decision-choice-card__eyebrow">Seguir politica</span>
                        <strong>
                          Aplicar {selectedProcess.model_prediction.strategy.toUpperCase()}
                        </strong>
                        <p>Usa a recomendacao calculada pelo algoritmo e mantem a aderencia a politica.</p>
                      </button>

                      <button
                        type="button"
                        className={`decision-choice-card${confirmationChoice === 'seguir_outra_estrategia' ? ' is-active' : ''}`}
                        onClick={() => onConfirmationChoiceChange('seguir_outra_estrategia')}
                        disabled={isBusy || !selectedProcess.feature_vector}
                      >
                        <span className="decision-choice-card__eyebrow">Ajuste humano</span>
                        <strong>Escolher outra estrategia</strong>
                        <p>Permite divergir do algoritmo e registrar defesa ou acordo por criterio juridico.</p>
                      </button>
                    </div>

                    {confirmationChoice === 'seguir_outra_estrategia' ? (
                      <div className="strategy-pill-group" role="radiogroup" aria-label="Estrategia final">
                        {(['defesa', 'acordo'] as StrategyOption[]).map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`strategy-pill${alternativeStrategy === option ? ' is-active' : ''}`}
                            onClick={() => onAlternativeStrategyChange(option)}
                            disabled={isBusy || !selectedProcess.feature_vector}
                          >
                            {option.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {isAgreementFlow ? (
                      <div className="agreement-editor">
                        <div className="agreement-editor__header">
                          <div>
                            <span className="detail-card__eyebrow">Valor do acordo</span>
                            <h3>Proposta financeira do advogado</h3>
                          </div>
                          <span className="pipeline-card__tag">
                            Sugerido: {selectedProcess.model_prediction.agreement_amount_suggested === null
                              ? 'Nao informado'
                              : formatCurrency(selectedProcess.model_prediction.agreement_amount_suggested)}
                          </span>
                        </div>

                        <div className="agreement-editor__grid">
                          <article className="agreement-editor__card">
                            <span>Valor a registrar</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={proposedAgreementValue}
                              onChange={(event) => onProposedAgreementValueChange(event.target.value)}
                              placeholder="Ex.: 6500.00"
                              disabled={isBusy || !selectedProcess.feature_vector}
                            />
                            <small>O advogado pode manter a sugestao do algoritmo ou propor um novo valor.</small>
                          </article>

                          <article className="agreement-editor__card">
                            <span>Leitura rapida</span>
                            <strong>
                              {proposedAgreementValue.trim()
                                ? formatCurrency(Number(proposedAgreementValue.replace(',', '.')) || 0)
                                : 'Preencha o valor'}
                            </strong>
                            <small>
                              {selectedProcess.lawyer_confirmation?.proposed_agreement_amount !== null &&
                              selectedProcess.lawyer_confirmation?.proposed_agreement_amount !== undefined
                                ? `Ultimo valor salvo: ${formatCurrency(selectedProcess.lawyer_confirmation.proposed_agreement_amount)}`
                                : 'Nenhum valor final salvo ainda.'}
                            </small>
                          </article>
                        </div>
                      </div>
                    ) : null}

                    <div className="acceptance-panel">
                      <div className="acceptance-panel__header">
                        <span className="detail-card__eyebrow">Etapa final</span>
                        <h3>Aceitacao da decisão</h3>
                      </div>
                      <div className="decision-choice-grid">
                        <button
                          type="button"
                          className={`decision-choice-card${finalAcceptanceStatus === 'aceito' ? ' is-active' : ''}`}
                          onClick={() => onFinalAcceptanceStatusChange('aceito')}
                          disabled={isBusy || !selectedProcess.feature_vector}
                        >
                          <span className="decision-choice-card__eyebrow">Conclusao</span>
                          <strong>Aceitar decisão final</strong>
                          <p>Registra que o advogado concluiu e aprovou a estrategia final do caso.</p>
                        </button>

                        <button
                          type="button"
                          className={`decision-choice-card${finalAcceptanceStatus === 'nao_aceito' ? ' is-active' : ''}`}
                          onClick={() => onFinalAcceptanceStatusChange('nao_aceito')}
                          disabled={isBusy || !selectedProcess.feature_vector}
                        >
                          <span className="decision-choice-card__eyebrow">Rejeicao</span>
                          <strong>Nao aceitar decisão final</strong>
                          <p>Registra que a decisão foi negada e precisa de nova avaliacao ou tratativa.</p>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : hasRejectedDocument ? (
                  <p>
                    A confirmacao juridica foi desabilitada porque o pipeline aplicou defesa por prompt injection
                    apos identificar prompt injection.
                  </p>
                ) : (
                  <p>A confirmacao sera habilitada quando a recomendacao estruturada estiver pronta.</p>
                )}
                {selectedProcess.lawyer_confirmation ? (
                  <p>
                    Estrategia final registrada: {selectedProcess.lawyer_confirmation.final_strategy.toUpperCase()} em{' '}
                    {formatDateTime(selectedProcess.lawyer_confirmation.confirmed_at)}
                    {` com status ${buildAcceptanceLabel(selectedProcess.lawyer_confirmation.final_acceptance_status)} `}
                    {selectedProcess.lawyer_confirmation.proposed_agreement_amount !== null
                      ? ` com valor de ${formatCurrency(selectedProcess.lawyer_confirmation.proposed_agreement_amount)}.`
                      : '.'}
                  </p>
                ) : null}
              </div>

              <div className="lawyer-summary-block">
                <span>Razões da decisão</span>
                {selectedProcess.decision_reasons.length === 0 ? (
                  <p>As razões aparecerao aqui depois que o pipeline concluir a analise automatica.</p>
                ) : (
                  <div className="lawyer-reason-list">
                    {selectedProcess.decision_reasons.map((reason, index) => (
                      <article key={`${selectedProcess.id}-reason-${index}`} className="lawyer-reason-card">
                        <div className="case-next-card__header">
                          <strong>{getDecisionReasonTitle(reason, index)}</strong>
                        </div>
                        <p>{reason}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="pipeline-form">
                <label htmlFor="final-response">Resposta definitiva do advogado</label>
                <textarea
                  id="final-response"
                  className="pipeline-textarea"
                  value={finalResponseDraft}
                  onChange={(event) => onFinalResponseDraftChange(event.target.value)}
                  placeholder="Escreva a conclusao juridica final do caso."
                  disabled={isBusy || !canFinalizeProcess}
                />

                <button
                  type="button"
                  className="submit-button"
                  onClick={() => void onFinalize()}
                  disabled={isBusy || !canFinalizeProcess}
                >
                  {selectedProcess.analysis_state === 'resposta_definitiva'
                    ? 'Atualizar resposta definitiva'
                    : selectedProcess.analysis_state === 'recusado_prompt_injection'
                      ? 'Defesa por prompt injection aplicada'
                    : 'Registrar resposta definitiva'}
                </button>
              </div>
            </div>
          )}
        </article>
      </section>
    </>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function WorkspaceHeader({ heroTitle }: { heroTitle: string }) {
  return (
    <header className="workspace-header">
      <div className="workspace-header__main">
        <span className="workspace-header__accent" aria-hidden="true" />
        <div>
          <p className="workspace-header__eyebrow">Tela principal</p>
          <h1 className="titleColor">Boas-vindas</h1>
          <span>{heroTitle}</span>
        </div>
      </div>
    </header>
  )
}

function getAnalysisStateLabel(state: string) {
  return analysisStateLabels[state] ?? state
}

function buildConfirmationLabel(choice: string) {
  if (choice === 'seguir_algoritmo') {
    return 'Advogado confirmou aderencia ao algoritmo'
  }
  if (choice === 'seguir_outra_estrategia') {
    return 'Advogado optou por outra estrategia'
  }
  return 'Confirmacao pendente'
}

function buildAcceptanceLabel(value: string) {
  if (value === 'aceito') {
    return 'aceito'
  }
  if (value === 'nao_aceito') {
    return 'nao aceito'
  }
  return 'pendente'
}

function getDocumentSecurityStatus() {
  return {
    eyebrow: 'Prompt injection confirmado',
    title: 'Tentativa de prompt injection identificada',
    description:
      'O pipeline aplicou defesa por prompt injection. Este arquivo nao foi encaminhado para ML ou proposta de acordo.',
  }
}

function getSecurityFindingLabel(ruleId: string) {
  const labels: Record<string, string> = {
    direct_instruction_override: 'Tentativa de ignorar instrucoes',
    assistant_targeted_override: 'Instrucao dirigida ao assistente ou modelo',
    privileged_role_spoofing: 'Simulacao de instrucao privilegiada',
    output_format_override: 'Tentativa de alterar o formato de retorno',
    field_tampering_instruction: 'Tentativa de alterar campos extraidos',
    policy_or_tool_override: 'Tentativa de alterar politicas ou filtros',
    invisible_or_bidi_controls: 'Caracteres invisiveis ou direcionais',
    disallowed_control_characters: 'Caracteres de controle nao permitidos',
    input_limit_exceeded: 'Limite de inspecao excedido',
    sanitizer_runtime_error: 'Falha operacional no sanitizer',
  }

  return labels[ruleId] ?? 'Sinal de prompt injection confirmado'
}

function getDecisionReasonTitle(reason: string, index: number) {
  const normalized = reason
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized.includes('foi classificado no assunto')) {
    return 'Classificacao do processo'
  }

  if (normalized.includes('leitura consolidada dos autos')) {
    return 'Leitura dos autos'
  }

  if (normalized.includes('motivo da defesa')) {
    return 'Motivo da defesa'
  }

  if (normalized.includes('protecao aplicada')) {
    return 'Protecao contra prompt injection'
  }

  if (normalized.includes('foram analisados') && normalized.includes('documentos')) {
    return 'Base documental analisada'
  }

  if (normalized.includes('modelo de ml estimou')) {
    return 'Estimativa do modelo'
  }

  if (normalized.includes('score financeiro ajustado') || normalized.includes('valor sugerido')) {
    return 'Parametro financeiro do acordo'
  }

  if (normalized.includes('valor da causa identificado')) {
    return 'Valor da causa'
  }

  if (normalized.includes('subsidios detectados')) {
    return 'Subsidios identificados'
  }

  if (normalized.includes('ainda nao foram localizados todos os subsidios')) {
    return 'Subsidios pendentes'
  }

  if (normalized.includes('advogado confirmou')) {
    return 'Confirmacao do advogado'
  }

  if (normalized.includes('advogado optou por nao seguir')) {
    return 'Divergencia da recomendacao'
  }

  if (normalized.includes('decisao do advogado foi marcada')) {
    return 'Aceite final da decisao'
  }

  if (normalized.includes('valor final informado pelo advogado')) {
    return 'Valor final informado'
  }

  return `Fundamento ${index + 1}`
}

function getEffectiveAgreementAmount(process: LegalProcess) {
  if (
    process.lawyer_confirmation?.proposed_agreement_amount !== null &&
    process.lawyer_confirmation?.proposed_agreement_amount !== undefined
  ) {
    return process.lawyer_confirmation.proposed_agreement_amount
  }

  if (
    process.model_prediction?.agreement_amount_suggested !== null &&
    process.model_prediction?.agreement_amount_suggested !== undefined
  ) {
    return process.model_prediction.agreement_amount_suggested
  }

  return null
}

function getDisplayedAgreementAmount(
  process: LegalProcess,
  liveAgreementAmount: number | null,
) {
  if (liveAgreementAmount !== null) {
    return liveAgreementAmount
  }

  return getEffectiveAgreementAmount(process)
}

function getDisplayedRecommendationText(
  process: LegalProcess,
  currentFinalStrategy: StrategyOption | null,
  displayedAgreementAmount: number | null,
  confirmationChoice: LawyerConfirmationChoice,
  finalAcceptanceStatus: FinalAcceptanceStatus,
) {
  return (
    buildSuggestedFinalResponse(
      process,
      currentFinalStrategy,
      displayedAgreementAmount,
      confirmationChoice,
      finalAcceptanceStatus,
    ) || null
  )
}

function parseAmountInput(value: string) {
  const normalized = value.trim().replace(/[R$\s]/g, '')

  if (!normalized) {
    return null
  }

  const decimalValue = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized
  const parsed = Number(decimalValue)
  return Number.isFinite(parsed) ? parsed : null
}

function buildSuggestedFinalResponse(
  process: LegalProcess,
  currentFinalStrategy: StrategyOption | null,
  displayedAgreementAmount: number | null,
  confirmationChoice: LawyerConfirmationChoice,
  finalAcceptanceStatus: FinalAcceptanceStatus,
) {
  if (currentFinalStrategy && (confirmationChoice || finalAcceptanceStatus)) {
    const adherenceLabel =
      confirmationChoice === 'seguir_algoritmo'
        ? 'seguindo a recomendacao do algoritmo'
        : confirmationChoice === 'seguir_outra_estrategia'
          ? 'divergindo da recomendacao do algoritmo'
          : 'em revisao pelo advogado'

    const acceptanceLabel =
      finalAcceptanceStatus === 'aceito'
        ? 'com decisao aceita'
        : finalAcceptanceStatus === 'nao_aceito'
          ? 'com decisao nao aceita'
          : 'aguardando aceite final'

    if (currentFinalStrategy === 'acordo' && displayedAgreementAmount !== null) {
      return `Decisão final em edicao: acordo, ${adherenceLabel}, ${acceptanceLabel}. Valor considerado: ${formatCurrency(displayedAgreementAmount)}.`
    }

    return `Decisao final em edicao: ${currentFinalStrategy}, ${adherenceLabel}, ${acceptanceLabel}.`
  }

  return process.recommendation_summary ?? process.final_response ?? ''
}

function getDisplayedStrategy(
  process: LegalProcess,
  currentFinalStrategy: StrategyOption | null,
) {
  if (process.lawyer_confirmation?.final_strategy) {
    return process.lawyer_confirmation.final_strategy as StrategyOption
  }

  if (currentFinalStrategy) {
    return currentFinalStrategy
  }

  if (process.model_prediction?.strategy === 'acordo' || process.model_prediction?.strategy === 'defesa') {
    return process.model_prediction.strategy as StrategyOption
  }

  return null
}

function getCurrentFinalStrategy(
  process: LegalProcess,
  confirmationChoice: LawyerConfirmationChoice,
  alternativeStrategy: StrategyOption,
) {
  if (confirmationChoice === 'seguir_algoritmo') {
    return process.model_prediction?.strategy === 'acordo' ? 'acordo' : process.model_prediction?.strategy === 'defesa' ? 'defesa' : null
  }

  if (confirmationChoice === 'seguir_outra_estrategia') {
    return alternativeStrategy
  }

  return process.lawyer_confirmation?.final_strategy === 'acordo'
    ? 'acordo'
    : process.lawyer_confirmation?.final_strategy === 'defesa'
      ? 'defesa'
      : null
}

function getProcessStatusLabel(process: LegalProcess) {
  const pipelineLabel = statusLabels[process.status] ?? process.status
  const analysisLabel = getAnalysisStateLabel(process.analysis_state)
  return `${pipelineLabel} • ${analysisLabel}`
}

function hasRejectedPromptInjection(process: LegalProcess | null | undefined) {
  return (
    process?.documents.some(
      (document) => document.security_assessment?.decision === 'reject',
    ) ?? false
  )
}

function buildLawyerProcessFacts(process: LegalProcess) {
  return [
    {
      label: 'Numero do processo',
      value: String(process.extracted_data?.numero_processo ?? 'Não identificado'),
    },
    {
      label: 'Autor',
      value: String(process.extracted_data?.nome_autor ?? 'Não identificado'),
    },
    {
      label: 'Reu',
      value: String(process.extracted_data?.nome_reu ?? 'Não identificado'),
    },
    {
      label: 'Assunto',
      value: String(process.extracted_data?.assunto ?? 'Não identificado'),
    },
    {
      label: 'Valor da causa',
      value:
        process.extracted_data?.valor_causa !== undefined
          ? formatValue(process.extracted_data.valor_causa)
          : 'Não identificado',
    },
    {
      label: 'Documentos enviados',
      value: String(process.document_count),
    },
    {
      label: 'Confirmacao do advogado',
      value: process.lawyer_confirmation
        ? process.lawyer_confirmation.final_strategy.toUpperCase()
        : 'Pendente',
    },
    {
      label: 'Aceitacao final',
      value: process.lawyer_confirmation
        ? buildAcceptanceLabel(process.lawyer_confirmation.final_acceptance_status)
        : 'Pendente',
    },
    {
      label: 'Valor final de acordo',
      value: getEffectiveAgreementAmount(process) !== null
        ? formatCurrency(getEffectiveAgreementAmount(process) ?? 0)
        : 'Nao se aplica',
    },
  ]
}

function buildCaseSummary(process: LegalProcess) {
  const caseNumber = String(process.extracted_data?.numero_processo ?? 'Nao identificado')
  const updatedLabel = `Atualizado em ${formatDateTime(process.updated_at)}`
  const statusMap: Record<
    string,
    {
      currentStep: string
      nextStep: string
      phaseLabel: string
      isPending: boolean
      statusLabel: string
    }
  > = {
    criado: {
      currentStep: 'Processo criado',
      nextStep: 'Aguardar insercao dos PDFs pelo advogado',
      phaseLabel: 'Pendente',
      isPending: true,
      statusLabel: 'Aguardando documentos',
    },
    documentos_recebidos: {
      currentStep: 'Ingestao concluida',
      nextStep: 'Executar extracao estruturada e pre-processamento',
      phaseLabel: 'Em andamento',
      isPending: true,
      statusLabel: 'Aguardando pipeline',
    },
    processado: {
      currentStep: 'Analise automatica concluida',
      nextStep:
        process.analysis_state === 'resposta_definitiva'
          ? 'Acompanhar os proximos movimentos processuais'
          : 'Revisar a recomendacao e registrar a resposta definitiva',
      phaseLabel:
        process.analysis_state === 'resposta_definitiva' ? 'Concluido' : 'Em revisao',
      isPending: process.analysis_state !== 'resposta_definitiva',
      statusLabel:
        process.analysis_state === 'resposta_definitiva'
          ? 'Resposta final registrada'
          : 'Recomendacao pronta',
    },
    recusado_prompt_injection: {
      currentStep: 'Defesa por prompt injection aplicada pelo pipeline',
      nextStep: 'Consultar o motivo da defesa e os achados de prompt injection',
      phaseLabel: 'Defesa por prompt injection',
      isPending: false,
      statusLabel: 'Defesa por prompt injection',
    },
  }
  const defaultStatus = {
    currentStep: 'Status em atualizacao',
    nextStep: 'Revisar andamento do caso',
    phaseLabel: 'Em andamento',
    isPending: true,
    statusLabel: process.status,
  }

  return {
    id: process.id,
    name: process.name,
    caseNumber,
    documentCount: process.document_count,
    updatedLabel,
    ...(statusMap[process.status] ?? defaultStatus),
  }
}

function buildPendingQueue(processes: LegalProcess[]): PendingItem[] {
  return processes
    .filter((process) => process.status !== 'processado' || process.analysis_state !== 'resposta_definitiva')
    .map((process) => {
      const caseSummary = buildCaseSummary(process)
      const isCritical =
        process.status === 'documentos_recebidos' || process.analysis_state === 'recomendacao_gerada'
      const priority: PendingItem['priority'] = isCritical ? 'critical' : 'medium'

      return {
        title: process.name,
        caseNumber: caseSummary.caseNumber,
        owner: caseSummary.nextStep,
        priority,
        priorityLabel:
          process.analysis_state === 'recomendacao_gerada'
            ? 'Aguardando resposta final'
            : isCritical
              ? 'Processos pendentes'
              : 'Aguardando documentos',
      }
    })
    .sort((left, right) => {
      const priorityWeight = { critical: 0, medium: 1, low: 2 }
      return priorityWeight[left.priority] - priorityWeight[right.priority]
    })
}

function buildEmployeeInsights(processes: LegalProcess[]): EmployeeInsightsSnapshot {
  void processes
  const fixture = EXECUTIVE_INSIGHTS_FIXTURE
  const summary = fixture.resumo_kpis
  const periods = fixture.grafico_evolucao_trimestral

  const metrics: InsightMetricCard[] = [
    {
      label: 'Perdas evitadas',
      value: formatCurrency(summary.perdas_evitadas_total_brl),
      description: `+ ${formatPercentage(summary.crescimento_roi_pct / 100)} vs. trimestre anterior.`,
      impact: '',
      supportingLabel: `${formatCurrency(summary.perdas_evitadas_q4_brl)} no Q4`,
      tone: 'cyan',
    },
    {
      label: 'Taxa de exito',
      value: formatPercentage(summary.taxa_exito_atual_pct / 100),
      description: `+ ${formatPercentage(summary.gap_de_valor_pct / 100)} vs. historico sem ENTER.`,
      impact: '',
      supportingLabel: `Baseline ${formatPercentage(summary.baseline_historico_pct / 100)}`,
      tone: 'emerald',
    },
    {
      label: 'Taxa de acordo',
      value: formatPercentage(summary.taxa_acordo_pct / 100),
      description: `${summary.predatorias_bloqueadas_total} casos predatorios bloqueados no ano.`,
      impact: '',
      supportingLabel: `${summary.total_casos_q4} processos no Q4`,
      tone: 'amber',
    },
    {
      label: 'Adesão a plataforma',
      value: formatPercentage(summary.adesao_plataforma_pct / 100),
      description: `${summary.casos_seguidos_q4.toLocaleString('pt-BR')} casos seguidos no trimestre.`,
      impact: '',
      supportingLabel: `${fixture.cliente} · ${fixture.periodo.replace('_', ' / ')}`,
      tone: 'violet',
    },
  ]

  return {
    metrics,
    chart: {
      title: 'Impacto direto',
      description:
        'A evolucao trimestral destaca a adesão a plataforma, o éxito jurídico e a linha de base histórica da operação.',
      spotlight: fixture.periodo.replace('_', ' / '),
      series: [
        {
          label: 'Adesão a recomendacao',
          colorClassName: 'is-cyan',
          points: periods.map((period) => ({
            title: `${period.trimestre} · ${formatValue(period.processos)} processos`,
            shortLabel: period.trimestre,
            value: period.adesao_plataforma_pct / 100,
            secondaryValue: `${formatCurrency(period.saved_losses_brl)} saved losses`,
          })),
        },
        {
          label: 'Éxito juridico',
          colorClassName: 'is-emerald',
          points: periods.map((period) => ({
            title: `${period.trimestre} · ${formatValue(period.processos)} processos`,
            shortLabel: period.trimestre,
            value: period.exito_com_enter_pct / 100,
            secondaryValue: `${period.predatorias_bloqueadas} predatorias bloqueadas`,
          })),
        },
        {
          label: 'Histórico sem Nosso Produto',
          colorClassName: 'is-rose',
          lineStyle: 'dashed',
          points: periods.map((period) => ({
            title: `${period.trimestre} · baseline`,
            shortLabel: period.trimestre,
            value: period.baseline_sem_enter_pct / 100,
            secondaryValue: `${formatPercentage(period.taxa_acordo_pct / 100)} de acordo`,
          })),
        },
      ],
    },
  }
}

function buildEmployeeSectionMetrics(
  sectionId: DashboardSection['id'],
  processes: LegalProcess[],
) {
  const pendingCount = processes.filter(
    (process) => process.status !== 'processado' || process.analysis_state !== 'resposta_definitiva',
  ).length
  const finalCount = processes.filter(
    (process) => process.analysis_state === 'resposta_definitiva',
  ).length
  const recommendationCount = processes.filter(
    (process) => process.analysis_state === 'recomendacao_gerada',
  ).length

  const sectionDescriptions: Record<
    DashboardSection['id'],
    [string, string, string]
  > = {
    home: [
      'Quantidade real de processos cadastrados e disponiveis na operacao.',
      'Fila atual que ainda exige acao do pipeline ou revisao juridica.',
      'Casos em que a resposta final do advogado ja foi consolidada.',
    ],
    insights: [
      'Base real de processos usada para consolidar os indicadores executivos.',
      'Carteira que ainda nao fechou o ciclo completo ou segue sob revisao.',
      'Casos com recomendacao ou resposta suficiente para alimentar os insights.',
    ],
    additional_analysis: [
      'Processos com analise concluida e dados suficientes para projetar custos.',
      'Casos que ainda precisam concluir o pipeline para habilitar a simulacao.',
      'Processos com recomendacao disponivel para comparar defesa e acordo.',
    ],
    cases: [
      'Volume real de casos sincronizados a partir da carteira processual.',
      'Processos que ainda dependem de proxima etapa operacional.',
      'Casos cuja recomendacao automatica ja esta pronta para revisao.',
    ],
    triage: [
      'Entradas reais cadastradas e aguardando evolucao no fluxo.',
      'Fila atual de casos que ainda nao foi concluida.',
      'Casos com recomendacao pronta para a revisao juridica.',
    ],
    policy: [
      'Base real de processos considerados para a politica de acordos.',
      'Casos que ainda dependem de definicao operacional ou juridica.',
      'Casos cuja resposta final ja foi registrada na plataforma.',
    ],
    negotiation: [
      'Carteira real que pode originar tratativas com a parte autora.',
      'Processos ainda em aberto antes da definicao final.',
      'Casos com recomendacao automatica disponivel para negociacao.',
    ],
    subsidies: [
      'Volume de processos com subsidios acompanhados na plataforma.',
      'Fila aberta de processos que ainda exigem complementacao ou revisao.',
      'Casos com recomendacao gerada usando os subsidios reconhecidos.',
    ],
    results: [
      'Base real usada para consolidar resultados da operacao.',
      'Pendencias que impedem o encerramento total da carteira.',
      'Casos encerrados com resposta definitiva registrada.',
    ],
  }

  const [createdDescription, pendingDescription, outcomeDescription] =
    sectionDescriptions[sectionId]

  return [
    {
      label: 'Processos criados',
      value: formatValue(processes.length),
      description: createdDescription,
      supportingLabel: 'ultimos 6 dias',
      data: buildRecentCreationsSeries(processes),
    },
    {
      label: 'Pendencias abertas',
      value: formatValue(pendingCount),
      description: pendingDescription,
      supportingLabel: 'situacao atual',
      data: buildPipelineDistributionSeries(processes),
    },
    {
      label: sectionId === 'results' ? 'Respostas finais' : 'Recomendacoes prontas',
      value: formatValue(sectionId === 'results' ? finalCount : recommendationCount),
      description: outcomeDescription,
      supportingLabel: sectionId === 'results' ? 'encerramento juridico' : 'analise automatica',
      data: sectionId === 'results' ? buildCompletionSeries(processes) : buildAnalysisStateSeries(processes),
    },
  ]
}

function buildEmployeeFocusChart(
  sectionId: DashboardSection['id'],
  processes: LegalProcess[],
) {
  if (sectionId === 'insights') {
    return buildCompletionSeries(processes)
  }

  if (sectionId === 'policy' || sectionId === 'results') {
    return buildAnalysisStateSeries(processes)
  }

  if (sectionId === 'subsidies') {
    return buildDocumentReadinessSeries(processes)
  }

  return buildPipelineDistributionSeries(processes)
}

function buildRecentCreationsSeries(processes: LegalProcess[]): ChartDatum[] {
  return buildDailySeries(processes, 'created_at')
}

function buildDailySeries(
  processes: LegalProcess[],
  field: 'created_at' | 'updated_at',
): ChartDatum[] {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
  const today = new Date()
  const days = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - (5 - index))
    return date
  })

  return days.map((day) => {
    const nextDay = new Date(day)
    nextDay.setDate(day.getDate() + 1)
    const value = processes.filter((process) => {
      const referenceDate = new Date(process[field])
      return referenceDate >= day && referenceDate < nextDay
    }).length

    return {
      label: formatter.format(day),
      shortLabel: formatter.format(day),
      value,
    }
  })
}

function buildPipelineDistributionSeries(processes: LegalProcess[]): ChartDatum[] {
  const waitingDocuments = processes.filter((process) => process.status === 'criado').length
  const waitingPipeline = processes.filter(
    (process) => process.status === 'documentos_recebidos',
  ).length
  const inReview = processes.filter(
    (process) => process.status === 'processado' && process.analysis_state !== 'resposta_definitiva',
  ).length
  const completed = processes.filter(
    (process) => process.analysis_state === 'resposta_definitiva',
  ).length

  return [
    { label: 'Aguardando documentos', shortLabel: 'Docs', value: waitingDocuments },
    { label: 'Aguardando pipeline', shortLabel: 'Pipeline', value: waitingPipeline },
    { label: 'Em revisao', shortLabel: 'Revisao', value: inReview },
    { label: 'Finalizados', shortLabel: 'Final', value: completed },
  ]
}

function buildDocumentReadinessSeries(processes: LegalProcess[]): ChartDatum[] {
  return [
    {
      label: 'Sem documentos',
      shortLabel: 'Sem',
      value: processes.filter((process) => process.document_count === 0).length,
    },
    {
      label: 'Com documentos',
      shortLabel: 'Com',
      value: processes.filter((process) => process.document_count > 0).length,
    },
    {
      label: 'Com subsidios',
      shortLabel: 'Subsidios',
      value: processes.filter((process) =>
        Object.values(process.subsidies).some((value) => value === 1),
      ).length,
    },
    {
      label: 'Prontos para exportar',
      shortLabel: 'Exportar',
      value: processes.filter((process) => process.feature_vector !== null).length,
    },
  ]
}

function buildAnalysisStateSeries(processes: LegalProcess[]): ChartDatum[] {
  return [
    {
      label: 'Analise nao iniciada',
      shortLabel: 'Inicial',
      value: processes.filter((process) => process.analysis_state === 'nao_iniciada').length,
    },
    {
      label: 'Recomendacao gerada',
      shortLabel: 'Recomend.',
      value: processes.filter((process) => process.analysis_state === 'recomendacao_gerada').length,
    },
    {
      label: 'Resposta definitiva',
      shortLabel: 'Final',
      value: processes.filter((process) => process.analysis_state === 'resposta_definitiva').length,
    },
  ]
}

function buildCompletionSeries(processes: LegalProcess[]): ChartDatum[] {
  const total = processes.length
  const finalCount = processes.filter(
    (process) => process.analysis_state === 'resposta_definitiva',
  ).length
  const recommendationCount = processes.filter(
    (process) => process.analysis_state === 'recomendacao_gerada',
  ).length

  return [
    { label: 'Total da carteira', shortLabel: 'Total', value: total },
    { label: 'Em revisao', shortLabel: 'Revisao', value: recommendationCount },
    { label: 'Finalizados', shortLabel: 'Final', value: finalCount },
  ]
}

function formatValue(value: string | number) {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return new Intl.NumberFormat('pt-BR').format(value)
    }

    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return value
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

function MiniChart({
  data,
  emphasis = 'medium',
  size = 'compact',
  valueFormatter,
}: {
  data: ChartDatum[]
  emphasis?: 'medium' | 'high'
  size?: 'compact' | 'expanded'
  valueFormatter?: (value: number) => string
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const safeData = data.length > 0 ? data : [{ label: 'Sem dados', shortLabel: 'Sem', value: 0 }]
  const maxValue = Math.max(...safeData.map((item) => item.value), 1)
  const defaultIndex = Math.max(
    safeData.findIndex((item) => item.value === Math.max(...safeData.map((entry) => entry.value))),
    0,
  )
  const clampedIndex = Math.min(hoveredIndex ?? defaultIndex, safeData.length - 1)
  const activeItem = safeData[clampedIndex]
  const formatter = valueFormatter ?? ((value: number) => formatValue(value))

  return (
    <div
      className={`mini-chart mini-chart--${emphasis} mini-chart--${size}`}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="mini-chart__summary">
        <strong>{formatter(activeItem.value)}</strong>
        <span>{activeItem.label}</span>
      </div>
      <div className="mini-chart__grid" />
      <div className="mini-chart__bars">
        {safeData.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            type="button"
            className={`mini-chart__bar${index === clampedIndex ? ' is-active' : ''}`}
            style={{ height: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
            aria-label={`${item.label}: ${formatter(item.value)}`}
          />
        ))}
      </div>
      <div className="mini-chart__labels">
        {safeData.map((item, index) => (
          <button
            key={`${item.label}-label-${index}`}
            type="button"
            className={`mini-chart__label${index === clampedIndex ? ' is-active' : ''}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
          >
            {item.shortLabel ?? item.label}
          </button>
        ))}
      </div>
      <div className="mini-chart__footer">
        <span>{formatter(0)}</span>
        <span>{formatter(maxValue)}</span>
      </div>
    </div>
  )
}

function ExecutiveLineChart({ series }: { series: InsightChartSeries[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const pointCount = series[0]?.points.length ?? 0
  const safePointCount = pointCount > 0 ? pointCount : 1
  const activeIndex = hoveredIndex ?? Math.max(safePointCount - 1, 0)
  const percentageValues = series.flatMap((item) => item.points.map((point) => point.value * 100))
  const rawMinValue = percentageValues.length > 0 ? Math.min(...percentageValues) : 0
  const rawMaxValue = percentageValues.length > 0 ? Math.max(...percentageValues) : 100
  const verticalPadding = Math.max((rawMaxValue - rawMinValue) * 0.2, 6)
  const minValue = Math.max(0, rawMinValue - verticalPadding)
  const maxValue = Math.min(100, rawMaxValue + verticalPadding)
  const valueRange = Math.max(maxValue - minValue, 1)
  const chartHeight = 240
  const chartWidth = 960
  const leftPadding = 28
  const rightPadding = 28
  const topPadding = 18
  const bottomPadding = 18
  const plotWidth = chartWidth - leftPadding - rightPadding
  const plotHeight = chartHeight - topPadding - bottomPadding
  const gridLines = Array.from({ length: 5 }, (_, index) => minValue + (valueRange / 4) * index)
  const activeLabel = series[0]?.points[activeIndex]?.title ?? 'Sem dados'

  return (
    <div className="executive-line-chart">
      <div className="executive-line-chart__legend">
        {series.map((item) => (
          <div key={item.label} className="executive-line-chart__legend-item">
            <span className={`executive-line-chart__legend-swatch ${item.colorClassName}`} />
            <strong>{item.label}</strong>
          </div>
        ))}
      </div>

      <div
        className="executive-line-chart__frame"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <div className="executive-line-chart__summary">
          <span>{activeLabel}</span>
          <div className="executive-line-chart__summary-values">
            {series.map((item) => (
              <article key={item.label} className="executive-line-chart__summary-card">
                <small>{item.label}</small>
                <strong>{formatPercentage(item.points[activeIndex]?.value ?? 0)}</strong>
                <span>{item.points[activeIndex]?.secondaryValue ?? 'Sem dados'}</span>
              </article>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="executive-line-chart__svg" aria-hidden="true">
          {gridLines.map((line) => {
            const progress = (line - minValue) / valueRange
            const y = chartHeight - bottomPadding - progress * plotHeight
            return (
              <line
                key={line}
                x1={leftPadding}
                y1={y}
                x2={chartWidth - rightPadding}
                y2={y}
                className="executive-line-chart__grid-line"
              />
            )
          })}

          {series.map((item) => {
            const points = item.points.map((point, index) => {
              const x =
                safePointCount === 1
                  ? chartWidth / 2
                  : leftPadding + (index / (safePointCount - 1)) * plotWidth
              const y =
                chartHeight -
                bottomPadding -
                (((point.value * 100) - minValue) / valueRange) * plotHeight
              return { x, y }
            })
            const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ')

            return (
              <g key={item.label} className={`executive-line-chart__series ${item.colorClassName}`}>
                <polyline
                  points={polylinePoints}
                  className={`executive-line-chart__line${item.lineStyle === 'dashed' ? ' is-dashed' : ''}`}
                />
                {points.map((point, index) => (
                  <circle
                    key={`${item.label}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={index === activeIndex ? 2.5 : 1.7}
                    className="executive-line-chart__point"
                  />
                ))}
              </g>
            )
          })}
        </svg>

        <div className="executive-line-chart__labels">
          {(series[0]?.points ?? []).map((point, index) => (
            <button
              key={`${point.title}-${index}`}
              type="button"
              className={`executive-line-chart__label${index === activeIndex ? ' is-active' : ''}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
            >
              {point.shortLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PendingCard({ item }: { item: PendingItem }) {
  return (
    <article className={`pending-item priority-${item.priority}`}>
      <div className="pending-item__row">
        <strong>{item.title}</strong>
        <span>{item.priorityLabel}</span>
      </div>
      <p>{item.caseNumber}</p>
      <small>{item.owner}</small>
    </article>
  )
}
