import { projectRepository } from '@/repositories/project.repository'
import { AppError } from '@/middleware/error'
import { ProjectStatus, Visibility, ProjectRole } from '@prisma/client'
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
    return projectRepository.list(orgId, params)
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
      entityType: 'project', entityId: projectId, metadata: data as Record<string, unknown>,
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
}
