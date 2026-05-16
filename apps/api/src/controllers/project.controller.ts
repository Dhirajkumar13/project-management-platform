import { Response } from 'express'
import { z } from 'zod'
import { projectService } from '@/services/project.service'
import { AuthenticatedRequest } from '@/types'
import { successResponse, paginatedResponse } from '@/utils/response'
import { getPaginationParams } from '@/utils/pagination'
import { ProjectStatus, Visibility, ProjectRole } from '@prisma/client'

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  visibility: z.nativeEnum(Visibility).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  leadId: z.string().optional(),
})

export const updateProjectSchema = createProjectSchema.partial()

export const addMemberSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(ProjectRole).default('MEMBER'),
})

export const createLabelSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export const projectController = {
  list: async (req: AuthenticatedRequest, res: Response) => {
    const params = getPaginationParams(req.query)
    const status = req.query.status as ProjectStatus | undefined
    const { items, total } = await projectService.list(req.params.orgId, { ...params, status })
    paginatedResponse(res, items, total, params.page, params.limit)
  },

  create: async (req: AuthenticatedRequest, res: Response) => {
    const project = await projectService.create(req.params.orgId, req.user!.id, req.body)
    successResponse(res, project, 201, 'Project created')
  },

  getById: async (req: AuthenticatedRequest, res: Response) => {
    const project = await projectService.getById(req.params.projectId, req.params.orgId)
    successResponse(res, project)
  },

  update: async (req: AuthenticatedRequest, res: Response) => {
    const project = await projectService.update(req.params.projectId, req.params.orgId, req.user!.id, req.body)
    successResponse(res, project, 200, 'Project updated')
  },

  delete: async (req: AuthenticatedRequest, res: Response) => {
    await projectService.delete(req.params.projectId, req.params.orgId, req.user!.id)
    successResponse(res, null, 200, 'Project deleted')
  },

  getMembers: async (req: AuthenticatedRequest, res: Response) => {
    const members = await projectService.getMembers(req.params.projectId)
    successResponse(res, members)
  },

  addMember: async (req: AuthenticatedRequest, res: Response) => {
    const member = await projectService.addMember(req.params.projectId, req.body.userId, req.body.role)
    successResponse(res, member, 201, 'Member added')
  },

  removeMember: async (req: AuthenticatedRequest, res: Response) => {
    await projectService.removeMember(req.params.projectId, req.params.userId)
    successResponse(res, null, 200, 'Member removed')
  },

  getStats: async (req: AuthenticatedRequest, res: Response) => {
    const stats = await projectService.getStats(req.params.projectId)
    successResponse(res, stats)
  },

  getLabels: async (req: AuthenticatedRequest, res: Response) => {
    const labels = await projectService.getLabels(req.params.projectId)
    successResponse(res, labels)
  },

  createLabel: async (req: AuthenticatedRequest, res: Response) => {
    const label = await projectService.createLabel(req.params.projectId, req.body)
    successResponse(res, label, 201, 'Label created')
  },

  deleteLabel: async (req: AuthenticatedRequest, res: Response) => {
    await projectService.deleteLabel(req.params.labelId)
    successResponse(res, null, 200, 'Label deleted')
  },

  getBurndown: async (req: AuthenticatedRequest, res: Response) => {
    const data = await projectService.getBurndown(req.params.projectId, req.params.orgId)
    successResponse(res, data)
  },
}
