import { Router } from 'express'
import { authController, avatarUpload, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } from '@/controllers/auth.controller'
import { authenticate } from '@/middleware/auth'
import { validate } from '@/middleware/validate'
import { authLimiter } from '@/middleware/rateLimiter'
import { uploadLimiter } from '@/middleware/rateLimiter'

const router = Router()

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               organizationName: { type: string }
 *     responses:
 *       201: { description: User registered }
 *       409: { description: Email already exists }
 */
router.post('/register', authLimiter, validate(registerSchema), authController.register)

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful — returns user + accessToken; refreshToken set as HTTP-only cookie
 *       401: { description: Invalid credentials }
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login)

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using HTTP-only refresh token cookie
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: New accessToken returned }
 *       401: { description: Missing or invalid refresh token }
 */
router.post('/refresh', authController.refresh)

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout — invalidates refresh token and clears cookie
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout', authController.logout)

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Send password reset email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Reset email sent (always 200 to prevent email enumeration) }
 */
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword)

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using token from email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password updated }
 *       400: { description: Invalid or expired token }
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword)

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the current authenticated user
 *     tags: [Auth]
 *     responses:
 *       200: { description: Current user with org memberships }
 *       401: { description: Unauthenticated }
 */
router.get('/me', authenticate, authController.getMe)

/**
 * @swagger
 * /auth/profile:
 *   patch:
 *     summary: Update profile (name, timezone, notification preferences)
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               timezone: { type: string }
 *               notificationPrefs: { type: object }
 *     responses:
 *       200: { description: Profile updated }
 */
router.patch('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile)

/**
 * @swagger
 * /auth/profile/password:
 *   patch:
 *     summary: Change password (requires current password)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed }
 *       401: { description: Current password incorrect }
 */
router.patch('/profile/password', authenticate, authController.changePassword)

/**
 * @swagger
 * /auth/profile/avatar:
 *   post:
 *     summary: Upload profile avatar image
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated, returns updated user
 */
router.post('/profile/avatar', authenticate, uploadLimiter, avatarUpload.single('avatar'), authController.uploadAvatar)

export default router
