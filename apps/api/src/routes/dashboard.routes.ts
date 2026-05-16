import { Router } from 'express'
import { authenticate } from '@/middleware/auth'
import { orgAccess } from '@/middleware/orgAccess'
import { successResponse } from '@/utils/response'
import { prisma } from '@/config/database'
import { AuthenticatedRequest } from '@/types'

const router = Router()
router.use(authenticate)

const nd = [{ deletedAt: null }, { deletedAt: { isSet: false } }] as const

/**
 * @swagger
 * /dashboard/{orgId}:
 *   get:
 *     summary: Get dashboard statistics for an organization
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProjects:
 *                       type: integer
 *                     activeProjects:
 *                       type: integer
 *                     completedProjects:
 *                       type: integer
 *                     totalTasks:
 *                       type: integer
 *                     activeTasks:
 *                       type: integer
 *                     overdueTasks:
 *                       type: integer
 *                     completedTasks:
 *                       type: integer
 *                     memberCount:
 *                       type: integer
 *                     tasksByStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     tasksByPriority:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           priority:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                     teamWorkload:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: object
 *                           assignedCount:
 *                             type: integer
 *                           completedCount:
 *                             type: integer
 */
router.get('/:orgId', orgAccess, async (req: AuthenticatedRequest, res) => {
  const { orgId } = req.params

  const [
    totalProjects,
    activeProjects,
    completedProjects,
    totalTasks,
    activeTasks,
    overdueTasks,
    completedTasks,
    memberCount,
    tasksByStatus,
    tasksByPriority,
    recentActivity,
    members,
  ] = await Promise.all([
    prisma.project.count({ where: { organizationId: orgId, OR: nd } }),
    prisma.project.count({ where: { organizationId: orgId, OR: nd, status: 'ACTIVE' } }),
    prisma.project.count({ where: { organizationId: orgId, OR: nd, status: 'COMPLETED' } }),
    prisma.task.count({ where: { project: { organizationId: orgId }, OR: nd } }),
    prisma.task.count({ where: { project: { organizationId: orgId }, OR: nd, status: { not: 'DONE' } } }),
    prisma.task.count({
      where: {
        project: { organizationId: orgId },
        OR: nd,
        status: { not: 'DONE' },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.task.count({ where: { project: { organizationId: orgId }, OR: nd, status: 'DONE' } }),
    prisma.organizationMember.count({ where: { organizationId: orgId } }),
    prisma.task.groupBy({
      by: ['status'],
      where: { project: { organizationId: orgId }, OR: nd },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { project: { organizationId: orgId }, OR: nd },
      _count: true,
    }),
    prisma.taskActivity.findMany({
      where: { task: { project: { organizationId: orgId } } },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
  ])

  const teamWorkload = await Promise.all(
    members.map(async (m) => {
      const [assigned, completed] = await Promise.all([
        prisma.taskAssignee.count({
          where: { userId: m.userId, task: { project: { organizationId: orgId }, OR: nd } },
        }),
        prisma.taskAssignee.count({
          where: { userId: m.userId, task: { project: { organizationId: orgId }, OR: nd, status: 'DONE' } },
        }),
      ])
      return { user: m.user, assignedCount: assigned, completedCount: completed }
    })
  )

  successResponse(res, {
    totalProjects,
    activeProjects,
    completedProjects,
    totalTasks,
    activeTasks,
    overdueTasks,
    completedTasks,
    memberCount,
    tasksByStatus: tasksByStatus.map((s) => ({ status: s.status, count: s._count })),
    tasksByPriority: tasksByPriority.map((p) => ({ priority: p.priority, count: p._count })),
    recentActivity,
    teamWorkload,
  })
})

export default router
