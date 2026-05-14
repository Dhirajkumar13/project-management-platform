import { Router } from 'express'
import { authController, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } from '@/controllers/auth.controller'
import { authenticate } from '@/middleware/auth'
import { validate } from '@/middleware/validate'
import { authLimiter } from '@/middleware/rateLimiter'

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

export default router
