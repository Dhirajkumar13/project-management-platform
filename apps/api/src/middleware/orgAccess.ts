import { Response, NextFunction } from 'express'
import { AuthenticatedRequest, hasRole, OrgRole } from '@/types'
import { prisma } from '@/config/database'
import { errorResponse } from '@/utils/response'

export const orgAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { orgId } = req.params
  const userId = req.user?.id

  if (!userId || !orgId) {
    errorResponse(res, 'Unauthorized', 401)
    return
  }

  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  })

  if (!member) {
    errorResponse(res, 'You are not a member of this organization', 403)
    return
  }

  req.orgMember = member
  next()
}

export const requireOrgRole =
  (minRole: OrgRole) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.orgMember) {
      errorResponse(res, 'Unauthorized', 401)
      return
    }
    if (!hasRole(req.orgMember.role, minRole)) {
      errorResponse(res, 'Insufficient permissions', 403)
      return
    }
    next()
  }
