'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TodoItem } from './todo-item'
import { TodoFilters } from './todo-filters'
import { TodoForm } from './todo-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Todo, TodoFilters as TodoFiltersType, TodoSort, SortField, SortOrder } from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface TodoListProps {
  /** Initial todos to display */
  initialTodos?: Todo[]
  /** Whether to show the create button */
  showCreateButton?: boolean
  /** Page size for pagination */
  pageSize?: number
  /** Custom class name */
  className?: string
}

/**
 * TodoList component provides a comprehensive interface for displaying and managing todos
 * with filtering, sorting, pagination, and real-time updates via Supabase subscriptions.
 * 
 * Features:
 * - Real-time updates via Supabase subscriptions
 * - Advanced filtering by status, priority, project, tags, and date ranges
 * - Sorting by multiple fields with ascending/descending order
 * - Pagination with configurable page size
 * - Search functionality
 * - Drag and drop reordering (future enhancement)
 * - Responsive design with loading and error states
 * 
 * @param initialTodos - Initial list of todos to display
 * @param showCreateButton - Whether to show the create new todo button
 * @param pageSize - Number of todos per page (default: 20)
 * @param className - Additional CSS classes
 */
export function TodoList({
  initialTodos = [],
  showCreateButton = true,
  pageSize = 20,
  className
}: TodoListProps) {
  const supabase = createClientComponentClient()
  
  // State management
  const [todos, setTodos] = React.useState<Todo[]>(initialTodos)
  const [filteredTodos, setFilteredTodos] = React.useState<Todo[]>(initialTodos)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  
  // Filters and sorting
  const [filters, setFilters] = React.useState<TodoFiltersType>({})
  const [sort, setSort] = React.useState<TodoSort>({
    field: 'created_at',
    order: 'desc'
  })

  /**
   * Apply filters, search, and sorting to the todos list
   */
  const applyFiltersAndSort = React.useCallback(() => {
    let filtered = [...todos]
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(todo =>
        todo.title.toLowerCase().includes(searchLower) ||
        todo.description?.toLowerCase().includes(searchLower)
      )
    }
    
    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(todo => filters.status!.includes(todo.status))
    }
    
    // Apply priority filter
    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter(todo => filters.priority!.includes(todo.priority))
    }
    
    // Apply project filter
    if (filters.projectId) {
      filtered = filtered.filter(todo => todo.projectId === filters.projectId)
    }
    
    // Apply tag filter
    if (filters.tagIds && filters.tagIds.length > 0) {
      filtered = filtered.filter(todo =>
        todo.tags?.some(tag => filters.tagIds!.includes(tag.id))
      )
    }
    
    // Apply date range filter
    if (filters.dueDateFrom || filters.dueDateTo) {
      filtered = filtered.filter(todo => {
        if (!todo.dueDate) return false
        const dueDate = new Date(todo.dueDate)
        
        if (filters.dueDateFrom && dueDate < filters.dueDateFrom) return false
        if (filters.dueDateTo && dueDate > filters.dueDateTo) return false
        
        return true
      })
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sort.field]
      let bValue: any = b[sort.field]
      
      // Handle date fields
      if (sort.field === 'created_at' || sort.field === 'due_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0
        bValue = bValue ? new Date(bValue).getTime() : 0
      }
      
      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue?.toLowerCase() || ''
      }
      
      // Handle priority sorting (custom order)
      if (sort.field === 'priority') {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
        aValue = priorityOrder[aValue as keyof typeof priorityOrder] || 0
        bValue = priorityOrder[bValue as keyof typeof priorityOrder] || 0
      }
      
      // Handle status sorting (custom order)
      if (sort.field === 'status') {
        const statusOrder = { todo: 1, in_progress: 2, done: 3, cancelled: 4 }
        aValue = statusOrder[aValue as keyof typeof statusOrder] || 0
        bValue = statusOrder[bValue as keyof typeof statusOrder] || 0
      }
      
      if (aValue < bValue) return sort.order === 'asc' ? -1 : 1
      if (aValue > bValue) return sort.order === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredTodos(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [todos, searchTerm, filters, sort])

  /**
   * Load todos from Supabase with related data
   */
  const loadTodos = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('todos')
        .select(`
          *,
          project:projects(*),
          tags:todo_tags(tag:tags(*))
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Transform the data to match our Todo type
      const transformedTodos: Todo[] = data?.map(todo => ({
        ...todo,
        tags: todo.tags?.map((tagRelation: any) => tagRelation.tag) || []
      })) || []
      
      setTodos(transformedTodos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load todos')
      console.error('Error loading todos:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Handle todo updates (status change, edit, delete)
   */
  const handleTodoUpdate = React.useCallback(async (updatedTodo: Todo) => {
    setTodos(prev => prev.map(todo => 
      todo.id === updatedTodo.id ? updatedTodo : todo
    ))
  }, [])

  /**
   * Handle todo deletion
   */
  const handleTodoDelete = React.useCallback(async (todoId: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId)
      
      if (error) throw error
      
      setTodos(prev => prev.filter(todo => todo.id !== todoId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete todo')
      console.error('Error deleting todo:', err)
    }
  }, [supabase])

  /**
   * Handle new todo creation
   */
  const handleTodoCreate = React.useCallback(async (newTodo: Todo) => {
    setTodos(prev => [newTodo, ...prev])
    setIsCreateDialogOpen(false)
  }, [])

  /**
   * Handle sorting changes
   */
  const handleSortChange = React.useCallback((field: SortField) => {
    setSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  // Load todos on mount
  React.useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // Apply filters whenever dependencies change
  React.useEffect(() => {
    applyFiltersAndSort()
  }, [applyFiltersAndSort])

  // Set up real-time subscriptions
  React.useEffect(() => {
    const channel = supabase
      .channel('todos_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'todos' },
        () => {
          // Reload todos when changes occur
          loadTodos()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadTodos])

  // Pagination calculations
  const totalPages = Math.ceil(filteredTodos.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTodos = filteredTodos.slice(startIndex, endIndex)

  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  if (loading && todos.length === 0) {
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Todos</CardTitle>
            {showCreateButton && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Todo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Todo</DialogTitle>
                  </DialogHeader>
                  <TodoForm onSuccess={handleTodoCreate} />
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search todos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Filters */}
          <TodoFilters
            filters={filters}
            onFiltersChange={setFilters}
            sort={sort}
            onSortChange={handleSortChange}
          />
          
          {/* Error state */}
          {error && (
            <div className="rounded-md bg-destructive/15 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          {/* Todo list */}
          <div className="space-y-3">
            {paginatedTodos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {filteredTodos.length === 0 && todos.length > 0 ? (
                  <p>No todos match your current filters.</p>
                ) : (
                  <p>No todos found. Create your first todo to get started!</p>
                )}
              </div>
            ) : (
              paginatedTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onUpdate={handleTodoUpdate}
                  onDelete={handleTodoDelete}
                />
              ))
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredTodos.length)} of {filteredTodos.length} todos
              </p>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  disabled={!canGoPrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!canGoNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}