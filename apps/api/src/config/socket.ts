import { Server, Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { verifyAccessToken } from '@/utils/jwt'
import { prisma } from './database'
import { env } from './env'
import { logger } from './logger'

type ExtendedSocket = Socket & { userId: string; orgIds: string[] }

let ioInstance: Server | null = null

export const setupSocket = (io: Server) => {
  ioInstance = io

  // Redis adapter — enables horizontal scaling across multiple Node instances
  const pubClient = new Redis(env.REDIS_URL)
  const subClient = pubClient.duplicate()
  io.adapter(createAdapter(pubClient, subClient))
  logger.info('Socket.IO Redis adapter attached')

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token as string
      if (!token) throw new Error('No token')
      const payload = verifyAccessToken(token)
      ;(socket as Socket & { userId: string }).userId = payload.userId
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', async (socket: Socket) => {
    const s = socket as ExtendedSocket
    const userId = s.userId
    logger.debug(`Socket connected: ${socket.id} (user: ${userId})`)

    // Join user's own room (for targeted notifications) and all org rooms
    try {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId },
        select: { organizationId: true },
      })
      const orgIds = memberships.map((m) => m.organizationId)
      s.orgIds = orgIds

      await socket.join(`user:${userId}`)
      for (const orgId of orgIds) {
        await socket.join(`org:${orgId}`)
      }
      // Notify other org members that this user came online (exclude sender)
      orgIds.forEach((orgId) => socket.to(`org:${orgId}`).emit('user:online', { userId }))
    } catch (e) {
      logger.error('Socket join rooms error', e)
    }

    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`)
    })

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`)
    })

    socket.on('join:task', (taskId: string) => {
      socket.join(`task:${taskId}`)
    })

    socket.on('leave:task', (taskId: string) => {
      socket.leave(`task:${taskId}`)
    })

    socket.on('typing:start', ({ taskId }: { taskId: string }) => {
      socket.to(`task:${taskId}`).emit('typing:start', { userId, taskId })
    })

    socket.on('typing:stop', ({ taskId }: { taskId: string }) => {
      socket.to(`task:${taskId}`).emit('typing:stop', { userId, taskId })
    })

    socket.on('disconnect', () => {
      const orgIds = (socket as ExtendedSocket).orgIds ?? []
      orgIds.forEach((orgId) => socket.to(`org:${orgId}`).emit('user:offline', { userId }))
      logger.debug(`Socket disconnected: ${socket.id}`)
    })
  })
}

export const emitToOrg = (orgId: string, event: string, data: unknown) => {
  ioInstance?.to(`org:${orgId}`).emit(event, data)
}

export const emitToProject = (projectId: string, event: string, data: unknown) => {
  ioInstance?.to(`project:${projectId}`).emit(event, data)
}

export const emitToTask = (taskId: string, event: string, data: unknown) => {
  ioInstance?.to(`task:${taskId}`).emit(event, data)
}

export const emitToUser = (userId: string, event: string, data: unknown) => {
  ioInstance?.to(`user:${userId}`).emit(event, data)
}
