export type ProcessDocument = {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  uploaded_at: string
  subsidy_hits: Record<string, number>
  classification?: string
  text_preview: string
  security_assessment: {
    decision: 'reject'
    policy_version: string
    finding_count: number
    change_count: number
    findings: Array<{
      rule_id: string
      category: string
      severity: string
      message: string
      line_numbers: number[]
    }>
    changes: Array<{
      change_id: string
      category: string
      message: string
      line_numbers: number[]
      count: number
    }>
  } | null
}

export type LegalProcess = {
  id: string
  name: string
  status: string
  analysis_state: string
  created_at: string
  updated_at: string
  document_count: number
  documents: ProcessDocument[]
  extracted_data: Record<string, string | number> | null
  subsidies: Record<string, number>
  feature_vector: Record<string, string | number> | null
  model_prediction: {
    strategy: string
    probability_success: number
    probability_failure: number
    threshold_success: number
    claim_amount_brl: number
    document_count: number
    bundle_path: string
    bundle_created_at: string | null
    model_input: Record<string, string | number>
    agreement_score_predicted: number | null
    agreement_savings_target: number | null
    agreement_score_adjusted: number | null
    agreement_amount_suggested: number | null
  } | null
  lawyer_confirmation: {
    choice: string
    algorithm_strategy: string | null
    final_strategy: string
    final_acceptance_status: string
    proposed_agreement_amount: number | null
    confirmed_at: string
  } | null
  preprocessing_summary: {
    numeric_fields: string[]
    categorical_fields_encoded: string[]
    binary_subsidies: string[]
    missing_safe_defaults: Record<string, string | number>
  } | null
  case_intelligence: {
    evidence: Array<{
      key: string
      status: string
      weight: number
      multiplier: number
      contribution: number
      source_documents?: Array<{
        filename: string
        excerpt: string | null
      }>
      facts_considered?: string[]
    }>
    ifp: number
    ifp_raw: number
    penalties: number
    document_completeness: number
    legal_risk: number
    expected_defense_cost_brl: number
    expected_agreement_cost_brl: number
    financial_priority: string
    human_review_recommended: boolean
    drivers: string[]
  } | null
  processing_notes: string[]
  recommendation_summary: string | null
  decision_reasons: string[]
  final_response: string | null
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(/\/$/, '')
const DIRECT_API_BASE_CANDIDATES = ['http://127.0.0.1:5000', 'http://localhost:5000']

function buildApiUrl(path: string) {
  if (API_BASE_URL === '/api') {
    return path
  }

  return `${API_BASE_URL}${path}`
}

function isHtmlResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('text/html')
}

async function fetchDirectApiFallback(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  for (const candidate of DIRECT_API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${candidate}${path}`, init)
      if (!isHtmlResponse(response)) {
        return response
      }
    } catch {
      continue
    }
  }

  return null
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init)

    if (
      typeof input === 'string' &&
      input.startsWith('/api') &&
      (isHtmlResponse(response) || response.status === 404)
    ) {
      const fallbackResponse = await fetchDirectApiFallback(input, init)
      if (fallbackResponse) {
        return fallbackResponse
      }
    }

    if (
      typeof input === 'string' &&
      input.startsWith('/api') &&
      !response.ok &&
      isHtmlResponse(response)
    ) {
      const fallbackResponse = await fetchDirectApiFallback(input, init)
      if (fallbackResponse) {
        return fallbackResponse
      }
    }

    return response
  } catch (error) {
    if (error instanceof TypeError) {
      if (typeof input === 'string' && input.startsWith('/api')) {
        const fallbackResponse = await fetchDirectApiFallback(input, init)
        if (fallbackResponse) {
          return fallbackResponse
        }
      }

      const requestTarget = typeof input === 'string' ? input : input.toString()
      throw new Error(
        `Nao foi possivel acessar o backend em ${requestTarget}. Verifique se a API Flask esta rodando, se a URL esta correta e se o frontend esta apontando para o mesmo host da API.`,
      )
    }

    throw error
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text()
  let payload: { error?: string } | null = null

  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody) as { error?: string }
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    throw new Error(
      payload?.error ??
        `Falha na comunicacao com o backend. Status ${response.status}.`,
    )
  }

  if (!rawBody.trim()) {
    throw new Error('O backend respondeu sem corpo JSON.')
  }

  if (payload !== null) {
    return payload as T
  }

  const snippet = rawBody.slice(0, 120).replace(/\s+/g, ' ').trim()
  throw new Error(
    `O backend retornou uma resposta em formato invalido${snippet ? `: ${snippet}` : '.'}`,
  )
}

export async function listProcesses(): Promise<LegalProcess[]> {
  const response = await safeFetch(buildApiUrl('/api/processes'))
  return parseJsonResponse<LegalProcess[]>(response)
}

export async function createProcess(name: string): Promise<LegalProcess> {
  const response = await safeFetch(buildApiUrl('/api/processes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function updateProcess(
  processId: string,
  payload: { name: string },
): Promise<LegalProcess> {
  const response = await safeFetch(buildApiUrl(`/api/processes/${processId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function deleteProcess(processId: string): Promise<void> {
  const response = await safeFetch(buildApiUrl(`/api/processes/${processId}`), {
    method: 'DELETE',
  })

  if (!response.ok) {
    const rawBody = await response.text()
    let payload: { error?: string } | null = null

    if (rawBody.trim()) {
      try {
        payload = JSON.parse(rawBody) as { error?: string }
      } catch {
        payload = null
      }
    }

    throw new Error(payload?.error ?? `Falha ao deletar o processo. Status ${response.status}.`)
  }
}

export async function uploadProcessDocuments(
  processId: string,
  files: File[],
): Promise<LegalProcess> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const response = await safeFetch(buildApiUrl(`/api/processes/${processId}/documents`), {
    method: 'POST',
    body: formData,
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function analyzeProcess(processId: string): Promise<LegalProcess> {
  const response = await safeFetch(buildApiUrl(`/api/processes/${processId}/analyze`), {
    method: 'POST',
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function finalizeProcess(
  processId: string,
  payload: {
    final_response: string
    confirmation_choice: 'seguir_algoritmo' | 'seguir_outra_estrategia'
    final_acceptance_status: 'aceito' | 'nao_aceito'
    final_strategy?: 'defesa' | 'acordo'
    proposed_agreement_amount?: number
  },
): Promise<LegalProcess> {
  const response = await safeFetch(buildApiUrl(`/api/processes/${processId}/finalize`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function downloadProcessExport(
  processId: string,
  format: 'json' | 'xlsx',
): Promise<void> {
  const response = await safeFetch(
    buildApiUrl(`/api/processes/${processId}/export?format=${format}`),
  )
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Falha ao exportar o arquivo.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? `process-export.${format}`
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
