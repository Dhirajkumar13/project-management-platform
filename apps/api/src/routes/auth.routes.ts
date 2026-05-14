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
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login)

router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword)
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword)
router.get('/me', authenticate, authController.getMe)
router.patch('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile)
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
