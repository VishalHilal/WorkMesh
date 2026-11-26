import { test, expect, type Page } from '@playwright/test'

const MOCK_USER = {
  id: 'user_e2e_1',
  email: 'employee.dev@workmesh.test',
  firstName: 'Karan',
  lastName: 'Mehta',
  companyId: 'comp_workmesh_1',
  role: 'EMPLOYEE',
}

async function setupApiMocks(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (url.includes('/api/v1/auth/login') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accessToken: 'mock_e2e_jwt_token',
            user: MOCK_USER,
          },
        }),
      })
    }

    if (url.includes('/api/v1/documents') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'doc_1',
              title: 'Employee Handbook 2026',
              fileName: 'handbook.pdf',
              fileSize: 24576,
              mimeType: 'application/pdf',
              status: 'READY',
              chunkCount: 12,
              createdAt: '2026-11-25T10:00:00.000Z',
            },
          ],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      })
    }

    if (url.includes('/api/v1/rag/threads') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    }

    if (url.includes('/api/v1/rag/chat') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            query: 'Email HR about sick leave',
            answer: 'I have prepared an email draft for your review.',
            citations: [],
            model: 'gemini-3.8-flash',
            grounded: false,
            thread_id: 'thread_e2e_1',
            agentHandled: 'office_agent',
            agentPath: ['supervisor', 'office_agent'],
            iterations: 1,
            mode: 'agent',
            draft_payload: {
              approval_token: '550e8400-e29b-41d4-a716-446655440000',
              to: 'hr@workmesh.com',
              subject: 'Sick Leave Request',
              body: 'Hi HR, I need to take sick leave tomorrow.',
              cc: [],
            },
          },
        }),
      })
    }

    if (url.includes('/api/v1/agents/email/approve') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Email approved and queued for send',
        }),
      })
    }

    if (url.includes('/api/v1/reports/generate') && method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'rep_e2e_1',
            companyId: 'comp_workmesh_1',
            userId: 'user_e2e_1',
            title: 'Q4 E2E Policy Brief',
            format: 'PDF',
            template: 'executive_summary',
            fileName: 'q4-e2e-policy-brief.pdf',
            mimeType: 'application/pdf',
            fileSize: 2048,
            createdAt: '2026-11-26T10:00:00.000Z',
          },
        }),
      })
    }

    if (url.includes('/api/v1/reports') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
}

async function loginAsEmployee(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/Email address/i).fill('employee.dev@workmesh.test')
  await page.getByLabel(/Password/i).fill('WorkMesh@2026!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

test.describe('WorkMesh Enterprise E2E Smoke Suite', () => {
  test('redirects unauthenticated visitors to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible()
  })

  test('logs in and navigates across Workspace, Documents, AI Assistant, and Reports', async ({ page }) => {
    await setupApiMocks(page)
    await loginAsEmployee(page)

    await expect(page.getByText(/Your company workspace, connected/i)).toBeVisible()

    await page.getByRole('link', { name: 'Documents', exact: true }).click()
    await expect(page).toHaveURL(/\/documents$/)
    await expect(page.getByText('Employee Handbook 2026')).toBeVisible()

    await page.locator('header').getByRole('link', { name: /AI Assistant/i }).click()
    await expect(page).toHaveURL(/\/assistant$/)
    await expect(page.getByRole('heading', { name: 'Knowledge Assistant' })).toBeVisible()

    await page.getByRole('link', { name: 'Reports', exact: true }).click()
    await expect(page).toHaveURL(/\/reports$/)
    await expect(page.getByRole('heading', { name: 'Report Generation' })).toBeVisible()
  })

  test('submits AI Assistant email prompt and approves inline EmailDraftPanel', async ({ page }) => {
    await setupApiMocks(page)
    await loginAsEmployee(page)

    await page.locator('header').getByRole('link', { name: /AI Assistant/i }).click()
    const input = page.getByPlaceholder(/Ask a question about your company's documents/i)
    await input.fill('Email HR about sick leave')
    await input.press('Enter')

    await expect(page.getByTestId('email-draft-panel')).toBeVisible()
    await expect(page.getByText('Sick Leave Request', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /Approve/i }).click()
    await expect(page.getByText(/Email approved and queued/i)).toBeVisible()
  })

  test('generates a report on /reports and displays it in history', async ({ page }) => {
    await setupApiMocks(page)
    await loginAsEmployee(page)

    await page.getByRole('link', { name: 'Reports', exact: true }).click()
    await page.getByLabel(/Report Title/i).fill('Q4 E2E Policy Brief')
    await page.getByLabel(/Topic & Synthesis Instructions/i).fill('Summarize Q4 remote work policy')
    await page.getByRole('button', { name: /Generate Report/i }).click()

    await expect(page.getByText('Q4 E2E Policy Brief', { exact: true })).toBeVisible()
    await expect(page.getByText(/generated successfully/i)).toBeVisible()
  })
})
