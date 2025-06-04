'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from './auth-provider'
import { cn } from '@/lib/utils'

/**
 * Props for the LoginForm component
 */
interface LoginFormProps {
  /** Additional CSS classes */
  className?: string
  /** Callback function called after successful login */
  onSuccess?: () => void
  /** Callback function called when switching to signup */
  onSwitchToSignup?: () => void
}

/**
 * Form data interface for login form
 */
interface LoginFormData {
  email: string
  password: string
}

/**
 * Form validation errors interface
 */
interface FormErrors {
  email?: string
  password?: string
  general?: string
}

/**
 * Login form component with email/password authentication
 * 
 * Features:
 * - Email and password validation
 * - Loading states during authentication
 * - Error handling and display
 * - Accessibility features
 * - Integration with Supabase authentication
 * 
 * @param props - The component props
 * @returns The login form component
 */
export function LoginForm({ 
  className, 
  onSuccess, 
  onSwitchToSignup 
}: LoginFormProps): React.ReactElement {
  const { signIn } = useAuth()
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  })
  
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  /**
   * Validates the login form data
   * 
   * @param data - The form data to validate
   * @returns Object containing validation errors
   */
  const validateForm = (data: LoginFormData): FormErrors => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!data.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!data.password) {
      newErrors.password = 'Password is required'
    } else if (data.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    return newErrors
  }

  /**
   * Handles input field changes and clears related errors
   * 
   * @param field - The form field name
   * @param value - The new field value
   */
  const handleInputChange = (field: keyof LoginFormData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
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
   * Handles form submission
   * 
   * @param event - The form submission event
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    
    // Validate form
    const formErrors = validateForm(formData)
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      const { error } = await signIn(formData.email, formData.password)

      if (error) {
        // Handle specific authentication errors
        if (error.message.includes('Invalid login credentials')) {
          setErrors({ general: 'Invalid email or password. Please try again.' })
        } else if (error.message.includes('Email not confirmed')) {
          setErrors({ general: 'Please check your email and confirm your account before signing in.' })
        } else if (error.message.includes('Too many requests')) {
          setErrors({ general: 'Too many login attempts. Please try again later.' })
        } else {
          setErrors({ general: error.message || 'An error occurred during sign in' })
        }
      } else {
        // Success - call the success callback if provided
        onSuccess?.()
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred. Please try again.' })
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
        <CardDescription>
          Enter your email and password to access your account
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

          {/* Email field */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isLoading}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={cn(
                errors.email && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isLoading}
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className={cn(
                errors.password && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            {errors.password && (
              <p id="password-error" role="alert" className="text-sm text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            aria-describedby={isLoading ? 'loading-message' : undefined}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </Button>

          {/* Screen reader loading message */}
          {isLoading && (
            <div id="loading-message" className="sr-only" aria-live="polite">
              Signing in, please wait...
            </div>
          )}

          {/* Switch to signup */}
          {onSwitchToSignup && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={onSwitchToSignup}
                  disabled={isLoading}
                >
                  Sign up here
                </Button>
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}