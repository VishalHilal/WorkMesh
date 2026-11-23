export interface UserListItem {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN'
  createdAt: string
  updatedAt: string
}
