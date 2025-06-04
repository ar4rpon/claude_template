'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { Tables } from '@/types/database'

/**
 * Type definition for the authentication context value
 */
interface AuthContextType {
  /** Current authenticated user */
  user: User | null
  /** Current session */
  session: Session | null
  /** User profile data from the database */
  profile: Tables<'profiles'> | null
  /** Loading state for authentication */
  loading: boolean
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  /** Sign up with email and password */
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  /** Sign out the current user */
  signOut: () => Promise<{ error: Error | null }>
  /** Refresh the user profile data */
  refreshProfile: () => Promise<void>
}

/**
 * Authentication context for managing global auth state
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Props for the AuthProvider component
 */
interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * Authentication provider component that manages auth state and provides
 * authentication methods to child components
 * 
 * @param props - The component props
 * @returns The provider component with authentication context
 */
export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  /**
   * Fetches the user profile from the database
   * 
   * @param userId - The ID of the user to fetch profile for
   */
  const fetchProfile = async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Unexpected error fetching profile:', error)
    }
  }

  /**
   * Refreshes the user profile data from the database
   */
  const refreshProfile = async (): Promise<void> => {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }

  /**
   * Signs in a user with email and password
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise with potential error
   */
  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error }
      }

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Signs up a new user with email and password
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise with potential error
   */
  const signUp = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        return { error }
      }

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Signs out the current user
   * 
   * @returns Promise with potential error
   */
  const signOut = async (): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        return { error }
      }

      setUser(null)
      setSession(null)
      setProfile(null)

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Set up auth state listener
  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async (): Promise<void> => {
      const { data: { session: initialSession } } = await supabase.auth.getSession()
      
      if (mounted) {
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id)
        }
        
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return

        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user) {
          await fetchProfile(newSession.user.id)
        } else {
          setProfile(null)
        }

        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to use the authentication context
 * 
 * @returns The authentication context value
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}