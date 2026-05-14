import { Response } from 'express'

export const successResponse = (
  res: Response,
  data: unknown,
  statusCode = 200,
  message = 'Success'
) => res.status(statusCode).json({ success: true, message, data })

export const errorResponse = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
) => res.status(statusCode).json({ success: false, message, errors })

export const paginatedResponse = (
  res: Response,
  items: unknown[],
  total: number,
  page: number,
  limit: number
) =>
  res.status(200).json({
    success: true,
    message: 'Success',
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
