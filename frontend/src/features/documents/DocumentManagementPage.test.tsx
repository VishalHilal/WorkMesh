import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { DocumentManagementPage } from './DocumentManagementPage'
import { AuthContext, type AuthContextType } from '../../context/AuthContext'
import type { DocumentItem } from './types'

const mockUser = {
  id: 'user_1',
  email: 'priya@workmesh.test',
  firstName: 'Priya',
  lastName: 'Patel',
  companyId: 'company_1',
  role: 'ADMIN' as const,
}

const mockAuthValue: AuthContextType = {
  user: mockUser,
  accessToken: 'mock_jwt_token',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
}

const mockDocuments: DocumentItem[] = [
  {
    id: 'doc_1',
    companyId: 'company_1',
    uploadedById: 'user_1',
    title: 'Employee Handbook 2026',
    fileName: 'Employee_Handbook.pdf',
    fileSize: 1048576, // 1MB
    mimeType: 'application/pdf',
    storageKey: 'documents/company_1/doc1.pdf',
    status: 'READY',
    chunkCount: 12,
    createdAt: '2026-11-24T10:00:00.000Z',
    updatedAt: '2026-11-24T10:00:00.000Z',
    uploadedBy: {
      id: 'user_1',
      firstName: 'Priya',
      lastName: 'Patel',
      email: 'priya@workmesh.test',
    },
  },
  {
    id: 'doc_2',
    companyId: 'company_1',
    uploadedById: 'user_2',
    title: 'IT Security Architecture',
    fileName: 'Security_Spec.docx',
    fileSize: 524288, // 512KB
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    storageKey: 'documents/company_1/doc2.docx',
    status: 'PROCESSING',
    chunkCount: 0,
    createdAt: '2026-11-24T11:00:00.000Z',
    updatedAt: '2026-11-24T11:00:00.000Z',
    uploadedBy: {
      id: 'user_2',
      firstName: 'Rohan',
      lastName: 'Verma',
      email: 'rohan@workmesh.test',
    },
  },
]

function renderWithProviders(ui: React.ReactElement, authOverrides?: Partial<AuthContextType>) {
  return render(
    <AuthContext.Provider value={{ ...mockAuthValue, ...authOverrides }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('DocumentManagementPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/documents')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: mockDocuments,
              meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
            }),
          }
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { message: 'Not found' } }),
        }
      })
    )
  })

  it('renders document hub heading and document list table', async () => {
    renderWithProviders(<DocumentManagementPage />)

    expect(screen.getByRole('heading', { name: 'Document Hub' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Employee Handbook 2026')).toBeInTheDocument()
      expect(screen.getByText('IT Security Architecture')).toBeInTheDocument()
    })

    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('1.0 MB')).toBeInTheDocument()
    expect(screen.getByText('512.0 KB')).toBeInTheDocument()
  })

  it('filters documents by status', async () => {
    renderWithProviders(<DocumentManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Employee Handbook 2026')).toBeInTheDocument()
    })

    const readyFilterBtn = screen.getByRole('button', { name: 'READY' })
    fireEvent.click(readyFilterBtn)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/documents?status=READY'),
        expect.any(Object)
      )
    })
  })

  it('opens and closes the upload modal', async () => {
    renderWithProviders(<DocumentManagementPage />)

    const uploadBtn = screen.getByRole('button', { name: /Upload Document/i })
    fireEvent.click(uploadBtn)

    expect(screen.getByRole('dialog', { name: 'Upload Document' })).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: 'Close upload modal' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('validates file type in upload modal', async () => {
    renderWithProviders(<DocumentManagementPage />)

    fireEvent.click(screen.getByRole('button', { name: /Upload Document/i }))

    const fileInput = screen.getByTestId('document-file-input')
    const invalidFile = new File(['image bytes'], 'image.png', { type: 'image/png' })

    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(
      screen.getByText(/Invalid file type\. Please upload a PDF, DOCX, or TXT document\./i)
    ).toBeInTheDocument()
  })

  it('uploads a document successfully and adds to the table', async () => {
    const newDoc: DocumentItem = {
      id: 'doc_new',
      companyId: 'company_1',
      uploadedById: 'user_1',
      title: 'Annual Report',
      fileName: 'Annual_Report.pdf',
      fileSize: 204800,
      mimeType: 'application/pdf',
      storageKey: 'documents/company_1/doc_new.pdf',
      status: 'PENDING',
      chunkCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
        if (url === '/api/v1/documents/upload' && options?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ data: newDoc }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: mockDocuments,
            meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
          }),
        }
      })
    )

    renderWithProviders(<DocumentManagementPage />)

    fireEvent.click(screen.getByRole('button', { name: /Upload Document/i }))

    const fileInput = screen.getByTestId('document-file-input')
    const validFile = new File(['%PDF content'], 'Annual_Report.pdf', {
      type: 'application/pdf',
    })

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    const titleInput = screen.getByLabelText(/Document Title/i)
    fireEvent.change(titleInput, { target: { value: 'Annual Report' } })

    const modal = screen.getByRole('dialog', { name: 'Upload Document' })
    const submitBtn = within(modal).getByRole('button', { name: 'Upload Document' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Document "Annual Report" uploaded successfully/i)).toBeInTheDocument()
      expect(screen.getByText('Annual Report')).toBeInTheDocument()
    })
  })

  it('downloads a document using presigned URL', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/v1/documents/doc_1') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                ...mockDocuments[0],
                downloadUrl: 'https://storage.neon.tech/presigned-url',
              },
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: mockDocuments,
            meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
          }),
        }
      })
    )

    renderWithProviders(<DocumentManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Employee Handbook 2026')).toBeInTheDocument()
    })

    const downloadButtons = screen.getAllByRole('button', { name: 'Download' })
    fireEvent.click(downloadButtons[0])

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith('https://storage.neon.tech/presigned-url', '_blank')
    })
  })

  it('deletes a document upon confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
        if (url === '/api/v1/documents/doc_1' && options?.method === 'DELETE') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { message: 'Deleted' } }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: mockDocuments,
            meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
          }),
        }
      })
    )

    renderWithProviders(<DocumentManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Employee Handbook 2026')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Employee Handbook 2026')).not.toBeInTheDocument()
      expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument()
    })
  })
})
