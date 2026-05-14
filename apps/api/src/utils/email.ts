import nodemailer from 'nodemailer'
import { logger } from '@/config/logger'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const FROM = process.env.SMTP_FROM || 'ProjectFlow <no-reply@projectflow.dev>'

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return null
}

async function sendMail(to: string, subject: string, html: string) {
  const transport = createTransport()
  if (!transport) {
    logger.info(`[EMAIL DEV] To: ${to} | Subject: ${subject}`)
    return
  }
  try {
    await transport.sendMail({ from: FROM, to, subject, html })
    logger.info(`[EMAIL] Sent "${subject}" to ${to}`)
  } catch (err) {
    logger.error(`[EMAIL] Failed to send to ${to}: ${err}`)
  }
}

export const sendPasswordResetEmail = async (email: string, token: string, name: string) => {
  const url = `${FRONTEND_URL}/reset-password?token=${token}`
  await sendMail(email, 'Reset your ProjectFlow password', `
    <p>Hi ${name},</p>
    <p>Click the link below to reset your password. It expires in 1 hour.</p>
    <p><a href="${url}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `)
}

export const sendInviteEmail = async (email: string, token: string, orgName: string, inviterName: string) => {
  const url = `${FRONTEND_URL}/invite/${token}`
  await sendMail(email, `${inviterName} invited you to ${orgName}`, `
    <p>Hi there,</p>
    <p><strong>${inviterName}</strong> invited you to join <strong>${orgName}</strong> on ProjectFlow.</p>
    <p><a href="${url}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
  `)
}

export const sendTaskAssignedEmail = async (email: string, taskTitle: string, projectName: string) => {
  await sendMail(email, `New task assigned: ${taskTitle}`, `
    <p>You've been assigned to <strong>${taskTitle}</strong> in project <strong>${projectName}</strong>.</p>
    <p><a href="${FRONTEND_URL}">Open ProjectFlow</a></p>
  `)
}

export const sendMentionEmail = async (email: string, mentionerName: string, taskTitle: string) => {
  await sendMail(email, `${mentionerName} mentioned you in a comment`, `
    <p><strong>${mentionerName}</strong> mentioned you in a comment on task: <strong>${taskTitle}</strong>.</p>
    <p><a href="${FRONTEND_URL}">View Comment</a></p>
  `)
}

export const sendDueDateReminderEmail = async (email: string, taskTitle: string, dueDate: Date) => {
  await sendMail(email, `Due soon: ${taskTitle}`, `
    <p>Your task <strong>${taskTitle}</strong> is due on <strong>${dueDate.toLocaleDateString()}</strong>.</p>
    <p><a href="${FRONTEND_URL}">Open ProjectFlow</a></p>
  `)
}
