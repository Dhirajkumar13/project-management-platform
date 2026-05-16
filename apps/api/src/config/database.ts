import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const SOFT_DELETE_MODELS = new Set([
  'User', 'Organization', 'Project', 'Task', 'TaskComment',
])

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'error', 'warn']
        : ['error'],
  })

  // Ensure deletedAt is explicitly stored as null on create so
  // `where: { deletedAt: null }` queries work correctly in MongoDB
  // (MongoDB doesn't match missing fields with null equality by default in Prisma)
  client.$use(async (params, next) => {
    if (params.action === 'create' && params.model && SOFT_DELETE_MODELS.has(params.model)) {
      if (params.args.data && params.args.data.deletedAt === undefined) {
        params.args.data.deletedAt = null
      }
    }
    return next(params)
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

prisma.$connect().then(() => logger.info('Database connected')).catch((e) => {
  logger.error('Database connection failed', e)
  process.exit(1)
})
