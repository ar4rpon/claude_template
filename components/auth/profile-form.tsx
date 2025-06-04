'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from './auth-provider'
import { createClient } from '@/utils/supabase/client'
import { TablesUpdate } from '@/types/database'
import { cn } from '@/lib/utils'

/**
 * Props for the ProfileForm component
 */
interface ProfileFormProps {
  /** Additional CSS classes */
  className?: string
  /** Callback function called after successful profile update */
  onSuccess?: () => void
  /** Whether to show the card wrapper */
  showCard?: boolean
}

/**
 * Form data interface for profile form
 */
interface ProfileFormData {
  displayName: string
  bio: string
  avatarUrl: string
}

/**
 * Form validation errors interface
 */
interface FormErrors {
  displayName?: string
  bio?: string
  avatarUrl?: string
  general?: string
}

/**
 * Profile form component for editing user profile information
 * 
 * Features:
 * - Display name editing
 * - Bio/description editing
 * - Avatar URL management
 * - Form validation
 * - Loading states during updates
 * - Error handling and display
 * - Accessibility features
 * - Integration with Supabase database
 * - Auto-saves changes
 * 
 * @param props - The component props
 * @returns The profile form component
 */
export function ProfileForm({ 
  className, 
  onSuccess,
  showCard = true 
}: ProfileFormProps): React.ReactElement {
  const { user, profile, refreshProfile } = useAuth()
  const supabase = createClient()
  
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: '',
    bio: '',
    avatarUrl: '',
  })
  
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      const initialData = {
        displayName: profile.display_name || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatar_url || '',
      }
      setFormData(initialData)
      setHasChanges(false)
    }
  }, [profile])

  /**
   * Validates the profile form data
   * 
   * @param data - The form data to validate
   * @returns Object containing validation errors
   */
  const validateForm = (data: ProfileFormData): FormErrors => {
    const newErrors: FormErrors = {}

    // Display name validation
    if (data.displayName.trim().length > 50) {
      newErrors.displayName = 'Display name must be 50 characters or less'
    }

    // Bio validation
    if (data.bio.length > 500) {
      newErrors.bio = 'Bio must be 500 characters or less'
    }

    // Avatar URL validation (basic URL format check)
    if (data.avatarUrl && !/^https?:\/\/.+\..+/.test(data.avatarUrl)) {
      newErrors.avatarUrl = 'Please enter a valid URL (starting with http:// or https://)'
    }

    return newErrors
  }

  /**
   * Handles input field changes and validation
   * 
   * @param field - The form field name
   * @param value - The new field value
   */
  const handleInputChange = (field: keyof ProfileFormData, value: string): void => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Check if data has changed from profile
      const originalData = {
        displayName: profile?.display_name || '',
        bio: profile?.bio || '',
        avatarUrl: profile?.avatar_url || '',
      }
      
      const dataChanged = Object.keys(newData).some(
        key => newData[key as keyof ProfileFormData] !== originalData[key as keyof ProfileFormData]
      )
      
      setHasChanges(dataChanged)
      return newData
    })
    
    // Clear errors for this field and general errors
    if (errors[field] || errors.general) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        delete newErrors.general
        return newErrors
      })
    }
  }

  /**
   * Saves the profile data to the database
   */
  const saveProfile = async (): Promise<void> => {
    if (!user?.id) {
      setErrors({ general: 'User not authenticated' })
      return
    }

    // Validate form
    const formErrors = validateForm(formData)
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      const updateData: TablesUpdate<'profiles'> = {
        display_name: formData.displayName.trim() || null,
        bio: formData.bio.trim() || null,
        avatar_url: formData.avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (error) {
        throw error
      }

      // Refresh the profile data
      await refreshProfile()
      
      setHasChanges(false)
      setLastSaved(new Date())
      onSuccess?.()
    } catch (error) {
      console.error('Profile update error:', error)
      setErrors({ 
        general: error instanceof Error ? error.message : 'Failed to update profile' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handles form submission
   * 
   * @param event - The form submission event
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    await saveProfile()
  }

  /**
   * Resets the form to the original profile data
   */
  const handleReset = (): void => {
    if (profile) {
      setFormData({
        displayName: profile.display_name || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatar_url || '',
      })
      setHasChanges(false)
      setErrors({})
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* General error message */}
      {errors.general && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md"
        >
          {errors.general}
        </div>
      )}

      {/* Last saved indicator */}
      {lastSaved && !hasChanges && (
        <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
          Profile saved at {lastSaved.toLocaleTimeString()}
        </div>
      )}

      {/* Email field (read-only) */}
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">
          Email
        </label>
        <Input
          type="email"
          value={user?.email || ''}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed from this form
        </p>
      </div>

      {/* Display name field */}
      <div className="space-y-2">
        <label
          htmlFor="display-name"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Display Name
        </label>
        <Input
          id="display-name"
          name="displayName"
          type="text"
          placeholder="Your display name"
          value={formData.displayName}
          onChange={(e) => handleInputChange('displayName', e.target.value)}
          disabled={isLoading}
          maxLength={50}
          aria-invalid={errors.displayName ? 'true' : 'false'}
          aria-describedby={errors.displayName ? 'display-name-error' : 'display-name-help'}
          className={cn(
            errors.displayName && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        {errors.displayName ? (
          <p id="display-name-error" role="alert" className="text-sm text-red-600">
            {errors.displayName}
          </p>
        ) : (
          <p id="display-name-help" className="text-xs text-muted-foreground">
            How others will see your name ({formData.displayName.length}/50)
          </p>
        )}
      </div>

      {/* Bio field */}
      <div className="space-y-2">
        <label
          htmlFor="bio"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          placeholder="Tell others about yourself..."
          value={formData.bio}
          onChange={(e) => handleInputChange('bio', e.target.value)}
          disabled={isLoading}
          maxLength={500}
          rows={4}
          aria-invalid={errors.bio ? 'true' : 'false'}
          aria-describedby={errors.bio ? 'bio-error' : 'bio-help'}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
            errors.bio && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        {errors.bio ? (
          <p id="bio-error" role="alert" className="text-sm text-red-600">
            {errors.bio}
          </p>
        ) : (
          <p id="bio-help" className="text-xs text-muted-foreground">
            A brief description about yourself ({formData.bio.length}/500)
          </p>
        )}
      </div>

      {/* Avatar URL field */}
      <div className="space-y-2">
        <label
          htmlFor="avatar-url"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Avatar URL
        </label>
        <Input
          id="avatar-url"
          name="avatarUrl"
          type="url"
          placeholder="https://example.com/your-avatar.jpg"
          value={formData.avatarUrl}
          onChange={(e) => handleInputChange('avatarUrl', e.target.value)}
          disabled={isLoading}
          aria-invalid={errors.avatarUrl ? 'true' : 'false'}
          aria-describedby={errors.avatarUrl ? 'avatar-url-error' : 'avatar-url-help'}
          className={cn(
            errors.avatarUrl && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        {errors.avatarUrl ? (
          <p id="avatar-url-error" role="alert" className="text-sm text-red-600">
            {errors.avatarUrl}
          </p>
        ) : (
          <p id="avatar-url-help" className="text-xs text-muted-foreground">
            URL to your profile picture
          </p>
        )}
      </div>

      {/* Avatar preview */}
      {formData.avatarUrl && !errors.avatarUrl && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Avatar Preview</label>
          <div className="flex items-center space-x-3">
            <img
              src={formData.avatarUrl}
              alt="Avatar preview"
              className="w-16 h-16 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                setErrors(prev => ({ ...prev, avatarUrl: 'Failed to load image from this URL' }))
              }}
            />
            <p className="text-sm text-muted-foreground">
              This is how your avatar will appear
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isLoading || !hasChanges}
          className="flex-1"
          aria-describedby={isLoading ? 'save-loading-message' : undefined}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isLoading || !hasChanges}
        >
          Reset
        </Button>
      </div>

      {/* Screen reader loading message */}
      {isLoading && (
        <div id="save-loading-message" className="sr-only" aria-live="polite">
          Saving your profile changes, please wait...
        </div>
      )}
    </form>
  )

  if (!showCard) {
    return <div className={className}>{formContent}</div>
  }

  return (
    <Card className={cn('w-full max-w-2xl mx-auto', className)}>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Update your profile information and preferences
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  )
}