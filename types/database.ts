export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string | null
          icon: string | null
          is_archived: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          color?: string | null
          icon?: string | null
          is_archived?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          color?: string | null
          icon?: string | null
          is_archived?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      todos: {
        Row: {
          id: string
          user_id: string
          project_id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'done' | 'cancelled'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          due_date: string | null
          scheduled_date: string | null
          completed_at: string | null
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          due_date?: string | null
          scheduled_date?: string | null
          completed_at?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          due_date?: string | null
          scheduled_date?: string | null
          completed_at?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      todo_tags: {
        Row: {
          todo_id: string
          tag_id: string
        }
        Insert: {
          todo_id: string
          tag_id: string
        }
        Update: {
          todo_id?: string
          tag_id?: string
        }
      }
      todo_attachments: {
        Row: {
          id: string
          todo_id: string
          file_name: string
          file_url: string
          file_size: number | null
          mime_type: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          todo_id: string
          file_name: string
          file_url: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          todo_id?: string
          file_name?: string
          file_url?: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      todo_status: 'todo' | 'in_progress' | 'done' | 'cancelled'
      todo_priority: 'low' | 'medium' | 'high' | 'urgent'
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']