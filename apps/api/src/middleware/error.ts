import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'
import { logger } from '@/config/logger'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errors?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(err.message, { stack: err.stack, path: req.path })

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: err.flatten().fieldErrors,
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Resource already exists' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Resource not found' })
      return
    }
  }

  if (err instanceof TokenExpiredError) {
    res.status(401).json({ success: false, message: 'Token expired' })
    return
  }

  if (err instanceof JsonWebTokenError) {
    res.status(401).json({ success: false, message: 'Invalid token' })
    return
  }

  res.status(500).json({ success: false, message: 'Internal server error' })
}
