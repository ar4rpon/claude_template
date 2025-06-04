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
import type { 
  Project, 
  CreateProjectInput, 
  UpdateProjectInput 
} from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ProjectFormProps {
  /** Existing project to edit (if provided, form is in edit mode) */
  project?: Project
  /** Callback when form is successfully submitted */
  onSuccess: (project: Project) => void
  /** Callback when form is cancelled */
  onCancel?: () => void
  /** Custom class name */
  className?: string
}

interface FormData {
  name: string
  description: string
  color: string
  icon: string
}

interface FormErrors {
  [key: string]: string[]
}

/**
 * ProjectForm component provides a form for creating and editing projects.
 * Supports validation, color picker, and icon selection with proper error handling.
 * 
 * Features:
 * - Create new projects or edit existing ones
 * - Form validation with error display
 * - Color picker for project identification
 * - Icon/emoji selector for visual representation
 * - Loading states and error handling
 * - Keyboard accessibility and proper form submission
 * 
 * @param project - Existing project to edit (optional)
 * @param onSuccess - Callback when form is successfully submitted
 * @param onCancel - Callback when form is cancelled
 * @param className - Additional CSS classes
 */
export function ProjectForm({
  project,
  onSuccess,
  onCancel,
  className
}: ProjectFormProps) {
  const supabase = createClientComponentClient()
  const isEditing = Boolean(project)
  
  // Form state
  const [formData, setFormData] = React.useState<FormData>({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || '#3b82f6',
    icon: project?.icon || ''
  })
  
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  /**
   * Predefined color options for projects
   */
  const colorOptions = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#ec4899', // Pink
    '#6b7280', // Gray
    '#1f2937', // Dark gray
    '#059669'  // Green
  ]

  /**
   * Common emoji icons for projects
   */
  const iconOptions = [
    '📁', '📂', '📋', '📊', '📈', '📉',
    '🎯', '🚀', '💼', '🏠', '🎨', '💡',
    '🔧', '⚙️', '📱', '💻', '🌟', '🔥',
    '📚', '🎓', '💰', '🎮', '🏆', '📝'
  ]

  /**
   * Validate form data
   */
  const validateForm = React.useCallback((): FormErrors => {
    const newErrors: FormErrors = {}

    // Name is required
    if (!formData.name.trim()) {
      newErrors.name = ['Project name is required']
    } else if (formData.name.length > 100) {
      newErrors.name = ['Project name must be less than 100 characters']
    }

    // Description length check
    if (formData.description.length > 500) {
      newErrors.description = ['Description must be less than 500 characters']
    }

    // Color validation (basic hex check)
    if (formData.color && !/^#[0-9A-F]{6}$/i.test(formData.color)) {
      newErrors.color = ['Please enter a valid hex color code']
    }

    return newErrors
  }, [formData])

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

      if (isEditing && project) {
        // Update existing project
        const updateData: UpdateProjectInput = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color || null,
          icon: formData.icon.trim() || null
        }

        const { data: updatedProject, error: updateError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', project.id)
          .select(`
            *,
            todoCount:todos(count)
          `)
          .single()

        if (updateError) throw updateError

        // Transform the data to include todo count
        const transformedProject: Project = {
          ...updatedProject,
          todoCount: updatedProject.todoCount?.[0]?.count || 0
        }

        onSuccess(transformedProject)
      } else {
        // Create new project
        const createData: CreateProjectInput = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color || undefined,
          icon: formData.icon.trim() || undefined
        }

        const { data: newProject, error: createError } = await supabase
          .from('projects')
          .insert([createData])
          .select(`
            *,
            todoCount:todos(count)
          `)
          .single()

        if (createError) throw createError

        // Transform the data to include todo count
        const transformedProject: Project = {
          ...newProject,
          todoCount: 0 // New project has no todos
        }

        onSuccess(transformedProject)
      }
    } catch (err) {
      console.error('Error saving project:', err)
      setErrors({
        _form: ['Failed to save project. Please try again.']
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, isEditing, project, onSuccess, supabase])

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

      {/* Project Name */}
      <FormField>
        <FormLabel htmlFor="name">Project Name</FormLabel>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="Enter project name"
          disabled={isSubmitting}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        <FormError name="name" />
      </FormField>

      {/* Description */}
      <FormField>
        <FormLabel htmlFor="description">Description</FormLabel>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder="Enter project description (optional)"
          disabled={isSubmitting}
          rows={3}
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        <FormError name="description" />
        <FormDescription>
          A brief description of what this project is about
        </FormDescription>
      </FormField>

      {/* Color Selection */}
      <FormField>
        <FormLabel>Project Color</FormLabel>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              disabled={isSubmitting}
              className="w-12 h-8 rounded border cursor-pointer disabled:cursor-not-allowed"
              aria-label="Custom color picker"
            />
            <Input
              value={formData.color}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              placeholder="#3b82f6"
              disabled={isSubmitting}
              className="font-mono text-sm"
              maxLength={7}
            />
          </div>
          
          {/* Predefined color options */}
          <div className="grid grid-cols-6 gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleFieldChange('color', color)}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-full border-2 border-transparent hover:border-gray-300 focus:border-gray-400 focus:outline-none transition-colors disabled:cursor-not-allowed"
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              >
                {formData.color === color && (
                  <div className="w-full h-full rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
        <FormError name="color" />
        <FormDescription>
          Choose a color to help identify this project
        </FormDescription>
      </FormField>

      {/* Icon Selection */}
      <FormField>
        <FormLabel htmlFor="icon">Project Icon</FormLabel>
        <div className="space-y-3">
          <Input
            id="icon"
            value={formData.icon}
            onChange={(e) => handleFieldChange('icon', e.target.value)}
            placeholder="📁"
            disabled={isSubmitting}
            className="text-center text-lg"
            maxLength={2}
          />
          
          {/* Predefined icon options */}
          <div className="grid grid-cols-6 gap-2">
            {iconOptions.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => handleFieldChange('icon', icon)}
                disabled={isSubmitting}
                className="w-10 h-10 rounded border border-input hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors disabled:cursor-not-allowed text-lg"
                aria-label={`Select icon ${icon}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <FormDescription>
          Choose an emoji or icon to represent this project
        </FormDescription>
      </FormField>

      {/* Preview */}
      <FormField>
        <FormLabel>Preview</FormLabel>
        <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
          {formData.color && (
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: formData.color }}
              aria-hidden="true"
            />
          )}
          {formData.icon && (
            <span className="text-lg" role="img" aria-label="Project icon">
              {formData.icon}
            </span>
          )}
          <div className="flex-1">
            <div className="font-medium">
              {formData.name || 'Project Name'}
            </div>
            {formData.description && (
              <div className="text-sm text-muted-foreground">
                {formData.description}
              </div>
            )}
          </div>
        </div>
        <FormDescription>
          This is how your project will appear in the interface
        </FormDescription>
      </FormField>

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
            isEditing ? 'Update Project' : 'Create Project'
          )}
        </Button>
      </div>
    </Form>
  )
}