import { v4 as uuidv4 } from 'uuid'
import { organizationRepository } from '@/repositories/organization.repository'
import { AppError } from '@/middleware/error'
import { sendInviteEmail } from '@/utils/email'
import { OrgRole } from '@prisma/client'
import { hasRole, ROLE_HIERARCHY } from '@/types'
import { PaginationParams } from '@/types'
import { webhookService } from '@/services/webhook.service'

export const organizationService = {
  create: async (userId: string, data: { name: string }) => {
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const uniqueSlug = `${slug}-${uuidv4().slice(0, 8)}`
    return organizationRepository.create({ name: data.name, slug: uniqueSlug, userId })
  },

  getById: async (orgId: string) => {
    const org = await organizationRepository.findById(orgId)
    if (!org) throw new AppError('Organization not found', 404)
    return org
  },

  update: async (orgId: string, data: { name?: string; logoUrl?: string; billingInfo?: Record<string, unknown> }) => {
    return organizationRepository.update(orgId, data)
  },

  delete: async (orgId: string) => {
    await organizationRepository.softDelete(orgId)
  },

  getUserOrgs: async (userId: string) => {
    return organizationRepository.getUserOrgs(userId)
  },

  getMembers: async (orgId: string, params: PaginationParams) => {
    const [items, total] = await Promise.all([
      organizationRepository.getMembers(orgId, params),
      organizationRepository.getMembersCount(orgId),
    ])
    return { items, total }
  },

  inviteMember: async (
    orgId: string,
    invitedById: string,
    email: string,
    role: OrgRole,
    inviterName: string,
    orgName: string
  ) => {
    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const invite = await organizationRepository.createInvite({
      organizationId: orgId,
      email,
      role,
      token,
      invitedById,
      expiresAt,
    })
    await sendInviteEmail(email, token, orgName, inviterName)
    return invite
  },

  acceptInvite: async (token: string, userId: string) => {
    const invite = await organizationRepository.findInviteByToken(token)
    if (!invite) throw new AppError('Invalid invite token', 400)
    if (invite.acceptedAt) throw new AppError('Invite already accepted', 400)
    if (invite.expiresAt < new Date()) throw new AppError('Invite has expired', 400)

    const existing = await organizationRepository.getMember(invite.organizationId, userId)
    if (existing) throw new AppError('You are already a member', 409)

    await organizationRepository.addMember(invite.organizationId, userId, invite.role)
    await organizationRepository.acceptInvite(invite.id)
    return invite.organization
  },

  updateMemberRole: async (
    orgId: string,
    targetUserId: string,
    newRole: OrgRole,
    requestingUserId: string
  ) => {
    const requester = await organizationRepository.getMember(orgId, requestingUserId)
    if (!requester) throw new AppError('Not a member', 403)

    const target = await organizationRepository.getMember(orgId, targetUserId)
    if (!target) throw new AppError('Target user is not a member', 404)

    if (target.role === 'OWNER' && newRole !== 'OWNER') {
      throw new AppError('Cannot demote organization owner', 403)
    }

    if (ROLE_HIERARCHY[newRole] >= ROLE_HIERARCHY[requester.role]) {
      throw new AppError('Cannot assign a role equal to or higher than your own', 403)
    }

    const updated = await organizationRepository.updateMemberRole(orgId, targetUserId, newRole)
    await organizationRepository.createAuditLog({
      organizationId: orgId,
      userId: requestingUserId,
      action: 'member.role_changed',
      entityType: 'member',
      entityId: targetUserId,
      metadata: { oldRole: target.role, newRole },
    })
    webhookService.trigger(orgId, 'member.role_changed', { userId: targetUserId, oldRole: target.role, newRole }).catch(() => {})
    return updated
  },

  removeMember: async (orgId: string, targetUserId: string, requestingUserId: string) => {
    const target = await organizationRepository.getMember(orgId, targetUserId)
    if (!target) throw new AppError('Member not found', 404)
    if (target.role === 'OWNER') throw new AppError('Cannot remove organization owner', 403)

    await organizationRepository.removeMember(orgId, targetUserId)
    await organizationRepository.createAuditLog({
      organizationId: orgId,
      userId: requestingUserId,
      action: 'member.removed',
      entityType: 'member',
      entityId: targetUserId,
      metadata: { removedRole: target.role },
    })
    webhookService.trigger(orgId, 'member.removed', { userId: targetUserId }).catch(() => {})
  },

  getAuditLog: async (orgId: string, params: PaginationParams) => {
    const [items, total] = await Promise.all([
      organizationRepository.getAuditLog(orgId, params),
      organizationRepository.getAuditLogCount(orgId),
    ])
    return { items, total }
  },
}
