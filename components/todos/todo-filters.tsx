'use client'

import * as React from 'react'
import { CalendarDays, Filter, RotateCcw, SortAsc, SortDesc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
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
  TodoFilters as TodoFiltersType, 
  TodoSort, 
  SortField, 
  TodoStatus, 
  TodoPriority 
} from '@/types'

interface TodoFiltersProps {
  /** Current filter values */
  filters: TodoFiltersType
  /** Callback when filters change */
  onFiltersChange: (filters: TodoFiltersType) => void
  /** Current sort configuration */
  sort: TodoSort
  /** Callback when sort changes */
  onSortChange: (field: SortField) => void
  /** Whether filters are disabled */
  disabled?: boolean
  /** Custom class name */
  className?: string
}

/**
 * TodoFilters component provides a comprehensive filtering and sorting interface
 * for the todo list. Supports filtering by status, priority, project, tags, and 
 * date ranges, plus sorting by multiple fields.
 * 
 * Features:
 * - Status and priority multi-select filters
 * - Project and tag selection
 * - Date range picker for due dates
 * - Sortable columns with visual indicators
 * - Clear all filters functionality
 * - Active filter count display
 * - Responsive design with collapsible sections
 * 
 * @param filters - Current filter values
 * @param onFiltersChange - Callback when filters change
 * @param sort - Current sort configuration
 * @param onSortChange - Callback when sort changes
 * @param disabled - Whether filters are disabled
 * @param className - Additional CSS classes
 */
