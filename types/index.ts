import { Tables } from './database'

export type Profile = Tables<'profiles'>
export type Project = Tables<'projects'> & {
  todoCount?: number
}
export type Tag = Tables<'tags'> & {
  usageCount?: number
}
export type Todo = Tables<'todos'> & {
  tags?: Tag[]
  project?: Project
  attachments?: TodoAttachment[]
}
export type TodoTag = Tables<'todo_tags'>
export type TodoAttachment = Tables<'todo_attachments'>

export type TodoStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface CreateTodoInput {
  title: string
  description?: string
  projectId: string
  priority?: TodoPriority
  dueDate?: Date
  scheduledDate?: Date
  tagIds?: string[]
}

export interface UpdateTodoInput {
  title?: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  dueDate?: Date | null
  scheduledDate?: Date | null
  projectId?: string
  tagIds?: string[]
}

export interface CreateProjectInput {
  name: string
  description?: string
  color?: string
  icon?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  color?: string
  icon?: string
  isArchived?: boolean
  displayOrder?: number
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface UpdateProfileInput {
  displayName?: string
  bio?: string
  avatarUrl?: string
}

export interface AuthUser {
  id: string
  email: string
  emailConfirmed: boolean
}

export interface Session {
  user: AuthUser
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export type SortField = 'created_at' | 'title' | 'due_date' | 'priority' | 'status'
export type SortOrder = 'asc' | 'desc'

export interface TodoFilters {
  status?: TodoStatus[]
  priority?: TodoPriority[]
  projectId?: string
  tagIds?: string[]
  dueDateFrom?: Date
  dueDateTo?: Date
  search?: string
}

export interface TodoSort {
  field: SortField
  order: SortOrder
}