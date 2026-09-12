import { FormEvent, useEffect, useState } from 'react'
import type { LoginOptionId } from '../data/dashboard'
import {
  extractedFieldLabels,
  pipelineStages,
  subsidyCatalog,
} from '../data/pipeline'
import {
  analyzeProcess,
  createProcess,
  downloadProcessExport,
  listProcesses,
  type LegalProcess,
  uploadProcessDocuments,
} from '../lib/api'

type MainDashboardProps = {
  onLogout: () => void
  role: LoginOptionId
}

const statusLabels: Record<string, string> = {
  criado: 'Criado',
  documentos_recebidos: 'Documentos recebidos',
  processado: 'Processado',
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
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

export function MainDashboard({ onLogout, role }: MainDashboardProps) {
  const [processes, setProcesses] = useState<LegalProcess[]>([])
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null)
  const [processName, setProcessName] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function handleCreateProcess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!processName.trim()) {
      setError('Informe um nome para o novo processo.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const created = await createProcess(processName.trim())
      setProcesses((current) => [created, ...current])
      setSelectedProcessId(created.id)
      setProcessName('')
      setFeedback('Processo criado e pronto para receber PDFs.')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Falha ao criar processo.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleUploadDocuments() {
    if (!selectedProcess || pendingFiles.length === 0) {
      setError('Selecione um processo e escolha ao menos um PDF.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const updated = await uploadProcessDocuments(selectedProcess.id, pendingFiles)
      setProcesses((current) =>
        current.map((process) => (process.id === updated.id ? updated : process)),
      )
      setPendingFiles([])
      setFeedback('Arquivos recebidos. O processo ja pode ser analisado.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Falha no upload dos documentos.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleAnalyzeProcess() {
    if (!selectedProcess) {
      setError('Crie ou selecione um processo antes de processar.')
      return
    }

    setIsBusy(true)
    setError(null)
    setFeedback(null)

    try {
      const updated = await analyzeProcess(selectedProcess.id)
      setProcesses((current) =>
        current.map((process) => (process.id === updated.id ? updated : process)),
      )
      setFeedback('Pipeline executado com sucesso. A matriz esta pronta para ML.')
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error ? analyzeError.message : 'Falha ao executar o pipeline.',
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
      setError(downloadError instanceof Error ? downloadError.message : 'Falha ao exportar.')
    }
  }

  const processedCases = processes.filter((process) => process.status === 'processado').length
  const extractedRows = selectedProcess?.feature_vector
    ? Object.entries(selectedProcess.feature_vector)
    : []

  return (
    <main className="pipeline-shell">
      <aside className="pipeline-sidebar">
        <div className="workspace-sidebar__brand">
          <span className="brand-mark__icon" />
          <div>
            <strong>EnterOS</strong>
            <p>{role === 'employee' ? 'Funcionario da empresa' : 'Advogado externo'}</p>
          </div>
        </div>

        <div className="pipeline-sidebar__section">
          <span className="pipeline-sidebar__eyebrow">Workflow</span>
          {pipelineStages.map((stage, index) => (
            <div key={stage.id} className="pipeline-stage-pill">
              <strong>{index + 1}</strong>
              <span>{stage.title}</span>
            </div>
          ))}
        </div>

        <button type="button" className="ghost-button" onClick={onLogout}>
          Trocar perfil
        </button>
      </aside>

      <section className="pipeline-main">
        <header className="pipeline-hero">
          <div>
            <span className="workspace-header__eyebrow">Pipeline juridico</span>
            <h1>Painel de ingestao, extracao e pre-processamento</h1>
            <p>
              Crie o processo, anexe PDFs, rode a extracao via OpenAI e exporte a matriz
              higienizada para classificacao.
            </p>
          </div>

          <div className="pipeline-hero__stats">
            <article className="pipeline-stat-card">
              <span>Processos em memoria</span>
              <strong>{processes.length}</strong>
            </article>
            <article className="pipeline-stat-card">
              <span>Prontos para ML</span>
              <strong>{processedCases}</strong>
            </article>
            <article className="pipeline-stat-card">
              <span>Perfil ativo</span>
              <strong>{role === 'employee' ? 'Empresa' : 'Advogado'}</strong>
            </article>
          </div>
        </header>

        {error ? <div className="pipeline-alert pipeline-alert--error">{error}</div> : null}
        {feedback ? <div className="pipeline-alert pipeline-alert--success">{feedback}</div> : null}

        <section className="pipeline-grid">
          <article className="pipeline-card">
            <div className="pipeline-card__header">
              <div>
                <span className="detail-card__eyebrow">Etapa 1</span>
                <h2>Criar processo</h2>
              </div>
              <span className="pipeline-card__tag">Memoria local</span>
            </div>

            <form className="pipeline-form" onSubmit={handleCreateProcess}>
              <label htmlFor="process-name">Nome do processo</label>
              <input
                id="process-name"
                value={processName}
                onChange={(event) => setProcessName(event.target.value)}
                placeholder="Ex.: Processo Maria Silva x Banco Unicamp"
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
                <span className="detail-card__eyebrow">Fila ativa</span>
                <h2>Selecionar caso</h2>
              </div>
              <span className="pipeline-card__tag">{processes.length} registros</span>
            </div>

            <div className="process-list">
              {processes.length === 0 ? (
                <p className="empty-state">Nenhum processo criado ainda.</p>
              ) : (
                processes.map((process) => (
                  <button
                    key={process.id}
                    type="button"
                    className={`process-list__item${process.id === selectedProcess?.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedProcessId(process.id)}
                  >
                    <strong>{process.name}</strong>
                    <span>{statusLabels[process.status] ?? process.status}</span>
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
                <h2>Upload e extracao</h2>
              </div>
              <span className="pipeline-card__tag">
                {selectedProcess ? statusLabels[selectedProcess.status] ?? selectedProcess.status : 'Sem selecao'}
              </span>
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
                  <label htmlFor="documents">PDFs do processo</label>
                  <input
                    id="documents"
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
                      onClick={handleUploadDocuments}
                      disabled={isBusy || pendingFiles.length === 0}
                    >
                      Enviar documentos
                    </button>
                    <button
                      type="button"
                      className="submit-button"
                      onClick={handleAnalyzeProcess}
                      disabled={isBusy || selectedProcess.document_count === 0}
                    >
                      Rodar pipeline
                    </button>
                  </div>
                </div>

                <div className="document-preview-list">
                  {selectedProcess.documents.length === 0 ? (
                    <p className="empty-state">Anexe os autos e subsidios para iniciar a leitura.</p>
                  ) : (
                    selectedProcess.documents.map((document) => (
                      <article key={document.id} className="document-preview-card">
                        <strong>{document.filename}</strong>
                        <span>{Math.ceil(document.size_bytes / 1024)} KB</span>
                        <p>{document.text_preview || 'Sem texto legivel extraido.'}</p>
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="empty-state">Crie um processo para habilitar o upload dos PDFs.</p>
            )}
          </article>

          <article className="pipeline-card">
            <div className="pipeline-card__header">
              <div>
                <span className="detail-card__eyebrow">Etapa 4</span>
                <h2>Campos extraidos</h2>
              </div>
              <span className="pipeline-card__tag">LLM + fallback</span>
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
              <p className="empty-state">Os campos estruturados aparecerao aqui apos a analise.</p>
            )}
          </article>
        </section>

        <section className="pipeline-grid pipeline-grid--wide">
          <article className="pipeline-card">
            <div className="pipeline-card__header">
              <div>
                <span className="detail-card__eyebrow">Tabela 0/1</span>
                <h2>Subsidios detectados</h2>
              </div>
              <span className="pipeline-card__tag">Pronto para classificacao</span>
            </div>

            <div className="subsidy-grid">
              {subsidyCatalog.map((subsidy) => {
                const active = selectedProcess?.subsidies?.[subsidy.key] === 1

                return (
                  <article
                    key={subsidy.key}
                    className={`subsidy-card${active ? ' is-active' : ''}`}
                  >
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
              <span className="pipeline-card__tag">{extractedRows.length} colunas</span>
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

                {selectedProcess.preprocessing_summary ? (
                  <div className="preprocess-summary">
                    <p>
                      Numericos: {selectedProcess.preprocessing_summary.numeric_fields.join(', ')}
                    </p>
                    <p>
                      Categoricos codificados:{' '}
                      {selectedProcess.preprocessing_summary.categorical_fields_encoded.join(', ')}
                    </p>
                  </div>
                ) : null}

                <div className="pipeline-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleExport('json')}
                  >
                    Exportar JSON
                  </button>
                  <button
                    type="button"
                    className="submit-button"
                    onClick={() => handleExport('xlsx')}
                  >
                    Exportar XLSX
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-state">A matriz higienizada sera exibida aqui apos o processamento.</p>
            )}
          </article>
        </section>

        {selectedProcess?.processing_notes?.length ? (
          <section className="pipeline-card">
            <div className="pipeline-card__header">
              <div>
                <span className="detail-card__eyebrow">Observacoes do pipeline</span>
                <h2>Notas tecnicas</h2>
              </div>
            </div>

            <div className="notes-list">
              {selectedProcess.processing_notes.map((note, index) => (
                <p key={`${selectedProcess.id}-note-${index}`}>{note}</p>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
