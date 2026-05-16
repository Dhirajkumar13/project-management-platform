import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { authRepository } from '@/repositories/auth.repository'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/utils/jwt'
import { sendPasswordResetEmail } from '@/utils/email'
import { AppError } from '@/middleware/error'
import { prisma } from '@/config/database'

const REFRESH_TOKEN_TTL_DAYS = 7

export const authService = {
  register: async (data: {
    name: string
    email: string
    password: string
    organizationName?: string
  }) => {
    const existing = await authRepository.findUserByEmail(data.email)
    if (existing) throw new AppError('Email already registered', 409)

    const hashed = await bcrypt.hash(data.password, 12)
    const user = await authRepository.createUser({
      name: data.name,
      email: data.email,
      password: hashed,
    })

    if (data.organizationName) {
      const slug = data.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      const uniqueSlug = `${slug}-${uuidv4().slice(0, 8)}`
      const org = await prisma.organization.create({
        data: { name: data.organizationName, slug: uniqueSlug },
      })
      await prisma.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
      })
    }

    const accessToken = generateAccessToken({ userId: user.id })
    const refreshToken = generateRefreshToken({ userId: user.id })
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
    await authRepository.createRefreshToken(user.id, refreshToken, expiresAt)

    const fullUser = await authRepository.findUserById(user.id)
    return { user: fullUser, accessToken, refreshToken }
  },

  login: async (email: string, password: string) => {
    const user = await authRepository.findUserByEmail(email)
    if (!user) throw new AppError('Invalid credentials', 401)

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new AppError('Invalid credentials', 401)

    const accessToken = generateAccessToken({ userId: user.id })
    const refreshToken = generateRefreshToken({ userId: user.id })
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
    await authRepository.createRefreshToken(user.id, refreshToken, expiresAt)

    const fullUser = await authRepository.findUserById(user.id)
    return { user: fullUser, accessToken, refreshToken }
  },

  refresh: async (refreshToken: string) => {
    const payload = verifyRefreshToken(refreshToken)
    const stored = await authRepository.findRefreshToken(refreshToken)
    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError('Invalid refresh token', 401)
    }

    await authRepository.deleteRefreshToken(refreshToken)
    const newAccessToken = generateAccessToken({ userId: payload.userId })
    const newRefreshToken = generateRefreshToken({ userId: payload.userId })
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
    await authRepository.createRefreshToken(payload.userId, newRefreshToken, expiresAt)

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  },

  logout: async (refreshToken: string) => {
    await authRepository.deleteRefreshToken(refreshToken)
  },

  forgotPassword: async (email: string) => {
    const user = await authRepository.findUserByEmail(email)
    if (!user) return // Don't reveal if email exists

    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await authRepository.createPasswordReset(user.id, token, expiresAt)
    await sendPasswordResetEmail(user.email, token, user.name)
  },

  resetPassword: async (token: string, newPassword: string) => {
    const reset = await authRepository.findPasswordReset(token)
    if (!reset || reset.used || reset.expiresAt < new Date()) {
      throw new AppError('Invalid or expired reset token', 400)
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await authRepository.updateUser(reset.userId, { password: hashed })
    await authRepository.markPasswordResetUsed(reset.id)
    await authRepository.deleteAllUserRefreshTokens(reset.userId)
  },

  getMe: async (userId: string) => {
    const user = await authRepository.findUserById(userId)
    if (!user) throw new AppError('User not found', 404)
    return user
  },

  updateProfile: async (userId: string, data: { name?: string; timezone?: string; avatarUrl?: string; notificationPrefs?: Prisma.InputJsonValue }) => {
    return authRepository.updateUser(userId, data)
  },

  changePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError('User not found', 404)
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) throw new AppError('Current password is incorrect', 400)
    const hashed = await bcrypt.hash(newPassword, 12)
    await authRepository.updateUser(userId, { password: hashed })
  },
}
