import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@/middleware/auth'
import { orgAccess } from '@/middleware/orgAccess'
import { validate } from '@/middleware/validate'
import { successResponse } from '@/utils/response'
import { webhookService, WEBHOOK_EVENTS } from '@/services/webhook.service'
import { AuthenticatedRequest } from '@/types'
import { Response } from 'express'

const router = Router({ mergeParams: true })
router.use(authenticate, orgAccess)

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
})

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks:
 *   get:
 *     summary: List webhooks for an organization
 *     tags: [Webhooks]
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const webhooks = await webhookService.list(req.orgMember!.organizationId)
  successResponse(res, webhooks)
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/events:
 *   get:
 *     summary: List all supported webhook event types
 *     tags: [Webhooks]
 */
router.get('/events', (_req, res: Response) => {
  successResponse(res, WEBHOOK_EVENTS)
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks:
 *   post:
 *     summary: Create a webhook
 *     tags: [Webhooks]
 */
router.post('/', validate(createSchema), async (req: AuthenticatedRequest, res: Response) => {
  const webhook = await webhookService.create(req.orgMember!.organizationId, req.body)
  successResponse(res, webhook, 201, 'Webhook created')
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/{id}:
 *   patch:
 *     summary: Update a webhook
 *     tags: [Webhooks]
 */
router.patch('/:id', validate(updateSchema), async (req: AuthenticatedRequest, res: Response) => {
  const webhook = await webhookService.update(req.params.id, req.orgMember!.organizationId, req.body)
  successResponse(res, webhook)
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/{id}:
 *   delete:
 *     summary: Delete a webhook
 *     tags: [Webhooks]
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  await webhookService.delete(req.params.id, req.orgMember!.organizationId)
  successResponse(res, null, 200, 'Webhook deleted')
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/{id}/rotate-secret:
 *   post:
 *     summary: Rotate webhook signing secret
 *     tags: [Webhooks]
 */
router.post('/:id/rotate-secret', async (req: AuthenticatedRequest, res: Response) => {
  const webhook = await webhookService.rotateSecret(req.params.id, req.orgMember!.organizationId)
  successResponse(res, webhook)
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/{id}/deliveries:
 *   get:
 *     summary: List recent delivery attempts for a webhook
 *     tags: [Webhooks]
 */
router.get('/:id/deliveries', async (req: AuthenticatedRequest, res: Response) => {
  const deliveries = await webhookService.listDeliveries(req.params.id, req.orgMember!.organizationId)
  successResponse(res, deliveries)
})

export default router
