/**
 * API helpers for human-in-the-loop email draft approval workflows.
 */

export async function approveDraft(
  approvalToken: string,
  accessToken: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/v1/agents/email/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ approval_token: approvalToken }),
  })

  const data = (await response.json()) as {
    success?: boolean
    message?: string
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Failed to approve email draft.')
  }

  return {
    success: Boolean(data.success),
    message: data.message ?? 'Email approved and queued for send',
  }
}

export async function rejectDraft(
  approvalToken: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const response = await fetch('/api/v1/agents/email/reject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ approval_token: approvalToken }),
  })

  const data = (await response.json()) as {
    success?: boolean
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Failed to reject email draft.')
  }

  return { success: Boolean(data.success) }
}
