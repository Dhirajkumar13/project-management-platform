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
 *     description: Returns all webhooks configured for the organization. The `secret` field is omitted from list responses — it is only returned on create and rotate-secret.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: List of webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Webhook'
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Not a member of this organization
 *   post:
 *     summary: Create a webhook
 *     description: Creates a new webhook for the organization. Returns the webhook including the plaintext `secret` (prefixed `whsec_`). Store it securely — it will not be returned again.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, url, events]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: My CI Webhook
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/hooks/projectflow
 *               events:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum:
 *                     - project.created
 *                     - project.updated
 *                     - project.deleted
 *                     - task.created
 *                     - task.updated
 *                     - task.deleted
 *                     - member.invited
 *                     - member.removed
 *                     - task.assigned
 *                     - comment.created
 *                     - webhook.test
 *                 example: [task.created, task.updated]
 *     responses:
 *       201:
 *         description: Webhook created — secret included in this response only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/WebhookWithSecret'
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Not a member of this organization
 *       422:
 *         description: Validation failed
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const webhooks = await webhookService.list(req.orgMember!.organizationId)
  successResponse(res, webhooks)
})

router.post('/', validate(createSchema), async (req: AuthenticatedRequest, res: Response) => {
  const webhook = await webhookService.create(req.orgMember!.organizationId, req.body)
  successResponse(res, webhook, 201, 'Webhook created')
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/events:
 *   get:
 *     summary: List all supported webhook event types
 *     description: Returns the full list of event type strings that can be subscribed to when creating or updating a webhook.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Array of supported event type strings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example:
 *                     - project.created
 *                     - project.updated
 *                     - project.deleted
 *                     - task.created
 *                     - task.updated
 *                     - task.deleted
 *                     - member.invited
 *                     - member.removed
 *                     - task.assigned
 *                     - comment.created
 *                     - webhook.test
 *       401:
 *         description: Unauthenticated
 */
router.get('/events', (_req, res: Response) => {
  successResponse(res, WEBHOOK_EVENTS)
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/{id}:
 *   patch:
 *     summary: Update a webhook
 *     description: Updates one or more fields of an existing webhook. All fields are optional — omitted fields are left unchanged. Pass `active: false` to temporarily disable delivery without deleting the webhook.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum:
 *                     - project.created
 *                     - project.updated
 *                     - project.deleted
 *                     - task.created
 *                     - task.updated
 *                     - task.deleted
 *                     - member.invited
 *                     - member.removed
 *                     - task.assigned
 *                     - comment.created
 *                     - webhook.test
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Webhook'
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Not a member of this organization
 *       404:
 *         description: Webhook not found
 *       422:
 *         description: Validation failed
 *   delete:
 *     summary: Delete a webhook
 *     description: Permanently removes a webhook and all its delivery history. This action cannot be undone.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     responses:
 *       200:
 *         description: Webhook deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Not a member of this organization
 *       404:
 *         description: Webhook not found
 */
router.patch('/:id', validate(updateSchema), async (req: AuthenticatedRequest, res: Response) => {
  const webhook = await webhookService.update(req.params.id, req.orgMember!.organizationId, req.body)
  successResponse(res, webhook)
})

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  await webhookService.delete(req.params.id, req.orgMember!.organizationId)
  successResponse(res, null, 200, 'Webhook deleted')
})

/**
 * @swagger
 * /organizations/{orgId}/webhooks/{id}/rotate-secret:
 *   post:
 *     summary: Rotate webhook signing secret
 *     description: |
 *       Generates a new HMAC-SHA256 signing secret for the webhook (prefixed `whsec_`).
 *       The new secret is returned in this response only — store it securely before closing.
 *       All subsequent deliveries will be signed with the new secret immediately.
 *       The old secret is invalidated and cannot be recovered.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     responses:
 *       200:
 *         description: Secret rotated — new secret included in this response only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WebhookWithSecret'
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Not a member of this organization
 *       404:
 *         description: Webhook not found
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
 *     description: Returns the most recent delivery attempts for a webhook in reverse-chronological order (newest first). Includes the HTTP response status and body received from the destination URL, as well as whether the delivery succeeded.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     responses:
 *       200:
 *         description: List of delivery attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WebhookDelivery'
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Not a member of this organization
 *       404:
 *         description: Webhook not found
 *
 * components:
 *   schemas:
 *     Webhook:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         organizationId:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         url:
 *           type: string
 *           format: uri
 *         events:
 *           type: array
 *           items:
 *             type: string
 *         active:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     WebhookWithSecret:
 *       allOf:
 *         - $ref: '#/components/schemas/Webhook'
 *         - type: object
 *           properties:
 *             secret:
 *               type: string
 *               description: Plaintext HMAC-SHA256 signing secret (whsec_ prefix). Only returned on create and rotate-secret.
 *               example: whsec_a1b2c3d4e5f6...
 *     WebhookDelivery:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         webhookId:
 *           type: string
 *           format: uuid
 *         event:
 *           type: string
 *           example: task.created
 *         payload:
 *           type: object
 *           description: The JSON payload that was sent to the destination URL
 *         responseStatus:
 *           type: integer
 *           nullable: true
 *           description: HTTP status code received from the destination (null if connection failed)
 *           example: 200
 *         responseBody:
 *           type: string
 *           nullable: true
 *           description: First 1000 characters of the response body from the destination
 *         success:
 *           type: boolean
 *           description: True if the destination responded with a 2xx status within the 10s timeout
 *         deliveredAt:
 *           type: string
 *           format: date-time
 */
router.get('/:id/deliveries', async (req: AuthenticatedRequest, res: Response) => {
  const deliveries = await webhookService.listDeliveries(req.params.id, req.orgMember!.organizationId)
  successResponse(res, deliveries)
})

export default router
