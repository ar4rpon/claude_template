'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from './auth-provider'
import { cn } from '@/lib/utils'

/**
 * Props for the SignupForm component
 */
interface SignupFormProps {
  /** Additional CSS classes */
  className?: string
  /** Callback function called after successful signup */
  onSuccess?: () => void
  /** Callback function called when switching to login */
  onSwitchToLogin?: () => void
}

/**
 * Form data interface for signup form
 */
interface SignupFormData {
  email: string
  password: string
  confirmPassword: string
}

/**
 * Form validation errors interface
 */
interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  general?: string
}

/**
 * Signup form component with email/password registration
 * 
 * Features:
 * - Email and password validation
 * - Password confirmation validation
 * - Password strength requirements
 * - Loading states during registration
 * - Error handling and display
 * - Accessibility features
 * - Integration with Supabase authentication
 * 
 * @param props - The component props
 * @returns The signup form component
 */
export function SignupForm({ 
  className, 
  onSuccess, 
  onSwitchToLogin 
}: SignupFormProps): React.ReactElement {
  const { signUp } = useAuth()
  
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    password: '',
    confirmPassword: '',
  })
  
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  /**
   * Validates the signup form data
   * 
   * @param data - The form data to validate
   * @returns Object containing validation errors
   */
  const validateForm = (data: SignupFormData): FormErrors => {
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
    } else if (data.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
      newErrors.password = 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    }

    // Confirm password validation
    if (!data.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (data.password !== data.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    return newErrors
  }

  /**
   * Handles input field changes and clears related errors
   * 
   * @param field - The form field name
   * @param value - The new field value
   */
  const handleInputChange = (field: keyof SignupFormData, value: string): void => {
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
   * Gets password strength indicator
   * 
   * @param password - The password to check
   * @returns Object with strength level and color
   */
  const getPasswordStrength = (password: string): { level: string; color: string; width: string } => {
    if (password.length === 0) {
      return { level: '', color: '', width: '0%' }
    }
    
    let score = 0
    
    // Length check
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/\d/.test(password)) score += 1
    if (/[^a-zA-Z\d]/.test(password)) score += 1
    
    if (score <= 2) {
      return { level: 'Weak', color: 'bg-red-500', width: '33%' }
    } else if (score <= 4) {
      return { level: 'Medium', color: 'bg-yellow-500', width: '66%' }
    } else {
      return { level: 'Strong', color: 'bg-green-500', width: '100%' }
    }
  }

  const passwordStrength = getPasswordStrength(formData.password)

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
      const { error } = await signUp(formData.email, formData.password)

      if (error) {
        // Handle specific registration errors
        if (error.message.includes('User already registered')) {
          setErrors({ email: 'An account with this email already exists' })
        } else if (error.message.includes('Password should be at least')) {
          setErrors({ password: error.message })
        } else if (error.message.includes('Unable to validate email')) {
          setErrors({ email: 'Please enter a valid email address' })
        } else {
          setErrors({ general: error.message || 'An error occurred during sign up' })
        }
      } else {
        // Success - show confirmation message
        setShowSuccessMessage(true)
        // Call the success callback after a short delay
        setTimeout(() => {
          onSuccess?.()
        }, 2000)
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred. Please try again.' })
      console.error('Signup error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Show success message after signup
  if (showSuccessMessage) {
    return (
      <Card className={cn('w-full max-w-md mx-auto', className)}>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-green-600">Account Created!</CardTitle>
          <CardDescription>
            Please check your email to confirm your account before signing in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            We've sent a confirmation email to <strong>{formData.email}</strong>
          </p>
          {onSwitchToLogin && (
            <Button variant="outline" onClick={onSwitchToLogin} className="w-full">
              Back to Sign In
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <CardDescription>
          Enter your information to create a new account
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
              htmlFor="signup-email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email
            </label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isLoading}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'signup-email-error' : undefined}
              className={cn(
                errors.email && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            {errors.email && (
              <p id="signup-email-error" role="alert" className="text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label
              htmlFor="signup-password"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Password
            </label>
            <Input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isLoading}
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={
                errors.password 
                  ? 'signup-password-error' 
                  : formData.password 
                  ? 'password-strength' 
                  : undefined
              }
              className={cn(
                errors.password && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            
            {/* Password strength indicator */}
            {formData.password && !errors.password && (
              <div id="password-strength" className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Password strength:</span>
                  <span className={cn(
                    passwordStrength.level === 'Weak' && 'text-red-600',
                    passwordStrength.level === 'Medium' && 'text-yellow-600',
                    passwordStrength.level === 'Strong' && 'text-green-600'
                  )}>
                    {passwordStrength.level}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className={cn('h-1 rounded-full transition-all', passwordStrength.color)}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
              </div>
            )}
            
            {errors.password && (
              <p id="signup-password-error" role="alert" className="text-sm text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm password field */}
          <div className="space-y-2">
            <label
              htmlFor="confirm-password"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Confirm Password
            </label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              disabled={isLoading}
              aria-invalid={errors.confirmPassword ? 'true' : 'false'}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              className={cn(
                errors.confirmPassword && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            {errors.confirmPassword && (
              <p id="confirm-password-error" role="alert" className="text-sm text-red-600">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            aria-describedby={isLoading ? 'signup-loading-message' : undefined}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>

          {/* Screen reader loading message */}
          {isLoading && (
            <div id="signup-loading-message" className="sr-only" aria-live="polite">
              Creating your account, please wait...
            </div>
          )}

          {/* Switch to login */}
          {onSwitchToLogin && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={onSwitchToLogin}
                  disabled={isLoading}
                >
                  Sign in here
                </Button>
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}