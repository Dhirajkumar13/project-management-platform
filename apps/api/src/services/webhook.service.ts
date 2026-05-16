import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { webhookRepository } from '@/repositories/webhook.repository'
import { AppError } from '@/middleware/error'
import { logger } from '@/config/logger'

export const WEBHOOK_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'task.moved',
  'comment.created',
  'project.created',
  'project.updated',
  'project.deleted',
  'member.added',
  'member.removed',
  'member.role_changed',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`
}

function signPayload(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export const webhookService = {
  create: async (orgId: string, data: { name: string; url: string; events: string[] }) => {
    for (const event of data.events) {
      if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) {
        throw new AppError(`Invalid event: ${event}`, 400)
      }
    }
    const secret = generateSecret()
    return webhookRepository.create({ organizationId: orgId, ...data, secret })
  },

  list: (orgId: string) => webhookRepository.list(orgId),

  update: async (id: string, orgId: string, data: { name?: string; url?: string; events?: string[]; active?: boolean }) => {
    const webhook = await webhookRepository.findById(id, orgId)
    if (!webhook) throw new AppError('Webhook not found', 404)
    if (data.events) {
      for (const event of data.events) {
        if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) {
          throw new AppError(`Invalid event: ${event}`, 400)
        }
      }
    }
    return webhookRepository.update(id, data)
  },

  delete: async (id: string, orgId: string) => {
    const webhook = await webhookRepository.findById(id, orgId)
    if (!webhook) throw new AppError('Webhook not found', 404)
    await webhookRepository.delete(id)
  },

  rotateSecret: async (id: string, orgId: string) => {
    const webhook = await webhookRepository.findById(id, orgId)
    if (!webhook) throw new AppError('Webhook not found', 404)
    const secret = generateSecret()
    return webhookRepository.update(id, { secret } as Parameters<typeof webhookRepository.update>[1] & { secret: string })
  },

  listDeliveries: async (id: string, orgId: string) => {
    const webhook = await webhookRepository.findById(id, orgId)
    if (!webhook) throw new AppError('Webhook not found', 404)
    return webhookRepository.listDeliveries(id)
  },

  // Fire-and-forget: called from services after mutations
  trigger: async (orgId: string, event: WebhookEvent, payload: Record<string, unknown>) => {
    const webhooks = await webhookRepository.findActiveByOrgAndEvent(orgId, event)
    if (!webhooks.length) return

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })

    await Promise.allSettled(
      webhooks.map(async (wh) => {
        const signature = signPayload(wh.secret, body)
        let statusCode: number | undefined
        let success = false
        let error: string | undefined

        try {
          const res = await fetch(wh.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-ProjectFlow-Signature': `sha256=${signature}`,
              'X-ProjectFlow-Event': event,
            },
            body,
            signal: AbortSignal.timeout(10_000),
          })
          statusCode = res.status
          success = res.ok
          if (!res.ok) error = `HTTP ${res.status}`
        } catch (err) {
          error = err instanceof Error ? err.message : 'Network error'
          logger.warn(`Webhook delivery failed for ${wh.url}: ${error}`)
        }

        await webhookRepository.createDelivery({
          webhookId: wh.id,
          event,
          payload: { event, data: payload } as unknown as Prisma.InputJsonValue,
          statusCode,
          success,
          error,
        })
      })
    )
  },
}
