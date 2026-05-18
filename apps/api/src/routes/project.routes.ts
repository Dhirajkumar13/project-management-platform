import { Router } from 'express'
import { projectController, createProjectSchema, updateProjectSchema, addMemberSchema, createLabelSchema } from '@/controllers/project.controller'
import { authenticate } from '@/middleware/auth'
import { orgAccess, requireOrgRole } from '@/middleware/orgAccess'
import { validate } from '@/middleware/validate'

const router = Router({ mergeParams: true })

router.use(authenticate, orgAccess)

/**
 * @swagger
 * /organizations/{orgId}/projects:
 *   get:
 *     summary: List projects in an organization
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, ARCHIVED, COMPLETED]
 *       - in: query
 *         name: search
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
 *         description: Paginated project list
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, ARCHIVED, COMPLETED]
 *               visibility:
 *                 type: string
 *                 enum: [PRIVATE, PUBLIC]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Project created
 */
router.get('/', projectController.list)
router.post('/', requireOrgRole('MEMBER'), validate(createProjectSchema), projectController.create)

/**
 * @swagger
 * /organizations/{orgId}/projects/{projectId}:
 *   get:
 *     summary: Get project details with stats
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project details
 *   patch:
 *     summary: Update project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project updated
 *   delete:
 *     summary: Delete (archive) project (MANAGER+)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project deleted
 *
 * /organizations/{orgId}/projects/{projectId}/stats:
 *   get:
 *     summary: Get project task statistics
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project stats (totalTasks, completedTasks, completionPercentage, overdueTasks)
 *
 * /organizations/{orgId}/projects/{projectId}/members:
 *   get:
 *     summary: List project members
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of project members
 *   post:
 *     summary: Add member to project (MANAGER+)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [LEAD, MEMBER, VIEWER]
 *     responses:
 *       201:
 *         description: Member added
 *
 * /organizations/{orgId}/projects/{projectId}/members/{userId}:
 *   delete:
 *     summary: Remove member from project (MANAGER+)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
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
 * /organizations/{orgId}/projects/{projectId}/labels:
 *   get:
 *     summary: List project labels
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of labels
 *   post:
 *     summary: Create a label
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
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
 *               color:
 *                 type: string
 *                 example: "#6366f1"
 *     responses:
 *       201:
 *         description: Label created
 *
 * /organizations/{orgId}/projects/{projectId}/labels/{labelId}:
 *   delete:
 *     summary: Delete a label
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: labelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Label deleted
 */
router.get('/:projectId', projectController.getById)
router.patch('/:projectId', requireOrgRole('MANAGER'), validate(updateProjectSchema), projectController.update)
router.delete('/:projectId', requireOrgRole('MANAGER'), projectController.delete)

router.get('/:projectId/members', projectController.getMembers)
router.post('/:projectId/members', requireOrgRole('MANAGER'), validate(addMemberSchema), projectController.addMember)
router.delete('/:projectId/members/:userId', requireOrgRole('MANAGER'), projectController.removeMember)
router.get('/:projectId/stats', projectController.getStats)

router.get('/:projectId/labels', projectController.getLabels)
router.post('/:projectId/labels', requireOrgRole('MEMBER'), validate(createLabelSchema), projectController.createLabel)
router.delete('/:projectId/labels/:labelId', requireOrgRole('MEMBER'), projectController.deleteLabel)

/**
 * @swagger
 * /organizations/{orgId}/projects/{projectId}/burndown:
 *   get:
 *     summary: Get burndown chart data for a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of daily remaining/ideal task counts
 */
router.get('/:projectId/burndown', projectController.getBurndown)

export default router
