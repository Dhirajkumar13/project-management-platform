import { projectRepository } from '@/repositories/project.repository'
import { AppError } from '@/middleware/error'
import { ProjectStatus, Visibility, ProjectRole, Prisma } from '@prisma/client'
import { PaginationParams } from '@/types'
import { organizationRepository } from '@/repositories/organization.repository'
import { webhookService } from '@/services/webhook.service'

export const projectService = {
  create: async (orgId: string, userId: string, data: {
    name: string
    description?: string
    status?: ProjectStatus
    visibility?: Visibility
    startDate?: string
    endDate?: string
    leadId?: string
  }) => {
    const project = await projectRepository.create({
      organizationId: orgId,
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    })
    await projectRepository.addMember(project.id, userId, 'LEAD')

    const DEFAULT_LABELS = [
      { name: 'Bug',         color: '#ef4444' },
      { name: 'Feature',     color: '#6366f1' },
      { name: 'Enhancement', color: '#3b82f6' },
      { name: 'Task',        color: '#10b981' },
      { name: 'Documentation', color: '#f59e0b' },
      { name: 'Design',      color: '#ec4899' },
    ]
    await Promise.all(
      DEFAULT_LABELS.map((l) => projectRepository.createLabel({ projectId: project.id, ...l }))
    )
    await organizationRepository.createAuditLog({
      organizationId: orgId, userId, action: 'project.created',
      entityType: 'project', entityId: project.id, metadata: { name: project.name },
    })
    webhookService.trigger(orgId, 'project.created', { projectId: project.id, name: project.name }).catch(() => {})
    return project
  },

  getById: async (projectId: string, orgId: string) => {
    const project = await projectRepository.findById(projectId, orgId)
    if (!project) throw new AppError('Project not found', 404)
    const stats = await projectRepository.getStats(projectId)
    return { ...project, stats }
  },

  list: async (orgId: string, params: PaginationParams & { status?: ProjectStatus }) => {
    const result = await projectRepository.list(orgId, params)
    if (!result.items.length) return result
    const statsArr = await Promise.all(result.items.map((p) => projectRepository.getStats(p.id)))
    return { ...result, items: result.items.map((p, i) => ({ ...p, stats: statsArr[i] })) }
  },

  update: async (projectId: string, orgId: string, userId: string, data: {
    name?: string
    description?: string
    status?: ProjectStatus
    visibility?: Visibility
    startDate?: string
    endDate?: string
    leadId?: string
  }) => {
    const project = await projectRepository.findById(projectId, orgId)
    if (!project) throw new AppError('Project not found', 404)
    const updated = await projectRepository.update(projectId, {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    })
    await organizationRepository.createAuditLog({
      organizationId: orgId, userId, action: 'project.updated',
      entityType: 'project', entityId: projectId, metadata: data as unknown as Prisma.InputJsonValue,
    })
    webhookService.trigger(orgId, 'project.updated', { projectId, changes: data }).catch(() => {})
    return updated
  },

  delete: async (projectId: string, orgId: string, userId: string) => {
    const project = await projectRepository.findById(projectId, orgId)
    if (!project) throw new AppError('Project not found', 404)
    await projectRepository.softDelete(projectId)
    await organizationRepository.createAuditLog({
      organizationId: orgId, userId, action: 'project.deleted',
      entityType: 'project', entityId: projectId, metadata: { name: project.name },
    })
    webhookService.trigger(orgId, 'project.deleted', { projectId, name: project.name }).catch(() => {})
  },

  addMember: async (projectId: string, userId: string, role: ProjectRole) => {
    return projectRepository.addMember(projectId, userId, role)
  },

  removeMember: async (projectId: string, userId: string) => {
    return projectRepository.removeMember(projectId, userId)
  },

  getMembers: async (projectId: string) => {
    return projectRepository.getMembers(projectId)
  },

  getStats: async (projectId: string) => {
    return projectRepository.getStats(projectId)
  },

  createLabel: async (projectId: string, data: { name: string; color?: string }) => {
    return projectRepository.createLabel({ projectId, ...data })
  },

  getLabels: async (projectId: string) => {
    return projectRepository.getLabels(projectId)
  },

  deleteLabel: async (labelId: string) => {
    return projectRepository.deleteLabel(labelId)
  },

  getBurndown: async (projectId: string, orgId: string) => {
    const project = await projectRepository.findById(projectId, orgId)
    if (!project) throw new AppError('Project not found', 404)

    const tasks = await projectRepository.getBurndownTasks(projectId)
    if (tasks.length === 0) return []

    const totalTasks = tasks.length
    const startDate = new Date(project.startDate ?? project.createdAt)
    startDate.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const idealEnd = project.endDate
      ? new Date(project.endDate)
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const totalDays = Math.max(1, Math.ceil((idealEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const endDate = idealEnd < today ? idealEnd : today

    const doneDates = tasks.filter((t) => t.status === 'DONE').map((t) => t.updatedAt)
    const result: { date: string; remaining: number; ideal: number }[] = []
    let current = new Date(startDate)

    while (current <= endDate) {
      const dayEnd = new Date(current)
      dayEnd.setHours(23, 59, 59, 999)
      const completed = doneDates.filter((d) => d <= dayEnd).length
      const remaining = Math.max(0, totalTasks - completed)
      const dayIndex = Math.ceil((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const ideal = Math.max(0, Math.round(totalTasks * (1 - dayIndex / totalDays)))
      result.push({ date: current.toISOString().split('T')[0], remaining, ideal })
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
    }

    return result
  },
}
