import { Request } from 'express'
import { OrgRole, ProjectRole, TaskStatus, Priority, ProjectStatus, Visibility } from '@prisma/client'

export { OrgRole, ProjectRole, TaskStatus, Priority, ProjectStatus, Visibility }

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
  }
  orgMember?: {
    id: string
    organizationId: string
    userId: string
    role: OrgRole
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
}

export const hasRole = (userRole: OrgRole, requiredRole: OrgRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}
