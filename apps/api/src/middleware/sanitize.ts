import { Request, Response, NextFunction } from 'express'
import { filterXSS } from 'xss'

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return filterXSS(value, { whiteList: {} })
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v)])
    )
  }
  return value
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) req.body = sanitizeValue(req.body)
  next()
}
