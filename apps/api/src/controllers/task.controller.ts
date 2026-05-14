import { Response } from 'express'
import { z } from 'zod'
import { taskService } from '@/services/task.service'
import { AuthenticatedRequest } from '@/types'
import { successResponse, paginatedResponse } from '@/utils/response'
import { getPaginationParams } from '@/utils/pagination'
import { TaskStatus, Priority } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import { env } from '@/config/env'

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
})

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z.string().datetime().optional(),
  storyPoints: z.number().int().min(0).optional(),
  assigneeIds: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
})

export const updateTaskSchema = createTaskSchema.partial().omit({ assigneeIds: true, labelIds: true })

export const moveTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  position: z.number(),
})

export const createCommentSchema = z.object({ content: z.string().min(1) })
export const createSubtaskSchema = z.object({ title: z.string().min(1) })
export const bulkActionSchema = z.object({
  action: z.enum(['move', 'delete']),
  taskIds: z.array(z.string()).min(1),
  status: z.nativeEnum(TaskStatus).optional(),
})

export const taskController = {
  list: async (req: AuthenticatedRequest, res: Response) => {
    const params = getPaginationParams(req.query)
    const result = await taskService.list(req.params.projectId, {
      ...params,
      status: req.query.status as TaskStatus,
      priority: req.query.priority as Priority,
      assigneeId: req.query.assigneeId as string,
      labelId: req.query.labelId as string,
    })
    paginatedResponse(res, result.items, result.total, params.page, params.limit)
  },

  kanban: async (req: AuthenticatedRequest, res: Response) => {
    const board = await taskService.getKanbanBoard(req.params.projectId, {
      assigneeId: req.query.assigneeId as string,
      labelId: req.query.labelId as string,
      priority: req.query.priority as Priority,
    })
    successResponse(res, board)
  },

  create: async (req: AuthenticatedRequest, res: Response) => {
    const task = await taskService.create(req.params.projectId, req.user!.id, req.body)
    successResponse(res, task, 201, 'Task created')
  },

  getById: async (req: AuthenticatedRequest, res: Response) => {
    const task = await taskService.getById(req.params.taskId, req.params.projectId)
    successResponse(res, task)
  },

  update: async (req: AuthenticatedRequest, res: Response) => {
    const task = await taskService.update(req.params.taskId, req.params.projectId, req.user!.id, req.body)
    successResponse(res, task, 200, 'Task updated')
  },

  delete: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.delete(req.params.taskId, req.params.projectId, req.user!.id)
    successResponse(res, null, 200, 'Task deleted')
  },

  moveTask: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.moveTask(req.params.taskId, req.params.projectId, req.user!.id, req.body.status, req.body.position)
    successResponse(res, null, 200, 'Task moved')
  },

  addAssignee: async (req: AuthenticatedRequest, res: Response) => {
    const result = await taskService.addAssignee(req.params.taskId, req.params.projectId, req.user!.id, req.body.userId)
    successResponse(res, result, 201, 'Assignee added')
  },

  removeAssignee: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.removeAssignee(req.params.taskId, req.params.projectId, req.user!.id, req.params.userId)
    successResponse(res, null, 200, 'Assignee removed')
  },

  addLabel: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.addLabel(req.params.taskId, req.params.projectId, req.body.labelId)
    successResponse(res, null, 201, 'Label added')
  },

  removeLabel: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.removeLabel(req.params.taskId, req.params.projectId, req.params.labelId)
    successResponse(res, null, 200, 'Label removed')
  },

  getComments: async (req: AuthenticatedRequest, res: Response) => {
    const params = getPaginationParams(req.query)
    const { items, total } = await taskService.getComments(req.params.taskId, req.params.projectId, params)
    paginatedResponse(res, items, total, params.page, params.limit)
  },

  createComment: async (req: AuthenticatedRequest, res: Response) => {
    const comment = await taskService.createComment(req.params.taskId, req.params.projectId, req.user!.id, req.body.content)
    successResponse(res, comment, 201, 'Comment added')
  },

  deleteComment: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.deleteComment(req.params.commentId, req.user!.id)
    successResponse(res, null, 200, 'Comment deleted')
  },

  uploadAttachment: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      successResponse(res, null, 400, 'No file uploaded')
      return
    }
    const attachment = await taskService.createAttachment(req.params.taskId, req.params.projectId, req.user!.id, req.file)
    successResponse(res, attachment, 201, 'File uploaded')
  },

  getAttachments: async (req: AuthenticatedRequest, res: Response) => {
    const attachments = await taskService.getAttachments(req.params.taskId, req.params.projectId)
    successResponse(res, attachments)
  },

  deleteAttachment: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.deleteAttachment(req.params.attachmentId)
    successResponse(res, null, 200, 'Attachment deleted')
  },

  getSubtasks: async (req: AuthenticatedRequest, res: Response) => {
    const task = await taskService.getById(req.params.taskId, req.params.projectId)
    successResponse(res, task?.subtasks ?? [])
  },

  createSubtask: async (req: AuthenticatedRequest, res: Response) => {
    const subtask = await taskService.createSubtask(req.params.taskId, req.params.projectId, req.body)
    successResponse(res, subtask, 201, 'Subtask created')
  },

  updateSubtask: async (req: AuthenticatedRequest, res: Response) => {
    const subtask = await taskService.updateSubtask(req.params.subtaskId, req.body)
    successResponse(res, subtask, 200, 'Subtask updated')
  },

  deleteSubtask: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.deleteSubtask(req.params.subtaskId)
    successResponse(res, null, 200, 'Subtask deleted')
  },

  getActivities: async (req: AuthenticatedRequest, res: Response) => {
    const params = getPaginationParams(req.query)
    const { items, total } = await taskService.getActivities(req.params.taskId, req.params.projectId, params)
    paginatedResponse(res, items, total, params.page, params.limit)
  },

  bulkAction: async (req: AuthenticatedRequest, res: Response) => {
    await taskService.bulkAction(req.params.projectId, req.user!.id, req.body.action, req.body.taskIds, req.body.status)
    successResponse(res, null, 200, 'Bulk action completed')
  },
}
