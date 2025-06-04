/**
 * TODO Management Components
 * 
 * This module exports all TODO-related components for easy importing.
 * These components provide a comprehensive todo management system with
 * features like filtering, sorting, real-time updates, and project/tag organization.
 */

// Core todo components
export { TodoList } from './todo-list'
export { TodoItem } from './todo-item'
export { TodoForm } from './todo-form'
export { TodoFilters } from './todo-filters'

// Project management components
export { ProjectSelector } from './project-selector'
export { ProjectList } from './project-list'
export { ProjectForm } from './project-form'

// Tag management components
export { TagSelector } from './tag-selector'
export { TagManager } from './tag-manager'

// Re-export types for convenience
export type {
  Todo,
  Project,
  Tag,
  TodoStatus,
  TodoPriority,
  TodoFilters,
  TodoSort,
  CreateTodoInput,
  UpdateTodoInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTagInput
} from '@/types'