import { prisma } from '@/config/database'

const notDeleted = { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } as const
import { OrgRole, Prisma } from '@prisma/client'
import { PaginationParams } from '@/types'
import { getSkip } from '@/utils/pagination'

export const organizationRepository = {
  create: (data: { name: string; slug: string; userId: string }) =>
    prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: data.name, slug: data.slug } })
      await tx.organizationMember.create({
        data: { organizationId: org.id, userId: data.userId, role: 'OWNER' },
      })
      return org
    }),

  findById: (id: string) =>
    prisma.organization.findFirst({
      where: { id, ...notDeleted },
      include: {
        _count: { select: { members: true, projects: true } },
      },
    }),

  findBySlug: (slug: string) =>
    prisma.organization.findFirst({ where: { slug, ...notDeleted } }),

  update: (id: string, data: Prisma.OrganizationUpdateInput) =>
    prisma.organization.update({ where: { id }, data }),

  softDelete: (id: string) =>
    prisma.organization.update({ where: { id }, data: { deletedAt: new Date() } }),

  getUserOrgs: (userId: string) =>
    prisma.organizationMember.findMany({
      where: { userId, organization: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } },
      include: {
        organization: {
          include: { _count: { select: { members: true, projects: true } } },
        },
      },
    }),

  getMembers: (orgId: string, params: PaginationParams) =>
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      skip: getSkip(params.page, params.limit),
      take: params.limit,
      orderBy: { joinedAt: 'desc' },
    }),

  getMembersCount: (orgId: string) =>
    prisma.organizationMember.count({ where: { organizationId: orgId } }),

  getMember: (orgId: string, userId: string) =>
    prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    }),

  addMember: (orgId: string, userId: string, role: OrgRole) =>
    prisma.organizationMember.create({
      data: { organizationId: orgId, userId, role },
    }),

  updateMemberRole: (orgId: string, userId: string, role: OrgRole) =>
    prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { role },
    }),

  removeMember: (orgId: string, userId: string) =>
    prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    }),

  createInvite: (data: {
    organizationId: string
    email: string
    role: OrgRole
    token: string
    invitedById: string
    expiresAt: Date
  }) => prisma.organizationInvite.create({ data }),

  findInviteByToken: (token: string) =>
    prisma.organizationInvite.findUnique({
      where: { token },
      include: { organization: true },
    }),

  acceptInvite: (inviteId: string) =>
    prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { acceptedAt: new Date() },
    }),

  getAuditLog: (orgId: string, params: PaginationParams) =>
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      skip: getSkip(params.page, params.limit),
      take: params.limit,
      orderBy: { createdAt: 'desc' },
    }),

  getAuditLogCount: (orgId: string) =>
    prisma.auditLog.count({ where: { organizationId: orgId } }),

  createAuditLog: (data: {
    organizationId: string
    userId: string
    action: string
    entityType: string
    entityId: string
    metadata?: Record<string, unknown>
  }) => prisma.auditLog.create({ data }),
}
