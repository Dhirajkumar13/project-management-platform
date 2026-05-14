import { Request, Response } from 'express'
import { z } from 'zod'
import { authService } from '@/services/auth.service'
import { AuthenticatedRequest } from '@/types'
import { successResponse } from '@/utils/response'

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
}

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(2).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
})

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  timezone: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  notificationPrefs: z.object({
    task_assigned: z.object({ email: z.boolean(), in_app: z.boolean() }).optional(),
    mentioned: z.object({ email: z.boolean(), in_app: z.boolean() }).optional(),
    due_date_reminder: z.object({ email: z.boolean(), in_app: z.boolean() }).optional(),
    invite_received: z.object({ email: z.boolean(), in_app: z.boolean() }).optional(),
  }).optional(),
})

export const authController = {
  register: async (req: Request, res: Response) => {
    const result = await authService.register(req.body)
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS)
    const { password: _, ...user } = result.user as Record<string, unknown> & { password: string }
    successResponse(res, { user, accessToken: result.accessToken }, 201, 'Registration successful')
  },

  login: async (req: Request, res: Response) => {
    const result = await authService.login(req.body.email, req.body.password)
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS)
    const { password: _, ...user } = result.user as Record<string, unknown> & { password: string }
    successResponse(res, { user, accessToken: result.accessToken }, 200, 'Login successful')
  },

  refresh: async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken
    if (!token) {
      res.status(401).json({ success: false, message: 'No refresh token' })
      return
    }
    const result = await authService.refresh(token)
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS)
    successResponse(res, { accessToken: result.accessToken })
  },

  logout: async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken
    if (token) await authService.logout(token)
    res.clearCookie('refreshToken', { path: '/' })
    successResponse(res, null, 200, 'Logged out')
  },

  forgotPassword: async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email)
    successResponse(res, null, 200, 'If this email exists, a reset link has been sent')
  },

  resetPassword: async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.password)
    successResponse(res, null, 200, 'Password reset successful')
  },

  getMe: async (req: AuthenticatedRequest, res: Response) => {
    const user = await authService.getMe(req.user!.id)
    const { password: _, ...safeUser } = user as Record<string, unknown> & { password: string }
    successResponse(res, safeUser)
  },

  updateProfile: async (req: AuthenticatedRequest, res: Response) => {
    const user = await authService.updateProfile(req.user!.id, req.body)
    const { password: _, ...safeUser } = user as Record<string, unknown> & { password: string }
    successResponse(res, safeUser, 200, 'Profile updated')
  },

  changePassword: async (req: AuthenticatedRequest, res: Response) => {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword)
    successResponse(res, null, 200, 'Password changed')
  },
}