export function TodoFilters({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  disabled = false,
  className
}: TodoFiltersProps) {
  
  /**
   * Handle status filter changes
   */
  const handleStatusChange = React.useCallback((status: TodoStatus, checked: boolean) => {
    const currentStatuses = filters.status || []
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter(s => s !== status)
    
    onFiltersChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined
    })
  }, [filters, onFiltersChange])

  /**
   * Handle priority filter changes
   */
  const handlePriorityChange = React.useCallback((priority: TodoPriority, checked: boolean) => {
    const currentPriorities = filters.priority || []
    const newPriorities = checked
      ? [...currentPriorities, priority]
      : currentPriorities.filter(p => p !== priority)
    
    onFiltersChange({
      ...filters,
      priority: newPriorities.length > 0 ? newPriorities : undefined
    })
  }, [filters, onFiltersChange])

  /**
   * Handle project filter change
   */
  const handleProjectChange = React.useCallback((projectId: string) => {
    onFiltersChange({
      ...filters,
      projectId: projectId || undefined
    })
  }, [filters, onFiltersChange])

  /**
   * Handle tag filter change
   */
  const handleTagChange = React.useCallback((tagIds: string[]) => {
    onFiltersChange({
      ...filters,
      tagIds: tagIds.length > 0 ? tagIds : undefined
    })
  }, [filters, onFiltersChange])

  /**
   * Handle date range changes
   */
  const handleDateChange = React.useCallback((field: 'dueDateFrom' | 'dueDateTo', value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value ? new Date(value) : undefined
    })
  }, [filters, onFiltersChange])

  /**
   * Clear all filters
   */
  const handleClearFilters = React.useCallback(() => {
    onFiltersChange({})
  }, [onFiltersChange])

  /**
   * Get sort icon for a field
   */
  const getSortIcon = (field: SortField) => {
    if (sort.field !== field) return null
    return sort.order === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
  }

  /**
   * Count active filters
   */
  const getActiveFilterCount = React.useMemo(() => {
    let count = 0
    if (filters.status && filters.status.length > 0) count++
    if (filters.priority && filters.priority.length > 0) count++
    if (filters.projectId) count++
    if (filters.tagIds && filters.tagIds.length > 0) count++
    if (filters.dueDateFrom || filters.dueDateTo) count++
    if (filters.search) count++
    return count
  }, [filters])

  /**
   * Format date for input
   */
  const formatDateForInput = (date: Date | undefined) => {
    return date ? date.toISOString().split('T')[0] : ''
  }

  const statusOptions: { value: TodoStatus; label: string }[] = [
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  const priorityOptions: { value: TodoPriority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ]

  const sortOptions: { value: SortField; label: string }[] = [
    { value: 'created_at', label: 'Created' },
    { value: 'title', label: 'Title' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'priority', label: 'Priority' },
    { value: 'status', label: 'Status' }
  ]

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 pb-4 border-b">
        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sort by:</span>
          <Select
            value={sort.field}
            onValueChange={(value: SortField) => onSortChange(value)}
            disabled={disabled}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.label}
                    {getSortIcon(option.value)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {getActiveFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                  {getActiveFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {getActiveFilterCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearFilters}
                    disabled={disabled}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Status filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${option.value}`}
                        checked={filters.status?.includes(option.value) || false}
                        onCheckedChange={(checked) => 
                          handleStatusChange(option.value, Boolean(checked))
                        }
                        disabled={disabled}
                      />
                      <label 
                        htmlFor={`status-${option.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <div className="grid grid-cols-2 gap-2">
                  {priorityOptions.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`priority-${option.value}`}
                        checked={filters.priority?.includes(option.value) || false}
                        onCheckedChange={(checked) => 
                          handlePriorityChange(option.value, Boolean(checked))
                        }
                        disabled={disabled}
                      />
                      <label 
                        htmlFor={`priority-${option.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Project</label>
                <ProjectSelector
                  value={filters.projectId || ''}
                  onValueChange={handleProjectChange}
                  disabled={disabled}
                  placeholder="All projects"
                />
              </div>

              {/* Tag filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags</label>
                <TagSelector
                  value={filters.tagIds || []}
                  onValueChange={handleTagChange}
                  disabled={disabled}
                  placeholder="All tags"
                />
              </div>

              {/* Date range filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="dueDateFrom" className="text-xs text-muted-foreground">
                      From
                    </label>
                    <Input
                      id="dueDateFrom"
                      type="date"
                      value={formatDateForInput(filters.dueDateFrom)}
                      onChange={(e) => handleDateChange('dueDateFrom', e.target.value)}
                      disabled={disabled}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="dueDateTo" className="text-xs text-muted-foreground">
                      To
                    </label>
                    <Input
                      id="dueDateTo"
                      type="date"
                      value={formatDateForInput(filters.dueDateTo)}
                      onChange={(e) => handleDateChange('dueDateTo', e.target.value)}
                      disabled={disabled}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Active filter badges */}
        <div className="flex flex-wrap gap-1">
          {filters.status && filters.status.map(status => (
            <Badge 
              key={status} 
              variant="secondary" 
              className="text-xs cursor-pointer"
              onClick={() => handleStatusChange(status, false)}
            >
              Status: {status.replace('_', ' ')}
              <span className="ml-1">×</span>
            </Badge>
          ))}
          
          {filters.priority && filters.priority.map(priority => (
            <Badge 
              key={priority} 
              variant="secondary" 
              className="text-xs cursor-pointer"
              onClick={() => handlePriorityChange(priority, false)}
            >
              Priority: {priority}
              <span className="ml-1">×</span>
            </Badge>
          ))}
          
          {filters.projectId && (
            <Badge 
              variant="secondary" 
              className="text-xs cursor-pointer"
              onClick={() => handleProjectChange('')}
            >
              Project filter
              <span className="ml-1">×</span>
            </Badge>
          )}
          
          {filters.tagIds && filters.tagIds.length > 0 && (
            <Badge 
              variant="secondary" 
              className="text-xs cursor-pointer"
              onClick={() => handleTagChange([])}
            >
              {filters.tagIds.length} tag{filters.tagIds.length > 1 ? 's' : ''}
              <span className="ml-1">×</span>
            </Badge>
          )}
          
          {(filters.dueDateFrom || filters.dueDateTo) && (
            <Badge 
              variant="secondary" 
              className="text-xs cursor-pointer"
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  dueDateFrom: undefined,
                  dueDateTo: undefined
                })
              }}
            >
              <CalendarDays className="h-3 w-3 mr-1" />
              Date range
              <span className="ml-1">×</span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}