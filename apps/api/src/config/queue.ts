import Bull from 'bull'
import { env } from '@/config/env'
import { logger } from '@/config/logger'
import { prisma } from '@/config/database'
import {
  sendTaskAssignedEmail,
  sendMentionEmail,
  sendInviteEmail,
  sendDueDateReminderEmail,
} from '@/utils/email'

export type EmailJobData =
  | { type: 'task_assigned'; to: string; taskTitle: string; projectName: string; assignerName: string }
  | { type: 'mention'; to: string; taskTitle: string; commenterName: string; commentPreview: string }
  | { type: 'invite'; to: string; orgName: string; inviterName: string; inviteToken: string }
  | { type: 'due_date_reminder'; to: string; taskTitle: string; dueDate: string; projectName: string }
  | { type: 'due_date_cron' }

export const emailQueue = new Bull<EmailJobData>('email', {
  redis: env.REDIS_URL,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

emailQueue.process(async (job) => {
  const { data } = job
  logger.info(`Processing email job: ${data.type}${'to' in data ? ` → ${data.to}` : ''}`)

  switch (data.type) {
    case 'task_assigned':
      await sendTaskAssignedEmail(data.to, data.taskTitle, data.projectName)
      break
    case 'mention':
      await sendMentionEmail(data.to, data.taskTitle, data.commenterName)
      break
    case 'invite':
      await sendInviteEmail(data.to, data.orgName, data.inviterName, data.inviteToken)
      break
    case 'due_date_reminder':
      await sendDueDateReminderEmail(data.to, data.taskTitle, new Date(data.dueDate))
      break
    case 'due_date_cron': {
      const now = new Date()
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const tasks = await prisma.task.findMany({
        where: { dueDate: { gte: now, lte: in24h }, status: { not: 'DONE' }, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
        include: {
          project: { select: { name: true } },
          assignees: { include: { user: { select: { email: true, notificationPrefs: true } } } },
        },
      })
      for (const task of tasks) {
        for (const assignee of task.assignees) {
          const prefs = assignee.user.notificationPrefs as { due_date_reminder?: { email?: boolean } } | null
          if (prefs?.due_date_reminder?.email !== false) {
            queueEmail({
              type: 'due_date_reminder',
              to: assignee.user.email,
              taskTitle: task.title,
              dueDate: task.dueDate!.toISOString(),
              projectName: task.project.name,
            })
          }
        }
      }
      logger.info(`Due-date cron: queued reminders for ${tasks.length} tasks`)
      break
    }
  }
})

emailQueue.on('completed', (job) => {
  logger.info(`Email job ${job.id} completed: ${job.data.type}`)
})

emailQueue.on('failed', (job, err) => {
  logger.error(`Email job ${job?.id} failed: ${err.message}`)
})

export function queueEmail(data: EmailJobData): void {
  emailQueue.add(data).catch((err) => {
    logger.error('Failed to queue email:', err)
  })
}

// Register daily due-date check cron (8 AM UTC)
emailQueue.add(
  { type: 'due_date_cron' },
  { repeat: { cron: '0 8 * * *' }, jobId: 'due-date-cron', removeOnComplete: 5, removeOnFail: 5 }
).catch((err) => logger.error('Failed to register due-date cron:', err))
