export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED'
export type Visibility = 'PRIVATE' | 'PUBLIC'
export type ProjectRole = 'LEAD' | 'MEMBER' | 'VIEWER'
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  timezone: string
  createdAt: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl?: string
  billingInfo?: Record<string, unknown>
  createdAt: string
  role?: OrgRole
  _count?: { members: number; projects: number }
}

export interface OrgMember {
  id: string
  organizationId: string
  userId: string
  user: User
  role: OrgRole
  joinedAt: string
}

export interface Project {
  id: string
  organizationId: string
  name: string
  description?: string
  status: ProjectStatus
  visibility: Visibility
  startDate?: string
  endDate?: string
  leadId?: string
  createdAt: string
  updatedAt: string
  _count?: { tasks: number; members: number }
  stats?: {
    totalTasks: number
    completedTasks: number
    completionPercentage: number
    overdueTasks: number
  }
  members?: ProjectMember[]
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  user: User
  role: ProjectRole
  joinedAt: string
}

export interface Label {
  id: string
  projectId: string
  name: string
  color: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  startDate?: string
  dueDate?: string
  storyPoints?: number
  position: number
  createdAt: string
  updatedAt: string
  assignees?: TaskAssignee[]
  labels?: TaskLabelItem[]
  subtasks?: Subtask[]
  _count?: { comments: number; attachments: number }
}

export interface TaskAssignee {
  id: string
  taskId: string
  userId: string
  user: User
}

export interface TaskLabelItem {
  taskId: string
  labelId: string
  label: Label
}

export interface Subtask {
  id: string
  taskId: string
  title: string
  completed: boolean
  position: number
}

export interface TaskComment {
  id: string
  taskId: string
  userId: string
  user: User
  content: string
  mentions: string[]
  createdAt: string
  updatedAt: string
}

export interface TaskAttachment {
  id: string
  taskId: string
  name: string
  url: string
  size: number
  mimeType: string
  uploadedById: string
  uploadedBy: User
  createdAt: string
}

export interface TaskActivity {
  id: string
  taskId: string
  userId: string
  user: User
  action: string
  oldValue?: string
  newValue?: string
  createdAt: string
  task?: { id: string; title: string }
}

export interface Notification {
  id: string
  userId: string
  organizationId?: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  read: boolean
  createdAt: string
}

export interface DashboardStats {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalTasks: number
  activeTasks: number
  overdueTasks: number
  completedTasks: number
  memberCount: number
  teamWorkload: { user: User; assignedCount: number; completedCount: number }[]
  recentActivity: TaskActivity[]
  tasksByStatus: { status: TaskStatus; count: number }[]
  tasksByPriority: { priority: Priority; count: number }[]
}

export interface KanbanBoard {
  BACKLOG: Task[]
  TODO: Task[]
  IN_PROGRESS: Task[]
  IN_REVIEW: Task[]
  DONE: Task[]
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  success: boolean
  message: string
  data: {
    items: T[]
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
