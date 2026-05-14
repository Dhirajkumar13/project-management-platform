import { PrismaClient, TaskStatus, Priority } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const password = await bcrypt.hash('password123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: { email: 'admin@demo.com', name: 'Admin User', password, timezone: 'UTC' },
  })

  const member = await prisma.user.upsert({
    where: { email: 'member@demo.com' },
    update: {},
    create: { email: 'member@demo.com', name: 'Jane Member', password, timezone: 'UTC' },
  })

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@demo.com' },
    update: {},
    create: { email: 'viewer@demo.com', name: 'Bob Viewer', password, timezone: 'UTC' },
  })

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      billingInfo: { plan: 'Pro', seats: 10 },
    },
  })

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    update: {},
    create: { organizationId: org.id, userId: admin.id, role: 'OWNER' },
  })

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: member.id } },
    update: {},
    create: { organizationId: org.id, userId: member.id, role: 'MEMBER' },
  })

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: viewer.id } },
    update: {},
    create: { organizationId: org.id, userId: viewer.id, role: 'VIEWER' },
  })

  const project1 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Website Redesign',
      description: 'Complete overhaul of the company website with modern design and improved UX.',
      status: 'ACTIVE',
      visibility: 'PUBLIC',
      leadId: admin.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
    },
  })

  const project2 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Mobile App v2',
      description: 'Next generation mobile application with new features and performance improvements.',
      status: 'ACTIVE',
      visibility: 'PRIVATE',
      leadId: member.id,
    },
  })

  const project3 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'API Integration',
      description: 'Integrate third-party APIs for payment and analytics.',
      status: 'COMPLETED',
      visibility: 'PRIVATE',
      leadId: admin.id,
    },
  })

  for (const p of [project1, project2, project3]) {
    await prisma.projectMember.createMany({
      data: [
        { projectId: p.id, userId: admin.id, role: 'LEAD' },
        { projectId: p.id, userId: member.id, role: 'MEMBER' },
      ],
      skipDuplicates: true,
    })
  }

  const bugLabel = await prisma.label.create({ data: { projectId: project1.id, name: 'Bug', color: '#ef4444' } })
  const featureLabel = await prisma.label.create({ data: { projectId: project1.id, name: 'Feature', color: '#6366f1' } })
  const uiLabel = await prisma.label.create({ data: { projectId: project1.id, name: 'UI', color: '#8b5cf6' } })

  const statuses: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
  const priorities: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

  const taskData = [
    { title: 'Design new homepage hero section', status: 'DONE' as TaskStatus, priority: 'HIGH' as Priority, position: 1000 },
    { title: 'Implement responsive navigation', status: 'IN_REVIEW' as TaskStatus, priority: 'HIGH' as Priority, position: 1000 },
    { title: 'Fix broken links on product pages', status: 'IN_PROGRESS' as TaskStatus, priority: 'CRITICAL' as Priority, position: 1000 },
    { title: 'Add dark mode support', status: 'TODO' as TaskStatus, priority: 'MEDIUM' as Priority, position: 1000 },
    { title: 'Optimize image loading performance', status: 'TODO' as TaskStatus, priority: 'HIGH' as Priority, position: 2000 },
    { title: 'Write unit tests for auth module', status: 'BACKLOG' as TaskStatus, priority: 'MEDIUM' as Priority, position: 1000 },
    { title: 'Update color scheme per brand guidelines', status: 'BACKLOG' as TaskStatus, priority: 'LOW' as Priority, position: 2000 },
    { title: 'Implement contact form with validation', status: 'IN_PROGRESS' as TaskStatus, priority: 'MEDIUM' as Priority, position: 2000 },
  ]

  for (const td of taskData) {
    const task = await prisma.task.create({
      data: {
        projectId: project1.id,
        title: td.title,
        description: `Detailed description for: ${td.title}`,
        status: td.status,
        priority: td.priority,
        position: td.position,
        dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
        storyPoints: [1, 2, 3, 5, 8][Math.floor(Math.random() * 5)],
      },
    })

    await prisma.taskAssignee.create({ data: { taskId: task.id, userId: Math.random() > 0.5 ? admin.id : member.id } })

    if (Math.random() > 0.5) {
      await prisma.taskLabel.create({ data: { taskId: task.id, labelId: Math.random() > 0.5 ? bugLabel.id : featureLabel.id } })
    }

    await prisma.taskActivity.create({
      data: { taskId: task.id, userId: admin.id, action: 'created task' },
    })

    if (td.status !== 'BACKLOG') {
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: member.id,
          content: `Working on this task. Will update status soon.`,
          mentions: [],
        },
      })
    }

    if (td.status === 'DONE' || td.status === 'IN_REVIEW') {
      await prisma.subtask.createMany({
        data: [
          { taskId: task.id, title: 'Research phase', completed: true, position: 0 },
          { taskId: task.id, title: 'Implementation', completed: td.status === 'DONE', position: 1 },
          { taskId: task.id, title: 'Code review', completed: false, position: 2 },
        ],
      })
    }
  }

  const p2tasks = [
    { title: 'User authentication flow', status: 'DONE' as TaskStatus, priority: 'CRITICAL' as Priority },
    { title: 'Push notification system', status: 'IN_PROGRESS' as TaskStatus, priority: 'HIGH' as Priority },
    { title: 'Offline mode support', status: 'TODO' as TaskStatus, priority: 'MEDIUM' as Priority },
    { title: 'Performance profiling', status: 'BACKLOG' as TaskStatus, priority: 'LOW' as Priority },
  ]

  for (const td of p2tasks) {
    const task = await prisma.task.create({
      data: { projectId: project2.id, title: td.title, status: td.status, priority: td.priority, position: 1000 },
    })
    await prisma.taskAssignee.create({ data: { taskId: task.id, userId: member.id } })
    await prisma.taskActivity.create({ data: { taskId: task.id, userId: member.id, action: 'created task' } })
  }

  console.log('✅ Seed complete!')
  console.log('Demo users:')
  console.log('  admin@demo.com / password123 (OWNER)')
  console.log('  member@demo.com / password123 (MEMBER)')
  console.log('  viewer@demo.com / password123 (VIEWER)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
