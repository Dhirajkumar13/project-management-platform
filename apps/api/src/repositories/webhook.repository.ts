import { prisma } from '@/config/database'
import { Prisma } from '@prisma/client'

export const webhookRepository = {
  create: (data: {
    organizationId: string
    name: string
    url: string
    secret: string
    events: string[]
  }) => prisma.webhook.create({ data }),

  findById: (id: string, organizationId: string) =>
    prisma.webhook.findFirst({ where: { id, organizationId } }),

  list: (organizationId: string) =>
    prisma.webhook.findMany({
      where: { organizationId },
      include: {
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

  update: (id: string, data: { name?: string; url?: string; events?: string[]; active?: boolean }) =>
    prisma.webhook.update({ where: { id }, data }),

  delete: (id: string) => prisma.webhook.delete({ where: { id } }),

  findActiveByOrgAndEvent: (organizationId: string, event: string) =>
    prisma.webhook.findMany({
      where: {
        organizationId,
        active: true,
        events: { has: event },
      },
    }),

  createDelivery: (data: {
    webhookId: string
    event: string
    payload: Prisma.InputJsonValue
    statusCode?: number
    success: boolean
    error?: string
  }) => prisma.webhookDelivery.create({ data }),

  listDeliveries: (webhookId: string) =>
    prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
}
