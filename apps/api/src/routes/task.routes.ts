import { Router } from 'express'
import { taskController, upload, createTaskSchema, updateTaskSchema, moveTaskSchema, createCommentSchema, createSubtaskSchema, bulkActionSchema } from '@/controllers/task.controller'
import { authenticate } from '@/middleware/auth'
import { orgAccess } from '@/middleware/orgAccess'
import { validate } from '@/middleware/validate'
import { uploadLimiter } from '@/middleware/rateLimiter'
import { prisma } from '@/config/database'
import { AuthenticatedRequest } from '@/types'

const router = Router({ mergeParams: true })

router.use(authenticate, orgAccess)

/**
 * @swagger
 * /organizations/{orgId}/projects/{projectId}/tasks:
 *   get:
 *     summary: List tasks (filterable, paginated)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [CRITICAL, HIGH, MEDIUM, LOW]
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: labelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Paginated task list
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *               priority:
 *                 type: string
 *                 enum: [CRITICAL, HIGH, MEDIUM, LOW]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               storyPoints:
 *                 type: integer
 *               assigneeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               labelIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Task created
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/kanban:
 *   get:
 *     summary: Get Kanban board (tasks grouped by status)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: labelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [CRITICAL, HIGH, MEDIUM, LOW]
 *     responses:
 *       200:
 *         description: Board grouped by status (BACKLOG/TODO/IN_PROGRESS/IN_REVIEW/DONE)
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/bulk:
 *   post:
 *     summary: Bulk move or delete tasks
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, taskIds]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [move, delete]
 *               taskIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *     responses:
 *       200:
 *         description: Bulk action completed
 */
router.get('/', taskController.list)
router.get('/kanban', taskController.kanban)
router.post('/', validate(createTaskSchema), taskController.create)
router.post('/bulk', validate(bulkActionSchema), taskController.bulkAction)

router.get('/export', async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.params
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    include: {
      assignees: { include: { user: { select: { name: true } } } },
      labels: { include: { label: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = [
    ['ID', 'Title', 'Status', 'Priority', 'Assignees', 'Due Date', 'Story Points', 'Labels', 'Created At'],
    ...tasks.map((t) => [
      t.id,
      t.title,
      t.status,
      t.priority,
      t.assignees.map((a) => a.user.name).join('; '),
      t.dueDate ? t.dueDate.toISOString().split('T')[0] : '',
      t.storyPoints?.toString() ?? '',
      t.labels.map((l) => l.label.name).join('; '),
      t.createdAt.toISOString(),
    ]),
  ]

  const csv = rows.map((r) => r.map((c) => escape(String(c))).join(',')).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="tasks-${projectId}.csv"`)
  res.send(csv)
})

/**
 * @swagger
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}:
 *   get:
 *     summary: Get task details (includes assignees, labels, subtasks)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task detail
 *   patch:
 *     summary: Update task fields
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task updated
 *   delete:
 *     summary: Soft-delete a task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/move:
 *   patch:
 *     summary: Move task to new status/position (Kanban drag-drop)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, position]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *               position:
 *                 type: number
 *     responses:
 *       200:
 *         description: Task moved
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/assignees:
 *   post:
 *     summary: Add assignee to task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Assignee added
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/assignees/{userId}:
 *   delete:
 *     summary: Remove assignee from task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assignee removed
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/comments:
 *   get:
 *     summary: List task comments
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated comment list
 *   post:
 *     summary: Add a comment (supports @mentions)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment (soft delete)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/attachments:
 *   get:
 *     summary: List task attachments
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of attachments
 *   post:
 *     summary: Upload file attachment (multipart/form-data)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/subtasks:
 *   get:
 *     summary: List subtasks
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of subtasks
 *   post:
 *     summary: Create a subtask
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Subtask created
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/subtasks/{subtaskId}:
 *   patch:
 *     summary: Update subtask (toggle complete, rename)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Subtask updated
 *   delete:
 *     summary: Delete subtask
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subtask deleted
 *
 * /organizations/{orgId}/projects/{projectId}/tasks/{taskId}/activities:
 *   get:
 *     summary: Get task activity history
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated activity log
 */
router.get('/:taskId', taskController.getById)
router.patch('/:taskId', validate(updateTaskSchema), taskController.update)
router.delete('/:taskId', taskController.delete)
router.patch('/:taskId/move', validate(moveTaskSchema), taskController.moveTask)

router.post('/:taskId/assignees', taskController.addAssignee)
router.delete('/:taskId/assignees/:userId', taskController.removeAssignee)

router.post('/:taskId/labels', taskController.addLabel)
router.delete('/:taskId/labels/:labelId', taskController.removeLabel)

router.get('/:taskId/comments', taskController.getComments)
router.post('/:taskId/comments', validate(createCommentSchema), taskController.createComment)
router.delete('/:taskId/comments/:commentId', taskController.deleteComment)

router.post('/:taskId/attachments', uploadLimiter, upload.single('file'), taskController.uploadAttachment)
router.get('/:taskId/attachments', taskController.getAttachments)
router.delete('/:taskId/attachments/:attachmentId', taskController.deleteAttachment)

router.get('/:taskId/subtasks', taskController.getSubtasks)
router.post('/:taskId/subtasks', validate(createSubtaskSchema), taskController.createSubtask)
router.patch('/:taskId/subtasks/:subtaskId', taskController.updateSubtask)
router.delete('/:taskId/subtasks/:subtaskId', taskController.deleteSubtask)

router.get('/:taskId/activities', taskController.getActivities)

export default router
