import { Server, Socket } from 'socket.io'
import { verifyAccessToken } from '@/utils/jwt'
import { prisma } from './database'
import { logger } from './logger'

let ioInstance: Server | null = null

export const setupSocket = (io: Server) => {
  ioInstance = io

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
    const userId = (socket as Socket & { userId: string }).userId
    logger.debug(`Socket connected: ${socket.id} (user: ${userId})`)

    // Join all org rooms
    try {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId },
        select: { organizationId: true },
      })
      for (const m of memberships) {
        await socket.join(`org:${m.organizationId}`)
      }
      io.to(Array.from(socket.rooms)).emit('user:online', { userId })
    } catch (e) {
      logger.error('Socket join org rooms error', e)
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
      io.emit('user:offline', { userId })
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
