import { Request } from 'express'
import { PaginationParams } from '@/types'

export const getPaginationParams = (query: Request['query']): PaginationParams => {
  const page = Math.max(1, parseInt((query.page as string) || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '20', 10)))
  const sortBy = (query.sortBy as string) || 'createdAt'
  const sortOrder = ((query.sortOrder as string) || 'desc') as 'asc' | 'desc'
  const search = (query.search as string) || undefined

  return { page, limit, sortBy, sortOrder, search }
}

export const getSkip = (page: number, limit: number) => (page - 1) * limit
