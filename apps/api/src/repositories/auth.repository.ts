import { prisma } from '@/config/database'
import { Prisma } from '@prisma/client'

const notDeleted = { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] }

export const authRepository = {
  findUserByEmail: (email: string) =>
    prisma.user.findFirst({ where: { email, ...notDeleted } }),

  findUserById: (id: string) =>
    prisma.user.findFirst({
      where: { id, ...notDeleted },
      include: {
        orgMemberships: {
          include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
          where: { organization: { deletedAt: null } },
        },
      },
    }),

  createUser: (data: Prisma.UserCreateInput) => prisma.user.create({ data }),

  updateUser: (id: string, data: Prisma.UserUpdateInput) =>
    prisma.user.update({ where: { id }, data }),

  createRefreshToken: (userId: string, token: string, expiresAt: Date) =>
    prisma.refreshToken.create({ data: { userId, token, expiresAt } }),

  findRefreshToken: (token: string) =>
    prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    }),

  deleteRefreshToken: (token: string) =>
    prisma.refreshToken.delete({ where: { token } }).catch(() => null),

  deleteAllUserRefreshTokens: (userId: string) =>
    prisma.refreshToken.deleteMany({ where: { userId } }),

  createPasswordReset: (userId: string, token: string, expiresAt: Date) =>
    prisma.passwordReset.create({ data: { userId, token, expiresAt } }),

  findPasswordReset: (token: string) =>
    prisma.passwordReset.findUnique({ where: { token } }),

  markPasswordResetUsed: (id: string) =>
    prisma.passwordReset.update({ where: { id }, data: { used: true } }),
}
