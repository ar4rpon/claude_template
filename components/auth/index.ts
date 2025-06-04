/**
 * Authentication components module
 * 
 * This module provides a comprehensive set of authentication components
 * for building secure applications with Supabase authentication.
 * 
 * @example
 * ```tsx
 * import { AuthProvider, LoginForm, ProtectedRoute } from '@/components/auth'
 * 
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <ProtectedRoute>
 *         <Dashboard />
 *       </ProtectedRoute>
 *     </AuthProvider>
 *   )
 * }
 * ```
 */

// Core authentication provider
export { AuthProvider, useAuth } from './auth-provider'

// Form components
export { LoginForm } from './login-form'
export { SignupForm } from './signup-form'
export { ProfileForm } from './profile-form'

// Route protection
export { 
  ProtectedRoute, 
  useAuthStatus, 
  withAuth 
} from './protected-route'

// Re-export types that might be useful for consumers
export type { User, Session } from '@supabase/supabase-js'
export type { Tables } from '@/types/database'