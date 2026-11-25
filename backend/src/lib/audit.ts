import { Prisma } from '@prisma/client'
import { prisma } from './db.js'

export interface RecordAuditOptions {
  companyId: string
  userId?: string | null | undefined
  action: string
  entityType: string
  entityId?: string | null | undefined
  details?: Prisma.InputJsonValue | undefined
  ipAddress?: string | null | undefined
}

/**
 * Record an append-only security audit event in the database.
 * Non-blocking: logs error if insertion fails so primary operations are not disrupted.
 */
export async function recordAuditEvent(options: RecordAuditOptions) {
  try {
    return await prisma.auditLog.create({
      data: {
        companyId: options.companyId,
        userId: options.userId ?? null,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId ?? null,
        details: options.details ?? Prisma.JsonNull,
        ipAddress: options.ipAddress ?? null,
      },
    })
  } catch (err) {
    console.error('Failed to record audit event:', err)
    return null
  }
}
