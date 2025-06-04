'use client'

import * as React from 'react'
import { Archive, Edit, MoreHorizontal, Plus, Trash2, Folder } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { ProjectForm } from './project-form'
import type { Project } from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'

interface ProjectListProps {
  /** Initial projects to display */
  initialProjects?: Project[]
  /** Whether to show archived projects */
  showArchived?: boolean
  /** Whether to show the create button */
  showCreateButton?: boolean
  /** Callback when a project is selected */
  onProjectSelect?: (project: Project) => void
  /** Custom class name */
  className?: string
}

/**
 * ProjectList component displays and manages projects with support for
 * creating, editing, archiving, and deleting projects. Includes real-time
 * updates and drag-and-drop reordering capabilities.
 * 
 * Features:
 * - Display projects with color indicators and metadata
 * - Create, edit, archive, and delete projects
 * - Real-time updates via Supabase subscriptions
 * - Drag and drop reordering (future enhancement)
 * - Todo count display for each project
 * - Archive/unarchive functionality
 * - Responsive grid layout
 * - Loading states and error handling
 * 
 * @param initialProjects - Initial list of projects to display
 * @param showArchived - Whether to show archived projects
 * @param showCreateButton - Whether to show create project button
 * @param onProjectSelect - Callback when a project is selected
 * @param className - Additional CSS classes
 */
export function ProjectList({
  initialProjects = [],
  showArchived = false,
  showCreateButton = true,
  onProjectSelect,
  className
}: ProjectListProps) {
  const supabase = createClientComponentClient()
  
  // State management
  const [projects, setProjects] = React.useState<Project[]>(initialProjects)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<Project | null>(null)
  const [deletingProject, setDeleteingProject] = React.useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

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
        .eq('isArchived', showArchived)
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
  }, [supabase, showArchived])

  /**
   * Handle project creation
   */
  const handleProjectCreate = React.useCallback(async (newProject: Project) => {
    setProjects(prev => [...prev, newProject])
    setIsCreateDialogOpen(false)
  }, [])

  /**
   * Handle project update
   */
  const handleProjectUpdate = React.useCallback(async (updatedProject: Project) => {
    setProjects(prev => prev.map(project => 
      project.id === updatedProject.id ? updatedProject : project
    ))
    setEditingProject(null)
  }, [])

  /**
   * Handle project archive/unarchive
   */
  const handleProjectArchive = React.useCallback(async (project: Project) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ isArchived: !project.isArchived })
        .eq('id', project.id)
      
      if (error) throw error
      
      // Remove from current list if we're not showing archived projects
      if (!showArchived) {
        setProjects(prev => prev.filter(p => p.id !== project.id))
      } else {
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, isArchived: !p.isArchived } : p
        ))
      }
    } catch (err) {
      console.error('Error archiving project:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive project')
    }
  }, [supabase, showArchived])

  /**
   * Handle project deletion
   */
  const handleProjectDelete = React.useCallback(async () => {
    if (!deletingProject || isDeleting) return

    try {
      setIsDeleting(true)
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', deletingProject.id)
      
      if (error) throw error
      
      setProjects(prev => prev.filter(project => project.id !== deletingProject.id))
      setDeleteingProject(null)
    } catch (err) {
      console.error('Error deleting project:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }, [deletingProject, isDeleting, supabase])

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
   * Render project card
   */
  const renderProjectCard = (project: Project) => (
    <Card 
      key={project.id}
      className={cn(
        "transition-all duration-200 hover:shadow-md cursor-pointer",
        project.isArchived && "opacity-60"
      )}
      onClick={() => onProjectSelect?.(project)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {project.color ? (
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
                aria-hidden="true"
              />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">
                {project.name}
              </CardTitle>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                setEditingProject(project)
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                handleProjectArchive(project)
              }}>
                <Archive className="h-4 w-4 mr-2" />
                {project.isArchived ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteingProject(project)
                }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {project.todoCount !== undefined && (
              <Badge variant="secondary">
                {project.todoCount} todo{project.todoCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {project.isArchived && (
              <Badge variant="outline">
                Archived
              </Badge>
            )}
          </div>
          
          {project.icon && (
            <span className="text-lg" role="img" aria-label="Project icon">
              {project.icon}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (loading && projects.length === 0) {
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
          <h2 className="text-2xl font-semibold">
            {showArchived ? 'Archived Projects' : 'Projects'}
          </h2>
          <p className="text-muted-foreground">
            {showArchived 
              ? 'Manage your archived projects'
              : 'Organize your todos with projects'
            }
          </p>
        </div>
        
        {showCreateButton && !showArchived && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
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
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 mb-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Projects grid */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Folder className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {showArchived ? 'No archived projects' : 'No projects yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {showArchived 
                ? 'You don\'t have any archived projects.'
                : 'Create your first project to start organizing your todos.'
              }
            </p>
            {showCreateButton && !showArchived && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
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
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(renderProjectCard)}
        </div>
      )}

      {/* Edit project dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <ProjectForm 
              project={editingProject}
              onSuccess={handleProjectUpdate}
              onCancel={() => setEditingProject(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(open) => !open && setDeleteingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This will also delete all todos in this project. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteingProject(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleProjectDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}