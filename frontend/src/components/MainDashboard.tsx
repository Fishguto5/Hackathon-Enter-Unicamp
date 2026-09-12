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
  downloadProcessExport,
  finalizeProcess,
  listProcesses,
  type LegalProcess,
  uploadProcessDocuments,
} from '../lib/api'

type MainDashboardProps = {
  activeSection: DashboardSection['id']
  onLogout: () => void
  onSectionSelect: (sectionId: DashboardSection['id']) => void
  role: LoginOptionId
  sections: readonly DashboardSection[]
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
  const metrics = sections.flatMap((section) => section.employeeMetrics)
  const currentSection =
    sections.find((section) => section.id === activeSection) ?? sections[0]

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
        {metrics.map((metric, index) => (
          <article key={metric.label} className="metric-card">
            <div className="metric-card__top">
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
              <small>{index % 2 === 0 ? 'ultimos 6 ciclos' : 'comparativo semanal'}</small>
            </div>
            <MiniChart values={metric.trend} emphasis="high" />
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

          <div className="trend-chart" aria-hidden="true">
            {currentSection.employeeTrend.map((height, index) => (
              <span
                key={`${currentSection.id}-${index}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
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
          <MiniChart values={[22, 34, 47, 52, 61, 74]} emphasis="high" />
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
          <MiniChart values={[64, 59, 54, 41, 38, 29]} emphasis="high" />
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [finalResponseDraft, setFinalResponseDraft] = useState('')
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
      setSelectedProcessId((current) => current ?? items[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar processos.')
    }
  }

  const selectedProcess =
    processes.find((process) => process.id === selectedProcessId) ?? processes[0] ?? null

  useEffect(() => {
    setFinalResponseDraft(
      selectedProcess?.final_response ?? selectedProcess?.recommendation_summary ?? '',
    )
  }, [selectedProcess])

  function replaceProcess(updated: LegalProcess) {
    setProcesses((current) => {
      const remaining = current.filter((process) => process.id !== updated.id)
      return [updated, ...remaining]
    })
    setSelectedProcessId(updated.id)
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

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const updated = await finalizeProcess(selectedProcess.id, finalResponseDraft.trim())
      replaceProcess(updated)
      setFeedback('Resposta definitiva registrada no processo.')
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
            finalResponseDraft={finalResponseDraft}
            isBusy={isBusy}
            onFinalize={handleFinalizeProcess}
            onFinalResponseDraftChange={setFinalResponseDraft}
            onRefresh={loadProcesses}
            onSelectProcess={setSelectedProcessId}
            processes={processes}
            selectedProcess={selectedProcess}
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
          <MiniChart values={[18, 26, 34, 48, 58, 72]} emphasis="high" />
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
          <MiniChart values={[66, 57, 49, 37, 28, 21]} emphasis="high" />
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
          <MiniChart values={[14, 24, 29, 43, 57, 68]} emphasis="high" />
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
  finalResponseDraft,
  isBusy,
  onFinalize,
  onFinalResponseDraftChange,
  onRefresh,
  onSelectProcess,
  processes,
  selectedProcess,
}: {
  finalResponseDraft: string
  isBusy: boolean
  onFinalize: () => Promise<void>
  onFinalResponseDraftChange: (value: string) => void
  onRefresh: () => Promise<void>
  onSelectProcess: (processId: string) => void
  processes: LegalProcess[]
  selectedProcess: LegalProcess | null
}) {
  const recommendationReadyCount = processes.filter(
    (process) => process.analysis_state === 'recomendacao_gerada',
  ).length
  const finalResponseCount = processes.filter(
    (process) => process.analysis_state === 'resposta_definitiva',
  ).length
  const selectedSummary = selectedProcess ? buildCaseSummary(selectedProcess) : null

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
          <MiniChart values={[18, 26, 34, 42, 56, 70]} emphasis="high" />
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
          <MiniChart values={[12, 19, 31, 44, 53, 64]} emphasis="high" />
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
          <MiniChart values={[8, 14, 25, 37, 46, 58]} emphasis="high" />
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

              <div className="lawyer-summary-block">
                <span>Recomendacao do algoritmo</span>
                <strong>
                  {selectedProcess.recommendation_summary ??
                    'A analise ainda nao foi iniciada para este processo.'}
                </strong>
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

function MiniChart({
  values,
  emphasis = 'medium',
}: {
  values: number[]
  emphasis?: 'medium' | 'high'
}) {
  return (
    <div className={`mini-chart mini-chart--${emphasis}`} aria-hidden="true">
      <div className="mini-chart__grid" />
      <div className="mini-chart__bars">
        {values.map((value, index) => (
          <span key={`${index}-${value}`} style={{ height: `${value}%` }} />
        ))}
      </div>
      <div className="mini-chart__footer">
        <span>0</span>
        <span>100</span>
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
