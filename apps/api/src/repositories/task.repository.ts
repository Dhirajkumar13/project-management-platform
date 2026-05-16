import { prisma } from '@/config/database'

const notDeleted = { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } as const
import { TaskStatus, Priority, Prisma } from '@prisma/client'
import { PaginationParams } from '@/types'
import { getSkip } from '@/utils/pagination'

const taskInclude = {
  assignees: {
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  },
  labels: { include: { label: true } },
  subtasks: { orderBy: { position: 'asc' as const } },
  _count: { select: { comments: { where: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } }, attachments: true } },
}

export const taskRepository = {
  create: (data: {
    projectId: string
    title: string
    description?: string
    status?: TaskStatus
    priority?: Priority
    dueDate?: Date
    storyPoints?: number
    position?: number
  }) => prisma.task.create({ data, include: taskInclude }),

  findById: (taskId: string, projectId: string) =>
    prisma.task.findFirst({
      where: { id: taskId, projectId, ...notDeleted },
      include: taskInclude,
    }),

  list: async (projectId: string, params: PaginationParams & {
    status?: TaskStatus
    priority?: Priority
    assigneeId?: string
    labelId?: string
  }) => {
    const where: Prisma.TaskWhereInput = {
      projectId,
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      ...(params.status && { status: params.status }),
      ...(params.priority && { priority: params.priority }),
      ...(params.assigneeId && { assignees: { some: { userId: params.assigneeId } } }),
      ...(params.labelId && { labels: { some: { labelId: params.labelId } } }),
      ...(params.search && { title: { contains: params.search, mode: 'insensitive' } }),
    }
    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: taskInclude,
        skip: getSkip(params.page, params.limit),
        take: params.limit,
        orderBy: { [params.sortBy || 'position']: params.sortOrder || 'asc' },
      }),
      prisma.task.count({ where }),
    ])
    return { items, total }
  },

  getKanbanBoard: async (projectId: string, filters: { assigneeId?: string; labelId?: string; priority?: Priority }) => {
    const where: Prisma.TaskWhereInput = {
      projectId,
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      ...(filters.assigneeId && { assignees: { some: { userId: filters.assigneeId } } }),
      ...(filters.labelId && { labels: { some: { labelId: filters.labelId } } }),
      ...(filters.priority && { priority: filters.priority }),
    }
    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { position: 'asc' },
    })
    const board: Record<TaskStatus, typeof tasks> = {
      BACKLOG: [], TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [],
    }
    for (const task of tasks) board[task.status].push(task)
    return board
  },

  update: (taskId: string, data: Prisma.TaskUpdateInput) =>
    prisma.task.update({ where: { id: taskId }, data, include: taskInclude }),

  softDelete: (taskId: string) =>
    prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } }),

  moveTask: (taskId: string, status: TaskStatus, position: number) =>
    prisma.task.update({ where: { id: taskId }, data: { status, position } }),

  bulkUpdateStatus: (taskIds: string[], status: TaskStatus) =>
    prisma.task.updateMany({ where: { id: { in: taskIds } }, data: { status } }),

  bulkDelete: (taskIds: string[]) =>
    prisma.task.updateMany({ where: { id: { in: taskIds } }, data: { deletedAt: new Date() } }),

  addAssignee: (taskId: string, userId: string) =>
    prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId },
      update: {},
    }),

  removeAssignee: (taskId: string, userId: string) =>
    prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } }),

  addLabel: (taskId: string, labelId: string) =>
    prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId, labelId } },
      create: { taskId, labelId },
      update: {},
    }),

  removeLabel: (taskId: string, labelId: string) =>
    prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } }),

  createComment: (data: { taskId: string; userId: string; content: string; mentions?: string[] }) =>
    prisma.taskComment.create({
      data: { ...data, mentions: data.mentions ?? [] },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),

  getComments: (taskId: string, params: PaginationParams) =>
    prisma.taskComment.findMany({
      where: { taskId, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      skip: getSkip(params.page, params.limit),
      take: params.limit,
      orderBy: { createdAt: 'asc' },
    }),

  getCommentsCount: (taskId: string) =>
    prisma.taskComment.count({ where: { taskId, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } }),

  deleteComment: (commentId: string) =>
    prisma.taskComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),

  createAttachment: (data: {
    taskId: string
    name: string
    url: string
    size: number
    mimeType: string
    uploadedById: string
  }) =>
    prisma.taskAttachment.create({
      data,
      include: { uploadedBy: { select: { id: true, name: true } } },
    }),

  getAttachments: (taskId: string) =>
    prisma.taskAttachment.findMany({
      where: { taskId },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),

  deleteAttachment: (attachmentId: string) =>
    prisma.taskAttachment.delete({ where: { id: attachmentId } }),

  createSubtask: (data: { taskId: string; title: string; position?: number }) =>
    prisma.subtask.create({ data }),

  updateSubtask: (subtaskId: string, data: { title?: string; completed?: boolean; position?: number }) =>
    prisma.subtask.update({ where: { id: subtaskId }, data }),

  deleteSubtask: (subtaskId: string) =>
    prisma.subtask.delete({ where: { id: subtaskId } }),

  createActivity: (data: {
    taskId: string
    userId: string
    action: string
    oldValue?: string
    newValue?: string
  }) => prisma.taskActivity.create({ data }),

  getActivities: (taskId: string, params: PaginationParams) =>
    prisma.taskActivity.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      skip: getSkip(params.page, params.limit),
      take: params.limit,
      orderBy: { createdAt: 'desc' },
    }),

  getActivitiesCount: (taskId: string) =>
    prisma.taskActivity.count({ where: { taskId } }),
}
