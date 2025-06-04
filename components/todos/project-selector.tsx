'use client'

import * as React from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { ProjectForm } from './project-form'
import type { Project } from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'

interface ProjectSelectorProps {
  /** Selected project ID */
  value: string
  /** Callback when project selection changes */
  onValueChange: (projectId: string) => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Whether to show the create project button */
  showCreateButton?: boolean
  /** Custom class name */
  className?: string
}

/**
 * ProjectSelector component provides a dropdown for selecting projects
 * with optional project creation functionality. Supports real-time updates
 * and displays project colors and metadata.
 * 
 * Features:
 * - Dropdown selection with search capability
 * - Project color indicators
 * - Create new project inline
 * - Real-time updates via Supabase subscriptions
 * - Loading states and error handling
 * - Keyboard navigation and accessibility
 * 
 * @param value - Selected project ID
 * @param onValueChange - Callback when project selection changes
 * @param disabled - Whether the selector is disabled
 * @param placeholder - Placeholder text for empty selection
 * @param showCreateButton - Whether to show create project button
 * @param className - Additional CSS classes
 */
export function ProjectSelector({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select a project",
  showCreateButton = true,
  className
}: ProjectSelectorProps) {
  const supabase = createClientComponentClient()
  
  // State management
  const [projects, setProjects] = React.useState<Project[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)

  /**
   * Load projects from Supabase
   */
  const loadProjects = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          todoCount:todos(count)
        `)
        .eq('isArchived', false)
        .order('displayOrder', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) throw error
      
      // Transform the data to include todo count
      const transformedProjects: Project[] = data?.map(project => ({
        ...project,
        todoCount: project.todoCount?.[0]?.count || 0
      })) || []
      
      setProjects(transformedProjects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      console.error('Error loading projects:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Handle new project creation
   */
  const handleProjectCreate = React.useCallback(async (newProject: Project) => {
    setProjects(prev => [...prev, newProject])
    setIsCreateDialogOpen(false)
    onValueChange(newProject.id) // Auto-select the new project
  }, [onValueChange])

  // Load projects on mount
  React.useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Set up real-time subscriptions
  React.useEffect(() => {
    const channel = supabase
      .channel('projects_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          // Reload projects when changes occur
          loadProjects()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadProjects])

  /**
   * Get the selected project
   */
  const selectedProject = React.useMemo(() => {
    return projects.find(project => project.id === value)
  }, [projects, value])

  /**
   * Render project option with color indicator
   */
  const renderProjectOption = (project: Project) => (
    <div className="flex items-center gap-2">
      {project.color && (
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: project.color }}
          aria-hidden="true"
        />
      )}
      <span className="flex-1 truncate">{project.name}</span>
      {project.todoCount !== undefined && project.todoCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {project.todoCount}
        </Badge>
      )}
    </div>
  )

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Error loading projects: {error}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading projects..." : placeholder}>
            {selectedProject && renderProjectOption(selectedProject)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Empty option for deselection */}
          {placeholder && (
            <>
              <SelectItem value="">
                <span className="text-muted-foreground">{placeholder}</span>
              </SelectItem>
              {projects.length > 0 && <div className="h-px bg-border my-1" />}
            </>
          )}
          
          {/* Project options */}
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {renderProjectOption(project)}
            </SelectItem>
          ))}
          
          {/* Create new project option */}
          {showCreateButton && (
            <>
              {projects.length > 0 && <div className="h-px bg-border my-1" />}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    disabled={disabled}
                  >
                    <Plus className="h-4 w-4" />
                    Create new project
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                  </DialogHeader>
                  <ProjectForm 
                    onSuccess={handleProjectCreate}
                    onCancel={() => setIsCreateDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </>
          )}
          
          {/* No projects state */}
          {projects.length === 0 && !loading && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No projects found.
              {showCreateButton && (
                <>
                  <br />
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="h-auto p-0 text-sm">
                        Create your first project
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                      </DialogHeader>
                      <ProjectForm 
                        onSuccess={handleProjectCreate}
                        onCancel={() => setIsCreateDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}