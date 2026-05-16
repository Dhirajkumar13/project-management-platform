import { Router } from 'express'
import { authenticate } from '@/middleware/auth'
import { successResponse } from '@/utils/response'
import { prisma } from '@/config/database'
import { AuthenticatedRequest } from '@/types'
import { TaskStatus } from '@prisma/client'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * /my-tasks:
 *   get:
 *     summary: Get all tasks assigned to the current user
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: string
 *         description: Filter by organization
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *     responses:
 *       200:
 *         description: Tasks assigned to current user
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id
  const orgId = req.query.orgId as string | undefined
  const status = req.query.status as TaskStatus | undefined

  const assignments = await prisma.taskAssignee.findMany({
    where: {
      userId,
      task: {
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
        ...(status && { status }),
        ...(orgId && { project: { organizationId: orgId } }),
      },
    },
    include: {
      task: {
        include: {
          project: { select: { id: true, name: true, organizationId: true } },
          assignees: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          labels: { include: { label: true } },
          _count: { select: { subtasks: true, comments: true } },
        },
      },
    },
    orderBy: [{ task: { dueDate: 'asc' } }, { task: { createdAt: 'desc' } }],
  })

  const tasks = assignments.map((a) => a.task)
  successResponse(res, { tasks })
})

export default router
