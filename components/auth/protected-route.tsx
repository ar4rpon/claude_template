'use client'

import React from 'react'
import { useAuth } from './auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Props for the ProtectedRoute component
 */
interface ProtectedRouteProps {
  /** Child components to render when authenticated */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Custom loading component */
  loadingComponent?: React.ReactNode
  /** Custom unauthenticated component */
  unauthenticatedComponent?: React.ReactNode
  /** Callback function called when user needs to sign in */
  onSignInRequired?: () => void
  /** Whether to redirect to sign in automatically */
  redirectToSignIn?: boolean
  /** Minimum role required (for future role-based access) */
  requiredRole?: string
  /** Custom fallback message */
  fallbackMessage?: string
}

/**
 * Loading spinner component
 */
function LoadingSpinner(): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

/**
 * Default unauthenticated component
 */
interface UnauthenticatedFallbackProps {
  onSignInRequired?: () => void
  message?: string
}

function UnauthenticatedFallback({ 
  onSignInRequired, 
  message 
}: UnauthenticatedFallbackProps): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-primary" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          <CardTitle className="text-xl font-semibold">Authentication Required</CardTitle>
          <CardDescription>
            {message || 'You need to sign in to access this content.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Please sign in to your account to continue.
          </p>
          
          {onSignInRequired && (
            <Button onClick={onSignInRequired} className="w-full">
              Sign In
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Protected route component that requires authentication
 * 
 * This component wraps child components and only renders them if the user
 * is authenticated. It provides loading states and customizable fallbacks
 * for unauthenticated users.
 * 
 * Features:
 * - Authentication state checking
 * - Loading states during auth verification
 * - Customizable unauthenticated fallback
 * - Support for role-based access (future enhancement)
 * - Accessibility features with proper ARIA labels
 * - Integration with the auth context
 * 
 * @param props - The component props
 * @returns The protected content or appropriate fallback
 */
export function ProtectedRoute({
  children,
  className,
  loadingComponent,
  unauthenticatedComponent,
  onSignInRequired,
  redirectToSignIn = false,
  requiredRole,
  fallbackMessage,
}: ProtectedRouteProps): React.ReactElement {
  const { user, loading, profile } = useAuth()

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className={cn('w-full', className)} role="status" aria-label="Loading authentication status">
        {loadingComponent || <LoadingSpinner />}
      </div>
    )
  }

  // Check if user is authenticated
  if (!user) {
    // Handle redirect to sign in if specified
    if (redirectToSignIn && onSignInRequired) {
      // Call the sign in handler immediately
      React.useEffect(() => {
        onSignInRequired()
      }, [onSignInRequired])
    }

    return (
      <div className={cn('w-full', className)} role="main" aria-label="Authentication required">
        {unauthenticatedComponent || (
          <UnauthenticatedFallback 
            onSignInRequired={onSignInRequired}
            message={fallbackMessage}
          />
        )}
      </div>
    )
  }

  // Future enhancement: Role-based access control
  if (requiredRole && profile) {
    // This is a placeholder for future role-based access control
    // You would implement role checking logic here based on your needs
    // For example:
    // if (!hasRequiredRole(profile, requiredRole)) {
    //   return <UnauthorizedComponent />
    // }
  }

  // User is authenticated - render protected content
  return (
    <div className={cn('w-full', className)} role="main">
      {children}
    </div>
  )
}

/**
 * Hook for checking authentication status
 * 
 * This hook provides a simple way to check if a user is authenticated
 * without requiring the full ProtectedRoute component.
 * 
 * @returns Object with authentication status and user info
 */
export function useAuthStatus(): {
  isAuthenticated: boolean
  isLoading: boolean
  user: ReturnType<typeof useAuth>['user']
  profile: ReturnType<typeof useAuth>['profile']
} {
  const { user, loading, profile } = useAuth()

  return {
    isAuthenticated: !!user,
    isLoading: loading,
    user,
    profile,
  }
}

/**
 * Higher-order component for protecting routes
 * 
 * This HOC wraps a component with authentication protection.
 * Useful for protecting entire page components.
 * 
 * @param Component - The component to protect
 * @param options - Protection options
 * @returns Protected component
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
): React.ComponentType<P> {
  const ProtectedComponent = (props: P): React.ReactElement => {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    )
  }

  // Set display name for debugging
  ProtectedComponent.displayName = `withAuth(${Component.displayName || Component.name})`

  return ProtectedComponent
}