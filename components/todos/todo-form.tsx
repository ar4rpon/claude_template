'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Form, 
  FormField, 
  FormLabel, 
  FormError, 
  FormDescription 
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProjectSelector } from './project-selector'
import { TagSelector } from './tag-selector'
import type { 
  Todo, 
  CreateTodoInput, 
  UpdateTodoInput, 
  TodoPriority, 
  TodoStatus 
} from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface TodoFormProps {
  /** Existing todo to edit (if provided, form is in edit mode) */
  todo?: Todo
  /** Callback when form is successfully submitted */
  onSuccess: (todo: Todo) => void
  /** Callback when form is cancelled */
  onCancel?: () => void
  /** Custom class name */
  className?: string
}

interface FormData {
  title: string
  description: string
  priority: TodoPriority
  status: TodoStatus
  projectId: string
  tagIds: string[]
  dueDate: string
  scheduledDate: string
}

interface FormErrors {
  [key: string]: string[]
}

/**
 * TodoForm component provides a comprehensive form for creating and editing todos.
 * Supports validation, project/tag selection, and handles both create and update operations.
 * 
 * Features:
 * - Create new todos or edit existing ones
 * - Form validation with error display
 * - Project and tag selection with autocomplete
 * - Priority and status selection
 * - Date picker for due and scheduled dates
 * - Loading states and error handling
 * - Keyboard accessibility and proper form submission
 * 
 * @param todo - Existing todo to edit (optional)
 * @param onSuccess - Callback when form is successfully submitted
 * @param onCancel - Callback when form is cancelled
 * @param className - Additional CSS classes
 */
