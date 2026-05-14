import { Response } from 'express'
import { z } from 'zod'
import { organizationService } from '@/services/organization.service'
import { AuthenticatedRequest } from '@/types'
import { successResponse, paginatedResponse } from '@/utils/response'
import { getPaginationParams } from '@/utils/pagination'
import { OrgRole } from '@prisma/client'

export const createOrgSchema = z.object({ name: z.string().min(2) })
export const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  logoUrl: z.string().url().optional(),
  billingInfo: z.record(z.unknown()).optional(),
})
export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(OrgRole).default('MEMBER'),
})
export const updateRoleSchema = z.object({
  role: z.nativeEnum(OrgRole),
})

export const organizationController = {
  getUserOrgs: async (req: AuthenticatedRequest, res: Response) => {
    const memberships = await organizationService.getUserOrgs(req.user!.id)
    successResponse(res, memberships.map((m) => ({ ...m.organization, role: m.role })))
  },

  create: async (req: AuthenticatedRequest, res: Response) => {
    const org = await organizationService.create(req.user!.id, req.body)
    successResponse(res, org, 201, 'Organization created')
  },

  getById: async (req: AuthenticatedRequest, res: Response) => {
    const org = await organizationService.getById(req.params.orgId)
    successResponse(res, org)
  },

  update: async (req: AuthenticatedRequest, res: Response) => {
    const org = await organizationService.update(req.params.orgId, req.body)
    successResponse(res, org, 200, 'Organization updated')
  },

  delete: async (req: AuthenticatedRequest, res: Response) => {
    await organizationService.delete(req.params.orgId)
    successResponse(res, null, 200, 'Organization deleted')
  },

  getMembers: async (req: AuthenticatedRequest, res: Response) => {
    const params = getPaginationParams(req.query)
    const { items, total } = await organizationService.getMembers(req.params.orgId, params)
    paginatedResponse(res, items, total, params.page, params.limit)
  },

  inviteMember: async (req: AuthenticatedRequest, res: Response) => {
    const invite = await organizationService.inviteMember(
      req.params.orgId,
      req.user!.id,
      req.body.email,
      req.body.role,
      'User', // would fetch name from DB in a full impl
      req.params.orgId
    )
    successResponse(res, invite, 201, 'Invitation sent')
  },

  acceptInvite: async (req: AuthenticatedRequest, res: Response) => {
    const org = await organizationService.acceptInvite(req.params.token, req.user!.id)
    successResponse(res, org, 200, 'Joined organization')
  },

  updateMemberRole: async (req: AuthenticatedRequest, res: Response) => {
    const member = await organizationService.updateMemberRole(
      req.params.orgId,
      req.params.userId,
      req.body.role,
      req.user!.id
    )
    successResponse(res, member, 200, 'Role updated')
  },

  removeMember: async (req: AuthenticatedRequest, res: Response) => {
    await organizationService.removeMember(req.params.orgId, req.params.userId, req.user!.id)
    successResponse(res, null, 200, 'Member removed')
  },

  getAuditLog: async (req: AuthenticatedRequest, res: Response) => {
    const params = getPaginationParams(req.query)
    const { items, total } = await organizationService.getAuditLog(req.params.orgId, params)
    paginatedResponse(res, items, total, params.page, params.limit)
  },
}
