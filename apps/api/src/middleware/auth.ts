import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '@/types'
import { verifyAccessToken } from '@/utils/jwt'
import { errorResponse } from '@/utils/response'

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    errorResponse(res, 'No token provided', 401)
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.userId, email: '' }
    next()
  } catch {
    errorResponse(res, 'Invalid or expired token', 401)
  }
}
