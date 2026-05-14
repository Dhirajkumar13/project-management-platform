import Bull from 'bull'
import { env } from '@/config/env'
import { logger } from '@/config/logger'
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
  logger.info(`Processing email job: ${data.type} → ${data.to}`)

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
      await sendDueDateReminderEmail(data.to, data.taskTitle, data.dueDate, data.projectName)
      break
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
