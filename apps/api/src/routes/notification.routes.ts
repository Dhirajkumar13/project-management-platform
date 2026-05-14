import { Router } from 'express'
import { authenticate } from '@/middleware/auth'
import { successResponse, paginatedResponse } from '@/utils/response'
import { getPaginationParams } from '@/utils/pagination'
import { prisma } from '@/config/database'
import { AuthenticatedRequest } from '@/types'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List notifications for current user
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated notifications
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  const params = getPaginationParams(req.query)
  const userId = req.user!.id
  const read = req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined
  const where = { userId, ...(read !== undefined && { read }) }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ])
  paginatedResponse(res, items, total, params.page, params.limit)
})

/**
 * @swagger
 * /notifications/count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 */
router.get('/count', async (req: AuthenticatedRequest, res) => {
  const count = await prisma.notification.count({ where: { userId: req.user!.id, read: false } })
  successResponse(res, { count })
})

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { read: true },
  })
  successResponse(res, null, 200, 'Notification marked as read')
})

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/read-all', async (req: AuthenticatedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  })
  successResponse(res, null, 200, 'All notifications marked as read')
})

/**
 * @swagger
 * /notifications:
 *   delete:
 *     summary: Delete all notifications for current user
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: All notifications cleared
 */
router.delete('/', async (req: AuthenticatedRequest, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.user!.id } })
  successResponse(res, null, 200, 'All notifications cleared')
})

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted
 */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user!.id } })
  successResponse(res, null, 200, 'Notification deleted')
})

export default router
