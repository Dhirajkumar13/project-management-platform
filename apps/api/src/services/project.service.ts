import { projectRepository } from '@/repositories/project.repository'
import { AppError } from '@/middleware/error'
import { ProjectStatus, Visibility, ProjectRole } from '@prisma/client'
import { PaginationParams } from '@/types'

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

  update: async (projectId: string, orgId: string, data: {
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
    return projectRepository.update(projectId, {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    })
  },

  delete: async (projectId: string, orgId: string) => {
    const project = await projectRepository.findById(projectId, orgId)
    if (!project) throw new AppError('Project not found', 404)
    await projectRepository.softDelete(projectId)
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
