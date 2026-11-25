export interface AuditUser {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface AuditLogItem {
  id: string
  companyId: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  user?: AuditUser | null
}

export interface AuditLogsResponse {
  data: AuditLogItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    timestamp: string
  }
}
