import { Router } from 'express'
import { authenticate } from '@/middleware/auth'
import { orgAccess } from '@/middleware/orgAccess'
import { successResponse } from '@/utils/response'
import { prisma } from '@/config/database'
import { AuthenticatedRequest } from '@/types'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Full-text search across tasks, projects, and comments
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: string
 *         description: Filter results to a specific organization
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, task, project, comment]
 *           default: all
 *         description: Limit search to a specific entity type
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: object
 *                     comments:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  const q = (req.query.q as string) || ''
  const orgId = req.query.orgId as string
  const type = (req.query.type as string) || 'all'

  if (!q || q.length < 2) {
    successResponse(res, { tasks: [], projects: [], comments: [] })
    return
  }

  const notDeleted = [{ deletedAt: null }, { deletedAt: { isSet: false } }]
  const searchFilter = { contains: q, mode: 'insensitive' as const }

  const [tasks, projects, comments] = await Promise.all([
    type === 'all' || type === 'task'
      ? prisma.task.findMany({
          where: {
            AND: [
              { OR: notDeleted },
              { OR: [{ title: searchFilter }, { description: searchFilter }] },
            ],
            ...(orgId && { project: { organizationId: orgId } }),
          },
          include: { project: { select: { id: true, name: true, organizationId: true } } },
          take: 10,
        })
      : [],
    type === 'all' || type === 'project'
      ? prisma.project.findMany({
          where: {
            AND: [
              { OR: notDeleted },
              { OR: [{ name: searchFilter }, { description: searchFilter }] },
            ],
            ...(orgId && { organizationId: orgId }),
          },
          take: 10,
        })
      : [],
    type === 'all' || type === 'comment'
      ? prisma.taskComment.findMany({
          where: {
            OR: notDeleted,
            content: searchFilter,
            ...(orgId && { task: { project: { organizationId: orgId } } }),
          },
          include: {
            user: { select: { id: true, name: true } },
            task: { select: { id: true, title: true, projectId: true } },
          },
          take: 10,
        })
      : [],
  ])

  successResponse(res, { tasks, projects, comments })
})

export default router