export function TodoForm({
  todo,
  onSuccess,
  onCancel,
  className
}: TodoFormProps) {
  const supabase = createClientComponentClient()
  const isEditing = Boolean(todo)
  
  // Form state
  const [formData, setFormData] = React.useState<FormData>({
    title: todo?.title || '',
    description: todo?.description || '',
    priority: todo?.priority || 'medium',
    status: todo?.status || 'todo',
    projectId: todo?.projectId || '',
    tagIds: todo?.tags?.map(tag => tag.id) || [],
    dueDate: todo?.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '',
    scheduledDate: todo?.scheduledDate ? new Date(todo.scheduledDate).toISOString().split('T')[0] : ''
  })
  
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  /**
   * Validate form data
   */
  const validateForm = React.useCallback((): FormErrors => {
    const newErrors: FormErrors = {}

    // Title is required
    if (!formData.title.trim()) {
      newErrors.title = ['Title is required']
    } else if (formData.title.length > 200) {
      newErrors.title = ['Title must be less than 200 characters']
    }

    // Description length check
    if (formData.description.length > 1000) {
      newErrors.description = ['Description must be less than 1000 characters']
    }

    // Project is required for new todos
    if (!isEditing && !formData.projectId) {
      newErrors.projectId = ['Project is required']
    }

    // Date validation
    if (formData.dueDate && formData.scheduledDate) {
      const dueDate = new Date(formData.dueDate)
      const scheduledDate = new Date(formData.scheduledDate)
      
      if (scheduledDate > dueDate) {
        newErrors.scheduledDate = ['Scheduled date cannot be after due date']
      }
    }

    return newErrors
  }, [formData, isEditing])

  /**
   * Handle form field changes
   */
  const handleFieldChange = React.useCallback(<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }, [errors])

  /**
   * Handle form submission
   */
  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    try {
      setIsSubmitting(true)
      setErrors({})

      if (isEditing && todo) {
        // Update existing todo
        const updateData: UpdateTodoInput = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          priority: formData.priority,
          status: formData.status,
          projectId: formData.projectId || null,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
          scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : null
        }

        // Update the todo
        const { data: updatedTodo, error: updateError } = await supabase
          .from('todos')
          .update(updateData)
          .eq('id', todo.id)
          .select(`
            *,
            project:projects(*),
            tags:todo_tags(tag:tags(*))
          `)
          .single()

        if (updateError) throw updateError

        // Update tags if they changed
        const currentTagIds = new Set(todo.tags?.map(tag => tag.id) || [])
        const newTagIds = new Set(formData.tagIds)
        
        if (!areSetsEqual(currentTagIds, newTagIds)) {
          // Remove old tag associations
          await supabase
            .from('todo_tags')
            .delete()
            .eq('todoId', todo.id)

          // Add new tag associations
          if (formData.tagIds.length > 0) {
            const tagAssociations = formData.tagIds.map(tagId => ({
              todoId: todo.id,
              tagId
            }))

            await supabase
              .from('todo_tags')
              .insert(tagAssociations)
          }

          // Fetch updated todo with tags
          const { data: finalTodo, error: fetchError } = await supabase
            .from('todos')
            .select(`
              *,
              project:projects(*),
              tags:todo_tags(tag:tags(*))
            `)
            .eq('id', todo.id)
            .single()

          if (fetchError) throw fetchError

          const transformedTodo: Todo = {
            ...finalTodo,
            tags: finalTodo.tags?.map((tagRelation: any) => tagRelation.tag) || []
          }

          onSuccess(transformedTodo)
        } else {
          const transformedTodo: Todo = {
            ...updatedTodo,
            tags: updatedTodo.tags?.map((tagRelation: any) => tagRelation.tag) || []
          }

          onSuccess(transformedTodo)
        }
      } else {
        // Create new todo
        const createData: CreateTodoInput = {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          projectId: formData.projectId,
          priority: formData.priority,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : undefined,
          tagIds: formData.tagIds
        }

        const { data: newTodo, error: createError } = await supabase
          .from('todos')
          .insert([createData])
          .select(`
            *,
            project:projects(*),
            tags:todo_tags(tag:tags(*))
          `)
          .single()

        if (createError) throw createError

        // Add tag associations
        if (formData.tagIds.length > 0) {
          const tagAssociations = formData.tagIds.map(tagId => ({
            todoId: newTodo.id,
            tagId
          }))

          await supabase
            .from('todo_tags')
            .insert(tagAssociations)

          // Fetch todo with tags
          const { data: finalTodo, error: fetchError } = await supabase
            .from('todos')
            .select(`
              *,
              project:projects(*),
              tags:todo_tags(tag:tags(*))
            `)
            .eq('id', newTodo.id)
            .single()

          if (fetchError) throw fetchError

          const transformedTodo: Todo = {
            ...finalTodo,
            tags: finalTodo.tags?.map((tagRelation: any) => tagRelation.tag) || []
          }

          onSuccess(transformedTodo)
        } else {
          const transformedTodo: Todo = {
            ...newTodo,
            tags: []
          }

          onSuccess(transformedTodo)
        }
      }
    } catch (err) {
      console.error('Error saving todo:', err)
      setErrors({
        _form: ['Failed to save todo. Please try again.']
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, isEditing, todo, onSuccess, supabase])

  /**
   * Helper function to compare sets
   */
  const areSetsEqual = (set1: Set<string>, set2: Set<string>): boolean => {
    if (set1.size !== set2.size) return false
    for (const item of set1) {
      if (!set2.has(item)) return false
    }
    return true
  }

  return (
    <Form 
      className={className}
      onSubmit={handleSubmit}
      errors={errors}
      isSubmitting={isSubmitting}
    >
      {/* Global form error */}
      {errors._form && (
        <div className="rounded-md bg-destructive/15 p-3">
          <p className="text-sm text-destructive">{errors._form[0]}</p>
        </div>
      )}

      {/* Title */}
      <FormField>
        <FormLabel htmlFor="title">Title</FormLabel>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          placeholder="Enter todo title"
          disabled={isSubmitting}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        <FormError name="title" />
      </FormField>

      {/* Description */}
      <FormField>
        <FormLabel htmlFor="description">Description</FormLabel>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder="Enter todo description (optional)"
          disabled={isSubmitting}
          rows={3}
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        <FormError name="description" />
        <FormDescription>
          Provide additional details about this todo
        </FormDescription>
      </FormField>

      {/* Priority and Status */}
      <div className="grid grid-cols-2 gap-4">
        <FormField>
          <FormLabel>Priority</FormLabel>
          <Select
            value={formData.priority}
            onValueChange={(value: TodoPriority) => handleFieldChange('priority', value)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <FormError name="priority" />
        </FormField>

        {isEditing && (
          <FormField>
            <FormLabel>Status</FormLabel>
            <Select
              value={formData.status}
              onValueChange={(value: TodoStatus) => handleFieldChange('status', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <FormError name="status" />
          </FormField>
        )}
      </div>

      {/* Project Selection */}
      <FormField>
        <FormLabel>Project</FormLabel>
        <ProjectSelector
          value={formData.projectId}
          onValueChange={(projectId) => handleFieldChange('projectId', projectId)}
          disabled={isSubmitting}
        />
        <FormError name="projectId" />
        <FormDescription>
          Select the project this todo belongs to
        </FormDescription>
      </FormField>

      {/* Tag Selection */}
      <FormField>
        <FormLabel>Tags</FormLabel>
        <TagSelector
          value={formData.tagIds}
          onValueChange={(tagIds) => handleFieldChange('tagIds', tagIds)}
          disabled={isSubmitting}
        />
        <FormError name="tagIds" />
        <FormDescription>
          Select tags to categorize this todo
        </FormDescription>
      </FormField>

      {/* Date Fields */}
      <div className="grid grid-cols-2 gap-4">
        <FormField>
          <FormLabel htmlFor="dueDate">Due Date</FormLabel>
          <Input
            id="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={(e) => handleFieldChange('dueDate', e.target.value)}
            disabled={isSubmitting}
            aria-describedby={errors.dueDate ? 'dueDate-error' : undefined}
          />
          <FormError name="dueDate" />
        </FormField>

        <FormField>
          <FormLabel htmlFor="scheduledDate">Scheduled Date</FormLabel>
          <Input
            id="scheduledDate"
            type="date"
            value={formData.scheduledDate}
            onChange={(e) => handleFieldChange('scheduledDate', e.target.value)}
            disabled={isSubmitting}
            aria-describedby={errors.scheduledDate ? 'scheduledDate-error' : undefined}
          />
          <FormError name="scheduledDate" />
        </FormField>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {isEditing ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            isEditing ? 'Update Todo' : 'Create Todo'
          )}
        </Button>
      </div>
    </Form>
  )
}