import { Router } from 'express'
import { organizationController, createOrgSchema, updateOrgSchema, inviteSchema, updateRoleSchema } from '@/controllers/organization.controller'
import { authenticate } from '@/middleware/auth'
import { orgAccess, requireOrgRole } from '@/middleware/orgAccess'
import { validate } from '@/middleware/validate'

const router = Router()

router.use(authenticate)

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: List all organizations for the current user
 *     tags: [Organizations]
 *     responses:
 *       200:
 *         description: List of organizations
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization created
 */
router.get('/', organizationController.getUserOrgs)
router.post('/', validate(createOrgSchema), organizationController.create)

/**
 * @swagger
 * /organizations/{orgId}:
 *   get:
 *     summary: Get organization details
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization details
 *   patch:
 *     summary: Update organization (ADMIN+)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organization updated
 *   delete:
 *     summary: Delete organization (OWNER only)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization deleted
 */
router.get('/:orgId', orgAccess, organizationController.getById)
router.patch('/:orgId', orgAccess, requireOrgRole('ADMIN'), validate(updateOrgSchema), organizationController.update)
router.delete('/:orgId', orgAccess, requireOrgRole('OWNER'), organizationController.delete)

/**
 * @swagger
 * /organizations/{orgId}/members:
 *   get:
 *     summary: List organization members
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of members
 *
 * /organizations/{orgId}/invites:
 *   post:
 *     summary: Invite a member by email (ADMIN+)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, MEMBER, VIEWER]
 *     responses:
 *       201:
 *         description: Invite sent
 *
 * /organizations/invites/{token}/accept:
 *   post:
 *     summary: Accept an organization invite
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Joined organization
 *
 * /organizations/{orgId}/members/{userId}/role:
 *   patch:
 *     summary: Update member role (ADMIN+)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, MEMBER, VIEWER]
 *     responses:
 *       200:
 *         description: Role updated
 *
 * /organizations/{orgId}/members/{userId}:
 *   delete:
 *     summary: Remove a member (ADMIN+)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed
 *
 * /organizations/{orgId}/audit-log:
 *   get:
 *     summary: Get organization audit log (ADMIN+)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated audit log
 */
router.get('/:orgId/members', orgAccess, organizationController.getMembers)
router.post('/:orgId/invites', orgAccess, requireOrgRole('ADMIN'), validate(inviteSchema), organizationController.inviteMember)
router.post('/invites/:token/accept', organizationController.acceptInvite)

router.patch('/:orgId/members/:userId/role', orgAccess, requireOrgRole('ADMIN'), validate(updateRoleSchema), organizationController.updateMemberRole)
router.delete('/:orgId/members/:userId', orgAccess, requireOrgRole('ADMIN'), organizationController.removeMember)
router.get('/:orgId/audit-log', orgAccess, requireOrgRole('ADMIN'), organizationController.getAuditLog)

export default router
