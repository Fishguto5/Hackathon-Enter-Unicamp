export type ProcessDocument = {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  uploaded_at: string
  subsidy_hits: Record<string, number>
  classification?: string
  text_preview: string
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
  preprocessing_summary: {
    numeric_fields: string[]
    categorical_fields_encoded: string[]
    binary_subsidies: string[]
    missing_safe_defaults: Record<string, string | number>
  } | null
  processing_notes: string[]
  recommendation_summary: string | null
  decision_reasons: string[]
  final_response: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000'

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Nao foi possivel acessar o backend em ${API_BASE_URL}. Verifique se a API Flask esta rodando e se a URL esta correta.`,
      )
    }

    throw error
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Falha na comunicacao com o backend.')
  }

  return (await response.json()) as T
}

export async function listProcesses(): Promise<LegalProcess[]> {
  const response = await safeFetch(`${API_BASE_URL}/api/processes`)
  return parseJsonResponse<LegalProcess[]>(response)
}

export async function createProcess(name: string): Promise<LegalProcess> {
  const response = await safeFetch(`${API_BASE_URL}/api/processes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function uploadProcessDocuments(
  processId: string,
  files: File[],
): Promise<LegalProcess> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const response = await safeFetch(`${API_BASE_URL}/api/processes/${processId}/documents`, {
    method: 'POST',
    body: formData,
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function analyzeProcess(processId: string): Promise<LegalProcess> {
  const response = await safeFetch(`${API_BASE_URL}/api/processes/${processId}/analyze`, {
    method: 'POST',
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function finalizeProcess(
  processId: string,
  finalResponse: string,
): Promise<LegalProcess> {
  const response = await safeFetch(`${API_BASE_URL}/api/processes/${processId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ final_response: finalResponse }),
  })

  return parseJsonResponse<LegalProcess>(response)
}

export async function downloadProcessExport(
  processId: string,
  format: 'json' | 'xlsx',
): Promise<void> {
  const response = await safeFetch(`${API_BASE_URL}/api/processes/${processId}/export?format=${format}`)
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
