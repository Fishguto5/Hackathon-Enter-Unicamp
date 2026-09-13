import { FormEvent, useEffect, useState } from 'react'
import homeFilledIcon from '../assets/home-filled.svg'
import {
  type PendingItem,
  type DashboardSection,
  type LoginOptionId,
} from '../data/dashboard'
import {
  extractedFieldLabels,
  pipelineStages,
  subsidyCatalog,
} from '../data/pipeline'
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
}

type InsightSummaryCard = {
  eyebrow: string
  title: string
  description: string
  spotlight: string
  supportingStats: Array<{ label: string; value: string }>
}

type EmployeeInsightsSnapshot = {
  metrics: InsightMetricCard[]
  legalSummary: InsightSummaryCard
  financialSummary: InsightSummaryCard
}

const statusLabels: Record<string, string> = {
  criado: 'Criado',
  documentos_recebidos: 'Documentos recebidos',
  processado: 'Processado',
}

const analysisStateLabels: Record<string, string> = {
  nao_iniciada: 'Analise nao iniciada',
  recomendacao_gerada: 'Recomendacao gerada',
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
  const currentSection =
    sections.find((section) => section.id === activeSection) ?? sections[0]
  const roleLabel = role === 'employee' ? 'Funcionario da empresa' : 'Advogado externo'
  const pendingQueue = buildPendingQueue(processes)

  useEffect(() => {
    void loadProcesses()
  }, [])

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
          {sections.map((section) => {
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
        <WorkspaceHeader
          heroTitle={currentSection.heroTitle}
          heroDescription={currentSection.heroDescription}
          roleLabel={roleLabel}
          sectionLabel={currentSection.label}
          tag={currentSection.tag}
        />

        <EmployeeOverview
          activeSection={activeSection}
          casesError={casesError}
          onCasesRefresh={loadProcesses}
          processes={processes}
          onSectionSelect={onSectionSelect}
          sections={sections}
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

function EmployeeInsightsView({ processes }: { processes: LegalProcess[] }) {
  const insights = buildEmployeeInsights(processes)

  return (
    <div className="workspace-content">
      <section className="insights-panel-grid">
        <article className="detail-card detail-card--wide insight-hero-card insight-hero-card--legal">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">{insights.legalSummary.eyebrow}</span>
              <h2>{insights.legalSummary.title}</h2>
            </div>
            <span className="detail-card__tag">{insights.legalSummary.spotlight}</span>
          </div>

          <p>{insights.legalSummary.description}</p>

          <div className="insight-stat-strip">
            {insights.legalSummary.supportingStats.map((item) => (
              <article key={item.label} className="insight-stat-pill">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </article>

        <article className="detail-card insight-hero-card insight-hero-card--finance">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">{insights.financialSummary.eyebrow}</span>
              <h2>{insights.financialSummary.title}</h2>
            </div>
            <span className="detail-card__tag">{insights.financialSummary.spotlight}</span>
          </div>

          <p>{insights.financialSummary.description}</p>

          <div className="insight-stat-strip insight-stat-strip--stacked">
            {insights.financialSummary.supportingStats.map((item) => (
              <article key={item.label} className="insight-stat-pill">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="metrics-grid metrics-grid--insights" aria-label="Metricas executivas">
        {insights.metrics.map((metric) => (
          <article key={metric.label} className="metric-card insight-metric-card">
            <div className="metric-card__top">
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
              <small>{metric.supportingLabel}</small>
            </div>

            <p>{metric.description}</p>
            <div className="insight-impact-note">{metric.impact}</div>
          </article>
        ))}
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
  const createdSeries = buildRecentCreationsSeries(processes)
  const pipelineSeries = buildPipelineDistributionSeries(processes)

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
                <p>Os casos criados pelo advogado aparecerao aqui com status, fase atual e proxima etapa.</p>
              </article>
            ) : (
              caseSummaries.map((item) => (
                <article key={item.id} className="case-card">
                  <div className="case-card__header">
                    <div>
                      <span className="detail-card__eyebrow">Processo</span>
                      <h3>{item.name}</h3>
                    </div>
                    <span className={`case-stage-badge${item.isPending ? ' is-pending' : ' is-complete'}`}>
                      {item.phaseLabel}
                    </span>
                  </div>

                  <div className="case-card__meta">
                    <span>Numero do processo</span>
                    <strong>{item.caseNumber}</strong>
                  </div>

                  <div className="case-card__meta">
                    <span>Etapa atual</span>
                    <strong>{item.currentStep}</strong>
                  </div>

                  <div className="case-card__meta">
                    <span>Proxima etapa</span>
                    <strong>{item.nextStep}</strong>
                  </div>

                  <div className="case-card__meta">
                    <span>Documentos enviados</span>
                    <strong>{item.documentCount}</strong>
                  </div>

                  <div className="case-card__footer">
                    <span>{item.updatedLabel}</span>
                    <span>{item.statusLabel}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Pendencias</span>
              <h2>Proximas etapas</h2>
            </div>
          </div>

          <div className="case-next-list">
            {caseSummaries.filter((item) => item.isPending).length === 0 ? (
              <p>Todos os processos atuais ja passaram pelo pipeline principal.</p>
            ) : (
              caseSummaries
                .filter((item) => item.isPending)
                .map((item) => (
                  <article key={`${item.id}-next`} className="case-next-card">
                    <strong>{item.name}</strong>
                    <span>{item.nextStep}</span>
                  </article>
                ))
            )}
          </div>
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
      setFeedback('Arquivos enviados. O processo esta pronto para a extracao.')
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
      setFeedback('Pipeline concluido. A recomendacao e as razoes da analise foram atualizadas.')
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
      setError('Informe se a decisao final do advogado foi aceita ou nao aceita.')
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
  const recommendationReadyCount = processes.filter(
    (process) => process.analysis_state === 'recomendacao_gerada',
  ).length
  const finalResponseCount = processes.filter(
    (process) => process.analysis_state === 'resposta_definitiva',
  ).length
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
            'Abra cada caso para revisar os dados principais, a recomendacao gerada e as razoes da decisao automatica.',
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

        <div className="pipeline-sidebar__block">
          <span className="pipeline-sidebar__eyebrow">Fluxo do advogado</span>
          <div className="pipeline-stage-list">
            {pipelineStages.map((stage, index) => (
              <article key={stage.id} className="pipeline-stage-card">
                <strong>{index + 1}</strong>
                <div>
                  <span>{stage.title}</span>
                  <p>{stage.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="pipeline-sidebar__block">
          <span className="pipeline-sidebar__eyebrow">Resumo</span>
          <div className="pipeline-summary-chip">
            <strong>{processes.length}</strong>
            <span>processos em memoria</span>
          </div>
          <div className="pipeline-summary-chip">
            <strong>{recommendationReadyCount}</strong>
            <span>com recomendacao gerada</span>
          </div>
          <div className="pipeline-summary-chip">
            <strong>{finalResponseCount}</strong>
            <span>com resposta definitiva</span>
          </div>
        </div>

        <button type="button" className="ghost-button" onClick={onLogout}>
          Trocar perfil
        </button>
      </aside>

      <section className="workspace-main pipeline-main">
        <WorkspaceHeader
          heroTitle={lawyerHeader.heroTitle}
          heroDescription={lawyerHeader.heroDescription}
          roleLabel={lawyerHeader.roleLabel}
          sectionLabel={lawyerHeader.sectionLabel}
          tag={lawyerHeader.tag}
        />

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
          <p>Processos cuja analise automatica ja gerou dados estruturados e racional de decisao.</p>
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
              <h2>Fila ativa</h2>
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
            <span className="pipeline-card__tag">OpenAI</span>
          </div>

          {selectedProcess?.extracted_data ? (
            <div className="field-grid">
              {Object.entries(selectedProcess.extracted_data).map(([key, value]) => (
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
            <p>Selecione um processo para abrir os dados principais, o estado da analise e as razoes da decisao.</p>
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
                    : 'Escolha obrigatoria antes de registrar a resposta definitiva.'}
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
                        <h3>Aceitacao da decisao</h3>
                      </div>
                      <div className="decision-choice-grid">
                        <button
                          type="button"
                          className={`decision-choice-card${finalAcceptanceStatus === 'aceito' ? ' is-active' : ''}`}
                          onClick={() => onFinalAcceptanceStatusChange('aceito')}
                          disabled={isBusy || !selectedProcess.feature_vector}
                        >
                          <span className="decision-choice-card__eyebrow">Conclusao</span>
                          <strong>Aceitar decisao final</strong>
                          <p>Registra que o advogado concluiu e aprovou a estrategia final do caso.</p>
                        </button>

                        <button
                          type="button"
                          className={`decision-choice-card${finalAcceptanceStatus === 'nao_aceito' ? ' is-active' : ''}`}
                          onClick={() => onFinalAcceptanceStatusChange('nao_aceito')}
                          disabled={isBusy || !selectedProcess.feature_vector}
                        >
                          <span className="decision-choice-card__eyebrow">Rejeicao</span>
                          <strong>Nao aceitar decisao final</strong>
                          <p>Registra que a decisao foi negada e precisa de nova avaliacao ou tratativa.</p>
                        </button>
                      </div>
                    </div>
                  </div>
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
                <span>Razoes da decisao</span>
                {selectedProcess.decision_reasons.length === 0 ? (
                  <p>As razoes aparecerao aqui depois que o pipeline concluir a analise automatica.</p>
                ) : (
                  <div className="lawyer-reason-list">
                    {selectedProcess.decision_reasons.map((reason, index) => (
                      <article key={`${selectedProcess.id}-reason-${index}`} className="lawyer-reason-card">
                        {reason}
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
                  disabled={isBusy || !selectedProcess.feature_vector}
                />

                <button
                  type="button"
                  className="submit-button"
                  onClick={() => void onFinalize()}
                  disabled={isBusy || !selectedProcess.feature_vector}
                >
                  {selectedProcess.analysis_state === 'resposta_definitiva'
                    ? 'Atualizar resposta definitiva'
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

function WorkspaceHeader({
  heroTitle,
  heroDescription,
  roleLabel,
  sectionLabel,
  tag,
}: {
  heroTitle: string
  heroDescription: string
  roleLabel: string
  sectionLabel: string
  tag: string
}) {
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

      <div className="workspace-header__meta">
        <strong>{tag}</strong>
        <p>{heroDescription}</p>
        <div className="workspace-header__chips">
          <span>{roleLabel}</span>
          <span>{sectionLabel}</span>
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
  const parsed = Number(value.replace(',', '.'))
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
      return `Decisao final em edicao: acordo, ${adherenceLabel}, ${acceptanceLabel}. Valor considerado: ${formatCurrency(displayedAgreementAmount)}.`
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

function buildLawyerProcessFacts(process: LegalProcess) {
  return [
    {
      label: 'Numero do processo',
      value: String(process.extracted_data?.numero_processo ?? 'Nao identificado'),
    },
    {
      label: 'Autor',
      value: String(process.extracted_data?.nome_autor ?? 'Nao identificado'),
    },
    {
      label: 'Reu',
      value: String(process.extracted_data?.nome_reu ?? 'Nao identificado'),
    },
    {
      label: 'Assunto',
      value: String(process.extracted_data?.assunto ?? 'Nao identificado'),
    },
    {
      label: 'Valor da causa',
      value:
        process.extracted_data?.valor_causa !== undefined
          ? formatValue(process.extracted_data.valor_causa)
          : 'Nao identificado',
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
  const processesWithOutcome = processes.filter((process) => getProcessOutcomeForInsights(process) !== 'open')
  const victoryProcesses = processesWithOutcome.filter(
    (process) => getProcessOutcomeForInsights(process) === 'victory',
  )
  const agreementProcesses = processesWithOutcome.filter(
    (process) => getProcessOutcomeForInsights(process) === 'agreement',
  )
  const lossProcesses = processesWithOutcome.filter(
    (process) => getProcessOutcomeForInsights(process) === 'loss',
  )
  const closedCount = processesWithOutcome.length
  const agreementCount = agreementProcesses.length
  const victoryCount = victoryProcesses.length
  const lossCount = lossProcesses.length
  const successRate = closedCount > 0 ? victoryCount / closedCount : 0
  const agreementRate = closedCount > 0 ? agreementCount / closedCount : 0
  const savedLosses = processes.reduce(
    (total, process) => total + estimateSavedLosses(process),
    0,
  )
  const totalClaimExposure = processes.reduce((total, process) => {
    const claimAmount = getClaimAmount(process)
    return total + (claimAmount ?? 0)
  }, 0)
  const roiRate = totalClaimExposure > 0 ? savedLosses / totalClaimExposure : 0

  const overrideProcesses = processes.filter(
    (process) => process.lawyer_confirmation?.choice === 'seguir_outra_estrategia',
  )
  const positiveOverrides = overrideProcesses.filter(
    (process) => getOverrideAssessment(process) === 'positive',
  ).length
  const cautionOverrides = overrideProcesses.filter(
    (process) => getOverrideAssessment(process) === 'caution',
  ).length
  const neutralOverrides = overrideProcesses.filter(
    (process) => getOverrideAssessment(process) === 'neutral',
  ).length
  const overrideQuality =
    overrideProcesses.length > 0 ? positiveOverrides / overrideProcesses.length : 0
  const followedAlgorithmCount = processes.filter(
    (process) => process.lawyer_confirmation?.choice === 'seguir_algoritmo',
  ).length

  const metrics: InsightMetricCard[] = [
    {
      label: 'Taxa de exito',
      value: formatPercentage(successRate),
      description:
        'Percentual de processos com sinal de improcedencia ou extincao entre os casos com desfecho identificado.',
      impact:
        'Impacto direto: mostra a forca das teses defensivas e a blindagem da carteira contra litigancia predatoria.',
      supportingLabel: `${victoryCount} vitorias mapeadas`,
    },
    {
      label: 'Perdas evitadas',
      value: formatCurrency(savedLosses),
      description:
        'Soma estimada do valor preservado em pedidos rejeitados e em acordos fechados abaixo do valor da causa.',
      impact:
        'Impacto direto: traduz a operacao em ROI financeiro, indicando quanto deixou de sair do caixa do banco.',
      supportingLabel: `${formatPercentage(roiRate)} do risco capturado`,
    },
    {
      label: 'Taxa de acordo',
      value: formatPercentage(agreementRate),
      description:
        'Percentual de processos encerrados ou sinalizados como acordo dentro da base com desfecho identificado.',
      impact:
        'Impacto direto: mede reducao de passivo e capacidade de encerrar casos antes de custos prolongados.',
      supportingLabel: `${agreementCount} acordos identificados`,
    },
    {
      label: 'Qualidade dos overrides',
      value: formatPercentage(overrideQuality),
      description:
        'Leitura da qualidade das divergencias humanas quando o advogado nao segue a recomendacao da IA.',
      impact:
        'Impacto direto: reforca a governanca algoritmica ao evidenciar quando a intervencao humana agregou valor.',
      supportingLabel: `${overrideProcesses.length} overrides avaliados`,
    },
  ]

  return {
    metrics,
    legalSummary: {
      eyebrow: 'Eficiencia Juridica',
      title: 'Forca da tese defensiva e dos acordos na carteira',
      description:
        'Este bloco acompanha a distribuicao entre vitorias, acordos e perdas para mostrar se a politica juridica esta reduzindo litigiosidade e preservando caixa com criterio.',
      spotlight: `${closedCount} casos com desfecho`,
      supportingStats: [
        { label: 'Vitorias mapeadas', value: formatValue(victoryCount) },
        { label: 'Acordos mapeados', value: formatValue(agreementCount) },
        { label: 'Perdas ou risco', value: formatValue(lossCount) },
      ],
    },
    financialSummary: {
      eyebrow: 'Eficiencia Financeira & Algoritmica',
      title: 'Valor preservado e disciplina de governanca humano + IA',
      description:
        'Compara o valor economizado com o comportamento das decisoes humanas frente ao algoritmo, destacando quando a governanca manteve coerencia e quando exigiu maior atencao.',
      spotlight: `${formatPercentage(roiRate)} de ROI estimado`,
      supportingStats: [
        { label: 'Seguiram a IA', value: formatValue(followedAlgorithmCount) },
        { label: 'Overrides positivos', value: formatValue(positiveOverrides) },
        { label: 'Overrides sob atencao', value: formatValue(cautionOverrides + neutralOverrides) },
      ],
    },
  }
}

function getProcessOutcomeForInsights(process: LegalProcess) {
  const macro = normalizeText(process.extracted_data?.resultado_macro)
  const evidenceText = normalizeText(
    `${String(process.extracted_data?.resultado_micro ?? '')} ${process.final_response ?? ''} ${process.recommendation_summary ?? ''}`,
  )
  const finalStrategy = process.lawyer_confirmation?.final_strategy

  if (macro.includes('improced') || evidenceText.includes('improced')) {
    return 'victory' as const
  }

  if (macro.includes('extinc') || evidenceText.includes('extinc')) {
    return 'victory' as const
  }

  if (
    finalStrategy === 'acordo' ||
    macro.includes('acordo') ||
    evidenceText.includes('acordo') ||
    evidenceText.includes('concili')
  ) {
    return 'agreement' as const
  }

  if (macro.includes('proced') || evidenceText.includes('proced')) {
    return 'loss' as const
  }

  return 'open' as const
}

function estimateSavedLosses(process: LegalProcess) {
  const claimAmount = getClaimAmount(process)
  if (claimAmount === null || claimAmount <= 0) {
    return 0
  }

  const outcome = getProcessOutcomeForInsights(process)
  if (outcome === 'victory') {
    return claimAmount
  }

  if (outcome === 'agreement') {
    const agreementAmount = getEffectiveAgreementAmount(process)
    if (agreementAmount === null) {
      return 0
    }

    return Math.max(claimAmount - agreementAmount, 0)
  }

  return 0
}

function getOverrideAssessment(process: LegalProcess) {
  const lawyerConfirmation = process.lawyer_confirmation
  if (!lawyerConfirmation || lawyerConfirmation.choice !== 'seguir_outra_estrategia') {
    return 'neutral' as const
  }

  const outcome = getProcessOutcomeForInsights(process)
  const claimAmount = getClaimAmount(process)
  const agreementAmount = getEffectiveAgreementAmount(process)
  const successProbability = process.model_prediction?.probability_success ?? 0
  const threshold = process.model_prediction?.threshold_success ?? 0

  if (lawyerConfirmation.final_strategy === 'defesa') {
    if (outcome === 'victory' || successProbability >= Math.max(threshold - 0.08, 0)) {
      return 'positive' as const
    }

    return outcome === 'open' ? ('neutral' as const) : ('caution' as const)
  }

  if (lawyerConfirmation.final_strategy === 'acordo') {
    if (
      claimAmount !== null &&
      agreementAmount !== null &&
      agreementAmount > 0 &&
      agreementAmount <= claimAmount * 0.7
    ) {
      return 'positive' as const
    }

    if (outcome === 'agreement' && claimAmount !== null && agreementAmount !== null && agreementAmount < claimAmount) {
      return 'positive' as const
    }

    return outcome === 'open' ? ('neutral' as const) : ('caution' as const)
  }

  return 'neutral' as const
}

function getClaimAmount(process: LegalProcess) {
  const extractedValue = process.extracted_data?.valor_causa
  if (typeof extractedValue === 'number' && Number.isFinite(extractedValue)) {
    return extractedValue
  }

  if (typeof extractedValue === 'string') {
    const normalized = extractedValue
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  const predictedValue = process.model_prediction?.claim_amount_brl
  return typeof predictedValue === 'number' && Number.isFinite(predictedValue)
    ? predictedValue
    : null
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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
