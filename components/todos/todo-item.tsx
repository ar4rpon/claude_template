'use client'

import * as React from 'react'
import { Calendar, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TodoForm } from './todo-form'
import type { Todo, TodoStatus } from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'

interface TodoItemProps {
  /** The todo item to display */
  todo: Todo
  /** Callback when todo is updated */
  onUpdate: (todo: Todo) => void
  /** Callback when todo is deleted */
  onDelete: (todoId: string) => void
  /** Whether the item is draggable */
  isDraggable?: boolean
  /** Custom class name */
  className?: string
}

/**
 * TodoItem component displays an individual todo with actions for editing, 
 * deleting, and toggling completion status. Supports drag and drop reordering
 * and provides accessible keyboard navigation.
 * 
 * Features:
 * - Toggle completion status with checkbox
 * - Edit todo with inline form
 * - Delete with confirmation dialog
 * - Display priority, due date, and tags
 * - Drag and drop support for reordering
 * - Keyboard accessibility
 * - Loading states for async operations
 * 
 * @param todo - The todo item to display
 * @param onUpdate - Callback when todo is updated
 * @param onDelete - Callback when todo is deleted
 * @param isDraggable - Whether the item supports drag and drop
 * @param className - Additional CSS classes
 */
export function TodoItem({
  todo,
  onUpdate,
  onDelete,
  isDraggable = false,
  className
}: TodoItemProps) {
  const supabase = createClientComponentClient()
  
  // State management
  const [isEditing, setIsEditing] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)

  /**
   * Toggle the completion status of the todo
   */
  const handleToggleStatus = React.useCallback(async () => {
    if (isUpdating) return

    try {
      setIsUpdating(true)
      
      const newStatus: TodoStatus = todo.status === 'done' ? 'todo' : 'done'
      
      const { data, error } = await supabase
        .from('todos')
        .update({ 
          status: newStatus,
          completedAt: newStatus === 'done' ? new Date().toISOString() : null
        })
        .eq('id', todo.id)
        .select(`
          *,
          project:projects(*),
          tags:todo_tags(tag:tags(*))
        `)
        .single()

      if (error) throw error

      // Transform the data to match our Todo type
      const updatedTodo: Todo = {
        ...data,
        tags: data.tags?.map((tagRelation: any) => tagRelation.tag) || []
      }

      onUpdate(updatedTodo)
    } catch (err) {
      console.error('Error updating todo status:', err)
    } finally {
      setIsUpdating(false)
    }
  }, [todo.id, todo.status, onUpdate, supabase, isUpdating])

  /**
   * Handle todo deletion with confirmation
   */
  const handleDelete = React.useCallback(async () => {
    if (isDeleting) return

    try {
      setIsDeleting(true)
      await onDelete(todo.id)
      setShowDeleteDialog(false)
    } catch (err) {
      console.error('Error deleting todo:', err)
    } finally {
      setIsDeleting(false)
    }
  }, [todo.id, onDelete, isDeleting])

  /**
   * Handle successful todo edit
   */
  const handleEditSuccess = React.useCallback((updatedTodo: Todo) => {
    onUpdate(updatedTodo)
    setIsEditing(false)
  }, [onUpdate])

  /**
   * Get priority badge variant based on priority level
   */
  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'warning'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'outline'
    }
  }

  /**
   * Get status badge variant based on status
   */
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'done': return 'success'
      case 'in_progress': return 'default'
      case 'cancelled': return 'secondary'
      default: return 'outline'
    }
  }

  /**
   * Format due date for display
   */
  const formatDueDate = (date: string) => {
    const dueDate = new Date(date)
    const now = new Date()
    const isOverdue = dueDate < now && todo.status !== 'done'
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: dueDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
    
    return {
      formatted: formatter.format(dueDate),
      isOverdue
    }
  }

  const dueDate = todo.dueDate ? formatDueDate(todo.dueDate) : null
  const isCompleted = todo.status === 'done'

  return (
    <>
      <Card 
        className={cn(
          "transition-all duration-200 hover:shadow-md",
          isCompleted && "opacity-75",
          isDraggable && "cursor-move",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Completion checkbox */}
            <Checkbox
              checked={isCompleted}
              onCheckedChange={handleToggleStatus}
              disabled={isUpdating}
              className="mt-1"
              aria-label={`Mark "${todo.title}" as ${isCompleted ? 'incomplete' : 'complete'}`}
            />
            
            {/* Todo content */}
            <div className="flex-1 min-w-0">
              {/* Title and description */}
              <div className="space-y-1">
                <h3 className={cn(
                  "font-medium leading-none",
                  isCompleted && "line-through text-muted-foreground"
                )}>
                  {todo.title}
                </h3>
                
                {todo.description && (
                  <p className={cn(
                    "text-sm text-muted-foreground",
                    isCompleted && "line-through"
                  )}>
                    {todo.description}
                  </p>
                )}
              </div>
              
              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {/* Priority badge */}
                <Badge variant={getPriorityVariant(todo.priority)}>
                  {todo.priority}
                </Badge>
                
                {/* Status badge */}
                <Badge variant={getStatusVariant(todo.status)}>
                  {todo.status.replace('_', ' ')}
                </Badge>
                
                {/* Project badge */}
                {todo.project && (
                  <Badge variant="outline">
                    {todo.project.name}
                  </Badge>
                )}
                
                {/* Due date */}
                {dueDate && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs",
                    dueDate.isOverdue && !isCompleted && "text-destructive"
                  )}>
                    <Calendar className="h-3 w-3" />
                    <span>{dueDate.formatted}</span>
                  </div>
                )}
                
                {/* Tags */}
                {todo.tags && todo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {todo.tags.map((tag) => (
                      <Badge 
                        key={tag.id} 
                        variant="secondary" 
                        className="text-xs"
                        style={{ 
                          backgroundColor: tag.color ? `${tag.color}20` : undefined,
                          borderColor: tag.color || undefined
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Todo</DialogTitle>
          </DialogHeader>
          <TodoForm 
            todo={todo}
            onSuccess={handleEditSuccess}
            onCancel={() => setIsEditing(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Todo</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{todo.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}