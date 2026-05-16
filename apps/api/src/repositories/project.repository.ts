import { prisma } from '@/config/database'

const notDeleted = { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] }
import { ProjectStatus, Visibility, ProjectRole, Prisma } from '@prisma/client'
import { PaginationParams } from '@/types'
import { getSkip } from '@/utils/pagination'

const projectInclude = {
  _count: { select: { tasks: { where: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } }, members: true } },
  members: {
    take: 5,
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  },
}

export const projectRepository = {
  create: (data: {
    organizationId: string
    name: string
    description?: string
    status?: ProjectStatus
    visibility?: Visibility
    startDate?: Date
    endDate?: Date
    leadId?: string
  }) => prisma.project.create({ data, include: projectInclude }),

  findById: (projectId: string, orgId: string) =>
    prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, ...notDeleted },
      include: {
        ...projectInclude,
        labels: true,
      },
    }),

  list: async (orgId: string, params: PaginationParams & { status?: ProjectStatus }) => {
    const where: Prisma.ProjectWhereInput = {
      organizationId: orgId,
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      ...(params.status && { status: params.status }),
      ...(params.search && {
        name: { contains: params.search, mode: 'insensitive' },
      }),
    }
    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: projectInclude,
        skip: getSkip(params.page, params.limit),
        take: params.limit,
        orderBy: { [params.sortBy || 'createdAt']: params.sortOrder || 'desc' },
      }),
      prisma.project.count({ where }),
    ])
    return { items, total }
  },

  update: (projectId: string, data: Prisma.ProjectUpdateInput) =>
    prisma.project.update({ where: { id: projectId }, data, include: projectInclude }),

  softDelete: (projectId: string) =>
    prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } }),

  addMember: (projectId: string, userId: string, role: ProjectRole) =>
    prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role },
      update: { role },
    }),

  removeMember: (projectId: string, userId: string) =>
    prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    }),

  getMembers: (projectId: string) =>
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),

  isMember: (projectId: string, userId: string) =>
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    }),

  getStats: async (projectId: string) => {
    const [total, completed, overdue] = await Promise.all([
      prisma.task.count({ where: { projectId, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } }),
      prisma.task.count({ where: { projectId, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }], status: 'DONE' } }),
      prisma.task.count({
        where: {
          projectId,
          OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
          status: { not: 'DONE' },
          dueDate: { lt: new Date() },
        },
      }),
    ])
    return {
      totalTasks: total,
      completedTasks: completed,
      completionPercentage: total ? Math.round((completed / total) * 100) : 0,
      overdueTasks: overdue,
    }
  },

  getBurndownTasks: (projectId: string) =>
    prisma.task.findMany({
      where: { projectId, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
      select: { status: true, updatedAt: true },
    }),

  createLabel: (data: { projectId: string; name: string; color?: string }) =>
    prisma.label.create({ data }),

  getLabels: (projectId: string) => prisma.label.findMany({ where: { projectId } }),

  deleteLabel: (labelId: string) => prisma.label.delete({ where: { id: labelId } }),
}
