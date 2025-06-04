'use client'

import * as React from 'react'
import { Edit, MoreHorizontal, Plus, Trash2, Tag as TagIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog'
import { 
  Form, 
  FormField, 
  FormLabel, 
  FormError, 
  FormDescription 
} from '@/components/ui/form'
import type { Tag, CreateTagInput } from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'

interface TagManagerProps {
  /** Initial tags to display */
  initialTags?: Tag[]
  /** Whether to show the create button */
  showCreateButton?: boolean
  /** Custom class name */
  className?: string
}

interface TagFormData {
  name: string
  color: string
}

interface FormErrors {
  [key: string]: string[]
}

/**
 * TagManager component provides a comprehensive interface for managing tags.
 * Supports creating, editing, and deleting tags with color customization
 * and usage statistics.
 * 
 * Features:
 * - Display tags with color indicators and usage count
 * - Create new tags with color picker
 * - Edit existing tags
 * - Delete tags with confirmation
 * - Real-time updates via Supabase subscriptions
 * - Search and filter functionality
 * - Responsive grid layout
 * - Loading states and error handling
 * 
 * @param initialTags - Initial list of tags to display
 * @param showCreateButton - Whether to show create tag button
 * @param className - Additional CSS classes
 */
export function TagManager({
  initialTags = [],
  showCreateButton = true,
  className
}: TagManagerProps) {
  const supabase = createClientComponentClient()
  
  // State management
  const [tags, setTags] = React.useState<Tag[]>(initialTags)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [editingTag, setEditingTag] = React.useState<Tag | null>(null)
  const [deletingTag, setDeletingTag] = React.useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  
  // Form state for create/edit
  const [formData, setFormData] = React.useState<TagFormData>({
    name: '',
    color: '#3b82f6'
  })
  const [formErrors, setFormErrors] = React.useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  /**
   * Predefined color options for tags
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
   * Load tags from Supabase
   */
  const loadTags = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('tags')
        .select(`
          *,
          usageCount:todo_tags(count)
        `)
        .order('name', { ascending: true })
      
      if (error) throw error
      
      // Transform the data to include usage count
      const transformedTags: Tag[] = data?.map(tag => ({
        ...tag,
        usageCount: tag.usageCount?.[0]?.count || 0
      })) || []
      
      setTags(transformedTags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags')
      console.error('Error loading tags:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Validate form data
   */
  const validateForm = React.useCallback((): FormErrors => {
    const newErrors: FormErrors = {}

    // Name is required
    if (!formData.name.trim()) {
      newErrors.name = ['Tag name is required']
    } else if (formData.name.length > 50) {
      newErrors.name = ['Tag name must be less than 50 characters']
    } else {
      // Check for duplicate names (excluding current tag when editing)
      const isDuplicate = tags.some(tag => 
        tag.name.toLowerCase() === formData.name.trim().toLowerCase() &&
        tag.id !== editingTag?.id
      )
      if (isDuplicate) {
        newErrors.name = ['A tag with this name already exists']
      }
    }

    // Color validation (basic hex check)
    if (formData.color && !/^#[0-9A-F]{6}$/i.test(formData.color)) {
      newErrors.color = ['Please enter a valid hex color code']
    }

    return newErrors
  }, [formData, tags, editingTag])

  /**
   * Handle form field changes
   */
  const handleFieldChange = React.useCallback(<K extends keyof TagFormData>(
    field: K,
    value: TagFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }, [formErrors])

  /**
   * Handle form submission (create or edit)
   */
  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    try {
      setIsSubmitting(true)
      setFormErrors({})

      if (editingTag) {
        // Update existing tag
        const { data: updatedTag, error: updateError } = await supabase
          .from('tags')
          .update({
            name: formData.name.trim(),
            color: formData.color
          })
          .eq('id', editingTag.id)
          .select(`
            *,
            usageCount:todo_tags(count)
          `)
          .single()

        if (updateError) throw updateError

        const transformedTag: Tag = {
          ...updatedTag,
          usageCount: updatedTag.usageCount?.[0]?.count || 0
        }

        setTags(prev => prev.map(tag => 
          tag.id === editingTag.id ? transformedTag : tag
        ))
        setEditingTag(null)
      } else {
        // Create new tag
        const createData: CreateTagInput = {
          name: formData.name.trim(),
          color: formData.color
        }

        const { data: newTag, error: createError } = await supabase
          .from('tags')
          .insert([createData])
          .select(`
            *,
            usageCount:todo_tags(count)
          `)
          .single()

        if (createError) throw createError

        const transformedTag: Tag = {
          ...newTag,
          usageCount: 0 // New tag has no usage
        }

        setTags(prev => [...prev, transformedTag].sort((a, b) => a.name.localeCompare(b.name)))
        setIsCreateDialogOpen(false)
      }

      // Reset form
      setFormData({ name: '', color: '#3b82f6' })
    } catch (err) {
      console.error('Error saving tag:', err)
      setFormErrors({
        _form: ['Failed to save tag. Please try again.']
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, editingTag, supabase])

  /**
   * Handle tag deletion
   */
  const handleTagDelete = React.useCallback(async () => {
    if (!deletingTag || isDeleting) return

    try {
      setIsDeleting(true)
      
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', deletingTag.id)
      
      if (error) throw error
      
      setTags(prev => prev.filter(tag => tag.id !== deletingTag.id))
      setDeletingTag(null)
    } catch (err) {
      console.error('Error deleting tag:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete tag')
    } finally {
      setIsDeleting(false)
    }
  }, [deletingTag, isDeleting, supabase])

  /**
   * Start editing a tag
   */
  const startEditing = React.useCallback((tag: Tag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      color: tag.color || '#3b82f6'
    })
    setFormErrors({})
  }, [])

  /**
   * Cancel editing
   */
  const cancelEditing = React.useCallback(() => {
    setEditingTag(null)
    setFormData({ name: '', color: '#3b82f6' })
    setFormErrors({})
  }, [])

  // Load tags on mount
  React.useEffect(() => {
    loadTags()
  }, [loadTags])

  // Set up real-time subscriptions
  React.useEffect(() => {
    const channel = supabase
      .channel('tags_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tags' },
        () => {
          // Reload tags when changes occur
          loadTags()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadTags])

  /**
   * Filter tags based on search term
   */
  const filteredTags = React.useMemo(() => {
    if (!searchTerm.trim()) return tags
    
    const searchLower = searchTerm.toLowerCase()
    return tags.filter(tag => 
      tag.name.toLowerCase().includes(searchLower)
    )
  }, [tags, searchTerm])

  /**
   * Render tag form
   */
  const renderTagForm = () => (
    <Form 
      onSubmit={handleSubmit}
      errors={formErrors}
      isSubmitting={isSubmitting}
    >
      {/* Global form error */}
      {formErrors._form && (
        <div className="rounded-md bg-destructive/15 p-3">
          <p className="text-sm text-destructive">{formErrors._form[0]}</p>
        </div>
      )}

      {/* Tag Name */}
      <FormField>
        <FormLabel htmlFor="tagName">Tag Name</FormLabel>
        <Input
          id="tagName"
          value={formData.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="Enter tag name"
          disabled={isSubmitting}
        />
        <FormError name="name" />
      </FormField>

      {/* Color Selection */}
      <FormField>
        <FormLabel>Color</FormLabel>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              disabled={isSubmitting}
              className="w-12 h-8 rounded border cursor-pointer"
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
                className="w-8 h-8 rounded-full border-2 border-transparent hover:border-gray-300 focus:border-gray-400 focus:outline-none transition-colors"
                style={{ backgroundColor: color }}
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
      </FormField>

      {/* Preview */}
      <FormField>
        <FormLabel>Preview</FormLabel>
        <Badge
          variant="secondary"
          style={{ 
            backgroundColor: formData.color ? `${formData.color}20` : undefined,
            borderColor: formData.color || undefined
          }}
        >
          {formData.name || 'Tag Name'}
        </Badge>
      </FormField>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={editingTag ? cancelEditing : () => setIsCreateDialogOpen(false)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {editingTag ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            editingTag ? 'Update Tag' : 'Create Tag'
          )}
        </Button>
      </div>
    </Form>
  )

  if (loading && tags.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Tags</h2>
          <p className="text-muted-foreground">
            Organize and categorize your todos with tags
          </p>
        </div>
        
        {showCreateButton && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Tag</DialogTitle>
              </DialogHeader>
              {renderTagForm()}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 mb-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Tags grid */}
      {filteredTags.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TagIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'No tags found' : 'No tags yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms.'
                : 'Create your first tag to start categorizing your todos.'
              }
            </p>
            {showCreateButton && !searchTerm && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Tag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Tag</DialogTitle>
                  </DialogHeader>
                  {renderTagForm()}
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTags.map((tag) => (
            <Card key={tag.id} className="transition-all duration-200 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color || '#6b7280' }}
                    />
                    <span className="font-medium truncate">{tag.name}</span>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEditing(tag)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeletingTag(tag)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    style={{ 
                      backgroundColor: tag.color ? `${tag.color}20` : undefined,
                      borderColor: tag.color || undefined
                    }}
                  >
                    {tag.name}
                  </Badge>
                  
                  {tag.usageCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {tag.usageCount} use{tag.usageCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit tag dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && cancelEditing()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          {renderTagForm()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingTag} onOpenChange={(open) => !open && setDeletingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tag "{deletingTag?.name}"? This will remove it from all todos that use this tag. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeletingTag(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleTagDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}