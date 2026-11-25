export type ReportFormat = 'pdf' | 'docx'
export type ReportTemplate = 'executive_summary' | 'policy_brief' | 'compliance_audit'

export interface GeneratedReportItem {
  id: string
  companyId: string
  userId: string
  title: string
  format: 'PDF' | 'DOCX'
  template: string
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
}
