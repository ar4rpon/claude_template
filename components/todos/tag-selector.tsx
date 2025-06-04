'use client'

import * as React from 'react'
import { Check, Plus, X } from 'lucide-react'
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
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import type { Tag } from '@/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'

interface TagSelectorProps {
  /** Selected tag IDs */
  value: string[]
  /** Callback when tag selection changes */
  onValueChange: (tagIds: string[]) => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Maximum number of tags that can be selected */
  maxTags?: number
  /** Custom class name */
  className?: string
}

/**
 * TagSelector component provides a multi-select interface for choosing tags
 * with the ability to create new tags inline. Supports search, filtering,
 * and real-time updates.
 * 
 * Features:
 * - Multi-select with search functionality
 * - Create new tags inline with color selection
 * - Tag color indicators
 * - Real-time updates via Supabase subscriptions
 * - Keyboard navigation and accessibility
 * - Maximum tag limit enforcement
 * - Selected tag display with removal
 * 
 * @param value - Array of selected tag IDs
 * @param onValueChange - Callback when tag selection changes
 * @param disabled - Whether the selector is disabled
 * @param placeholder - Placeholder text for empty selection
 * @param maxTags - Maximum number of tags that can be selected
 * @param className - Additional CSS classes
 */
export function TagSelector({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select tags",
  maxTags,
  className
}: TagSelectorProps) {
  const supabase = createClientComponentClient()
  
  // State management
  const [tags, setTags] = React.useState<Tag[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [isOpen, setIsOpen] = React.useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState('')
  const [newTagColor, setNewTagColor] = React.useState('#3b82f6')
  const [isCreating, setIsCreating] = React.useState(false)

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
   * Create a new tag
   */
  const handleCreateTag = React.useCallback(async () => {
    if (!newTagName.trim() || isCreating) return

    try {
      setIsCreating(true)
      
      const { data, error } = await supabase
        .from('tags')
        .insert([{
          name: newTagName.trim(),
          color: newTagColor
        }])
        .select()
        .single()
      
      if (error) throw error
      
      const newTag: Tag = { ...data, usageCount: 0 }
      setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)))
      
      // Auto-select the new tag
      onValueChange([...value, newTag.id])
      
      // Reset form
      setNewTagName('')
      setNewTagColor('#3b82f6')
      setIsCreateDialogOpen(false)
    } catch (err) {
      console.error('Error creating tag:', err)
    } finally {
      setIsCreating(false)
    }
  }, [newTagName, newTagColor, onValueChange, value, supabase, isCreating])

  /**
   * Handle tag selection
   */
  const handleTagToggle = React.useCallback((tagId: string) => {
    const isSelected = value.includes(tagId)
    
    if (isSelected) {
      onValueChange(value.filter(id => id !== tagId))
    } else {
      if (maxTags && value.length >= maxTags) {
        return // Don't add if max limit reached
      }
      onValueChange([...value, tagId])
    }
  }, [value, onValueChange, maxTags])

  /**
   * Remove a selected tag
   */
  const handleRemoveTag = React.useCallback((tagId: string) => {
    onValueChange(value.filter(id => id !== tagId))
  }, [value, onValueChange])

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
   * Get selected tags
   */
  const selectedTags = React.useMemo(() => {
    return tags.filter(tag => value.includes(tag.id))
  }, [tags, value])

  /**
   * Check if tag creation is possible
   */
  const canCreateTag = React.useMemo(() => {
    if (!newTagName.trim()) return false
    
    // Check if tag already exists
    const exists = tags.some(tag => 
      tag.name.toLowerCase() === newTagName.trim().toLowerCase()
    )
    
    return !exists
  }, [newTagName, tags])

  /**
   * Render tag option with color and usage count
   */
  const renderTagOption = (tag: Tag, isSelected: boolean) => (
    <div className="flex items-center gap-2 w-full">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => handleTagToggle(tag.id)}
        disabled={disabled || (!isSelected && maxTags && value.length >= maxTags)}
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {tag.color && (
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: tag.color }}
            aria-hidden="true"
          />
        )}
        <span className="flex-1 truncate">{tag.name}</span>
        {tag.usageCount !== undefined && tag.usageCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {tag.usageCount}
          </Badge>
        )}
      </div>
    </div>
  )

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Error loading tags: {error}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
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
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={disabled}
                className="ml-1 hover:bg-white/20 rounded-sm"
                aria-label={`Remove ${tag.name} tag`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag selector */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            disabled={disabled || loading}
          >
            {loading ? (
              "Loading tags..."
            ) : selectedTags.length > 0 ? (
              `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected`
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 space-y-3">
            {/* Search input */}
            <Input
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
            />

            {/* Tag list */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredTags.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {searchTerm ? 'No tags found' : 'No tags available'}
                </div>
              ) : (
                filteredTags.map((tag) => {
                  const isSelected = value.includes(tag.id)
                  const isDisabled = disabled || (!isSelected && maxTags && value.length >= maxTags)
                  
                  return (
                    <div
                      key={tag.id}
                      className={cn(
                        "flex items-center space-x-2 rounded-sm p-2 cursor-pointer hover:bg-accent",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => !isDisabled && handleTagToggle(tag.id)}
                    >
                      {renderTagOption(tag, isSelected)}
                    </div>
                  )
                })
              )}
            </div>

            {/* Create tag button */}
            <div className="border-t pt-3">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full" disabled={disabled}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create new tag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Tag</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="tagName" className="text-sm font-medium">
                        Tag Name
                      </label>
                      <Input
                        id="tagName"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Enter tag name"
                        disabled={isCreating}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="tagColor" className="text-sm font-medium">
                        Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="tagColor"
                          type="color"
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          disabled={isCreating}
                          className="w-12 h-8 rounded border"
                        />
                        <span className="text-sm text-muted-foreground">
                          {newTagColor}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTag}
                      disabled={!canCreateTag || isCreating}
                    >
                      {isCreating ? 'Creating...' : 'Create Tag'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Max tags warning */}
            {maxTags && value.length >= maxTags && (
              <div className="text-xs text-muted-foreground text-center">
                Maximum {maxTags} tag{maxTags > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}