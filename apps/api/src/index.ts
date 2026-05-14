import 'express-async-errors'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import helmet from 'helmet'
import cors from 'cors'
import hpp from 'hpp'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import path from 'path'

import { env } from '@/config/env'
import { logger } from '@/config/logger'
import { swaggerSpec } from '@/config/swagger'
import { setupSocket } from '@/config/socket'
import { errorMiddleware } from '@/middleware/error'
import { generalLimiter } from '@/middleware/rateLimiter'
import { sanitizeBody } from '@/middleware/sanitize'
import '@/config/queue'

import authRoutes from '@/routes/auth.routes'
import organizationRoutes from '@/routes/organization.routes'
import projectRoutes from '@/routes/project.routes'
import taskRoutes from '@/routes/task.routes'
import notificationRoutes from '@/routes/notification.routes'
import searchRoutes from '@/routes/search.routes'
import dashboardRoutes from '@/routes/dashboard.routes'
import myTasksRoutes from '@/routes/my-tasks.routes'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(hpp())
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(sanitizeBody)
app.use(cookieParser())
app.use(morgan('dev'))
app.use(generalLimiter)

app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)))
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }))

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/organizations', organizationRoutes)
app.use('/api/v1/organizations/:orgId/projects', projectRoutes)
app.use('/api/v1/organizations/:orgId/projects/:projectId/tasks', taskRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/search', searchRoutes)
app.use('/api/v1/dashboard', dashboardRoutes)
app.use('/api/v1/my-tasks', myTasksRoutes)

app.use(errorMiddleware)

setupSocket(io)

httpServer.listen(env.PORT, () => {
  logger.info(`Server running on http://localhost:${env.PORT}`)
  logger.info(`API Docs: http://localhost:${env.PORT}/api/docs`)
})

export default app
