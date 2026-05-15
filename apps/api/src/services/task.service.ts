import { taskRepository } from '@/repositories/task.repository'
import { AppError } from '@/middleware/error'
import { TaskStatus, Priority } from '@prisma/client'
import { PaginationParams } from '@/types'
import { emitToProject, emitToTask, emitToUser } from '@/config/socket'
import { prisma } from '@/config/database'

export const taskService = {
  create: async (projectId: string, userId: string, data: {
    title: string
    description?: string
    status?: TaskStatus
    priority?: Priority
    dueDate?: string
    storyPoints?: number
    assigneeIds?: string[]
    labelIds?: string[]
  }) => {
    const lastTask = await prisma.task.findFirst({
      where: { projectId, status: data.status || 'BACKLOG', deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const position = (lastTask?.position ?? 0) + 1000

    const task = await taskRepository.create({
      projectId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      storyPoints: data.storyPoints,
      position,
    })

    if (data.assigneeIds?.length) {
      for (const uid of data.assigneeIds) {
        await taskRepository.addAssignee(task.id, uid)
      }
    }
    if (data.labelIds?.length) {
      for (const lid of data.labelIds) {
        await taskRepository.addLabel(task.id, lid)
      }
    }

    await taskRepository.createActivity({ taskId: task.id, userId, action: 'created task' })
    const fullTask = await taskRepository.findById(task.id, projectId)
    emitToProject(projectId, 'task:created', fullTask)
    return fullTask
  },

  getById: async (taskId: string, projectId: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    return task
  },

  list: async (projectId: string, params: PaginationParams & {
    status?: TaskStatus
    priority?: Priority
    assigneeId?: string
    labelId?: string
  }) => taskRepository.list(projectId, params),

  getKanbanBoard: async (projectId: string, filters: {
    assigneeId?: string
    labelId?: string
    priority?: Priority
  }) => taskRepository.getKanbanBoard(projectId, filters),

  update: async (taskId: string, projectId: string, userId: string, data: {
    title?: string
    description?: string
    status?: TaskStatus
    priority?: Priority
    dueDate?: string
    storyPoints?: number
  }) => {
    const existing = await taskRepository.findById(taskId, projectId)
    if (!existing) throw new AppError('Task not found', 404)

    const updates: { action: string; old: string; new: string }[] = []
    if (data.status && data.status !== existing.status) {
      updates.push({ action: 'changed status', old: existing.status, new: data.status })
    }
    if (data.priority && data.priority !== existing.priority) {
      updates.push({ action: 'changed priority', old: existing.priority, new: data.priority })
    }
    if (data.title && data.title !== existing.title) {
      updates.push({ action: 'updated title', old: existing.title, new: data.title })
    }

    const updated = await taskRepository.update(taskId, {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    })

    for (const u of updates) {
      await taskRepository.createActivity({ taskId, userId, action: u.action, oldValue: u.old, newValue: u.new })
    }

    emitToProject(projectId, 'task:updated', updated)
    return updated
  },

  delete: async (taskId: string, projectId: string, userId: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    await taskRepository.softDelete(taskId)
    await taskRepository.createActivity({ taskId, userId, action: 'deleted task' })
    emitToProject(projectId, 'task:deleted', { taskId, projectId })
  },

  moveTask: async (taskId: string, projectId: string, userId: string, status: TaskStatus, position: number) => {
    const existing = await taskRepository.findById(taskId, projectId)
    if (!existing) throw new AppError('Task not found', 404)

    await taskRepository.moveTask(taskId, status, position)
    if (existing.status !== status) {
      await taskRepository.createActivity({
        taskId, userId, action: 'moved task', oldValue: existing.status, newValue: status,
      })
    }
    emitToProject(projectId, 'task:moved', { taskId, projectId, status, position })
  },

  addAssignee: async (taskId: string, projectId: string, userId: string, assigneeId: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    const assignee = await taskRepository.addAssignee(taskId, assigneeId)
    await taskRepository.createActivity({ taskId, userId, action: 'added assignee', newValue: assigneeId })
    const updated = await taskRepository.findById(taskId, projectId)
    emitToProject(projectId, 'task:updated', updated)

    if (assigneeId !== userId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      })
      const notification = await prisma.notification.create({
        data: {
          userId: assigneeId,
          organizationId: project?.organizationId,
          type: 'task_assigned',
          title: 'Task assigned to you',
          message: `You were assigned to "${task.title}"`,
          data: { taskId, projectId },
        },
      })
      emitToUser(assigneeId, 'notification:new', notification)
    }

    return assignee
  },

  removeAssignee: async (taskId: string, projectId: string, userId: string, assigneeId: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    await taskRepository.removeAssignee(taskId, assigneeId)
    await taskRepository.createActivity({ taskId, userId, action: 'removed assignee', oldValue: assigneeId })
    const updated = await taskRepository.findById(taskId, projectId)
    emitToProject(projectId, 'task:updated', updated)
  },

  addLabel: async (taskId: string, projectId: string, labelId: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    await taskRepository.addLabel(taskId, labelId)
    const updated = await taskRepository.findById(taskId, projectId)
    emitToProject(projectId, 'task:updated', updated)
  },

  removeLabel: async (taskId: string, projectId: string, labelId: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    await taskRepository.removeLabel(taskId, labelId)
    const updated = await taskRepository.findById(taskId, projectId)
    emitToProject(projectId, 'task:updated', updated)
  },

  createComment: async (taskId: string, projectId: string, userId: string, content: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    const mentions = (content.match(/@(\w+)/g) || []).map((m) => m.slice(1))
    const comment = await taskRepository.createComment({ taskId, userId, content, mentions })
    emitToTask(taskId, 'comment:created', comment)
    emitToProject(projectId, 'comment:created', { taskId, comment })
    return comment
  },

  getComments: async (taskId: string, projectId: string, params: PaginationParams) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    const [items, total] = await Promise.all([
      taskRepository.getComments(taskId, params),
      taskRepository.getCommentsCount(taskId),
    ])
    return { items, total }
  },

  deleteComment: async (commentId: string, userId: string) => {
    await taskRepository.deleteComment(commentId)
  },

  createAttachment: async (taskId: string, projectId: string, userId: string, file: {
    originalname: string
    path: string
    size: number
    mimetype: string
  }) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    const url = `/uploads/${file.path.split('/').pop()}`
    return taskRepository.createAttachment({
      taskId,
      name: file.originalname,
      url,
      size: file.size,
      mimeType: file.mimetype,
      uploadedById: userId,
    })
  },

  getAttachments: async (taskId: string, projectId: string) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    return taskRepository.getAttachments(taskId)
  },

  deleteAttachment: async (attachmentId: string) => {
    await taskRepository.deleteAttachment(attachmentId)
  },

  createSubtask: async (taskId: string, projectId: string, data: { title: string }) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    const position = task.subtasks?.length ?? 0
    return taskRepository.createSubtask({ taskId, title: data.title, position })
  },

  updateSubtask: async (subtaskId: string, data: { title?: string; completed?: boolean }) => {
    return taskRepository.updateSubtask(subtaskId, data)
  },

  deleteSubtask: async (subtaskId: string) => {
    await taskRepository.deleteSubtask(subtaskId)
  },

  getActivities: async (taskId: string, projectId: string, params: PaginationParams) => {
    const task = await taskRepository.findById(taskId, projectId)
    if (!task) throw new AppError('Task not found', 404)
    const [items, total] = await Promise.all([
      taskRepository.getActivities(taskId, params),
      taskRepository.getActivitiesCount(taskId),
    ])
    return { items, total }
  },

  bulkAction: async (projectId: string, userId: string, action: 'move' | 'delete', taskIds: string[], status?: TaskStatus) => {
    if (action === 'move' && status) {
      await taskRepository.bulkUpdateStatus(taskIds, status)
    } else if (action === 'delete') {
      await taskRepository.bulkDelete(taskIds)
    }
    emitToProject(projectId, 'tasks:bulk-updated', { taskIds, action, status })
  },
}
