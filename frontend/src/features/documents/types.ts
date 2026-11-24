export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'

export interface DocumentItem {
  id: string
  companyId: string
  uploadedById: string
  title: string
  fileName: string
  fileSize: number
  mimeType: string
  storageKey: string
  status: DocumentStatus
  errorMessage?: string | null
  chunkCount: number
  createdAt: string
  updatedAt: string
  uploadedBy?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  downloadUrl?: string
}

export interface DocumentListResponse {
  data: DocumentItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    timestamp: string
  }
}
