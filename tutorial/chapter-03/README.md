# Chapter 3: TODO Features

In this chapter, we'll implement the core functionality of our TODO application, including database setup, CRUD operations, and real-time updates.

## Chapter Overview

**Duration**: 3-4 hours  
**Difficulty**: Intermediate

## What You'll Learn

- Design and create database schema
- Implement Create, Read, Update, Delete operations
- Add real-time subscriptions
- Handle optimistic updates
- Implement filtering and sorting

## Prerequisites

- Completed Chapters 1 and 2
- Working authentication system
- Basic SQL knowledge helpful

## Step 1: Database Schema Design

### Create the TODOs Table

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run this SQL to create the todos table:

```sql
-- Create todos table
CREATE TABLE todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own todos" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own todos" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos" ON todos
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_created_at ON todos(created_at DESC);
```

## Step 2: Create Type Definitions

Create `types/todo.ts`:

```typescript
export interface Todo {
  id: string
  user_id: string
  title: string
  description?: string
  completed: boolean
  created_at: string
  updated_at: string
}

export interface CreateTodoInput {
  title: string
  description?: string
}

export interface UpdateTodoInput {
  title?: string
  description?: string
  completed?: boolean
}
```

## Step 3: Create TODO Components

### Create TODO Form Component

Create `app/components/TodoForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CreateTodoInput } from '@/types/todo'

interface TodoFormProps {
  onSuccess?: () => void
}

export default function TodoForm({ onSuccess }: TodoFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const todoData: CreateTodoInput = {
      title: title.trim(),
      description: description.trim() || undefined,
    }

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('You must be logged in to create todos')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('todos')
      .insert({
        ...todoData,
        user_id: user.id,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      setTitle('')
      setDescription('')
      setLoading(false)
      onSuccess?.()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900">Add New TODO</h3>
      
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title *
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Enter TODO title"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Enter TODO description (optional)"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding...' : 'Add TODO'}
      </button>
    </form>
  )
}
```

### Create TODO Item Component

Create `app/components/TodoItem.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Todo } from '@/types/todo'

interface TodoItemProps {
  todo: Todo
  onUpdate?: () => void
  onDelete?: () => void
}

export default function TodoItem({ todo, onUpdate, onDelete }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleToggleComplete = async () => {
    setLoading(true)
    const { error } = await supabase
      .from('todos')
      .update({ completed: !todo.completed })
      .eq('id', todo.id)

    if (!error) {
      onUpdate?.()
    }
    setLoading(false)
  }

  const handleUpdate = async () => {
    if (title.trim() === todo.title) {
      setEditing(false)
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('todos')
      .update({ title: title.trim() })
      .eq('id', todo.id)

    if (!error) {
      setEditing(false)
      onUpdate?.()
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this TODO?')) return

    setLoading(true)
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', todo.id)

    if (!error) {
      onDelete?.()
    }
    setLoading(false)
  }

  return (
    <div className={`bg-white p-4 rounded-lg shadow ${loading ? 'opacity-50' : ''}`}>
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={handleToggleComplete}
          disabled={loading}
          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        
        <div className="flex-1">
          {editing ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdate()
                  if (e.key === 'Escape') {
                    setTitle(todo.title)
                    setEditing(false)
                  }
                }}
                className="flex-1 text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTitle(todo.title)
                  setEditing(false)
                }}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div>
              <h3 
                className={`text-sm font-medium text-gray-900 ${
                  todo.completed ? 'line-through text-gray-500' : ''
                }`}
              >
                {todo.title}
              </h3>
              {todo.description && (
                <p className="mt-1 text-sm text-gray-500">{todo.description}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Created {new Date(todo.created_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setEditing(true)}
              disabled={loading}
              className="text-sm text-gray-600 hover:text-gray-500"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-sm text-red-600 hover:text-red-500"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Create TODO List Component

Create `app/components/TodoList.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Todo } from '@/types/todo'
import TodoItem from './TodoItem'

interface TodoListProps {
  refreshTrigger?: number
}

export default function TodoList({ refreshTrigger }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const supabase = createClient()

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTodos(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTodos()

    // Set up real-time subscription
    const channel = supabase
      .channel('todos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
        },
        () => {
          fetchTodos()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshTrigger])

  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const activeTodoCount = todos.filter((t) => !t.completed).length

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading todos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <p className="text-sm text-gray-700">
          {activeTodoCount} active, {todos.length} total
        </p>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'active'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'completed'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {filteredTodos.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No todos yet. Create your first one!'
              : `No ${filter} todos.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onUpdate={fetchTodos}
              onDelete={fetchTodos}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

## Step 4: Update Dashboard Page

Update `app/dashboard/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import TodoForm from '@/app/components/TodoForm'
import TodoList from '@/app/components/TodoList'

export default function DashboardPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleTodoAdded = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-1">
        <TodoForm onSuccess={handleTodoAdded} />
      </div>
      <div className="md:col-span-2">
        <TodoList refreshTrigger={refreshTrigger} />
      </div>
    </div>
  )
}
```

## Step 5: Test TODO Features

1. **Create TODOs**:
   - Add multiple TODOs with different titles and descriptions
   - Verify they appear in the list immediately

2. **Update TODOs**:
   - Click Edit and modify a TODO title
   - Toggle completion status
   - Verify changes persist after refresh

3. **Delete TODOs**:
   - Delete a TODO and confirm the action
   - Verify it's removed from the list

4. **Filter TODOs**:
   - Create both completed and active TODOs
   - Test all three filter options

5. **Real-time Updates**:
   - Open two browser windows logged in as the same user
   - Create/update/delete TODOs in one window
   - Verify changes appear in the other window

## Checkpoint Questions

1. How do Row Level Security policies protect user data?
2. What triggers the real-time updates?
3. Why do we use optimistic updates for better UX?
4. How does the filter state management work?

## Troubleshooting

### Common Issues

1. **TODOs not showing up**:
   - Check RLS policies are enabled
   - Verify user is authenticated
   - Check browser console for errors

2. **Real-time updates not working**:
   - Ensure Supabase Realtime is enabled for the table
   - Check WebSocket connection in browser network tab

3. **Cannot create/update/delete TODOs**:
   - Verify RLS policies match the SQL provided
   - Check user authentication status

## Summary

Excellent work! You've implemented:
- ✅ Database schema with RLS policies
- ✅ Full CRUD operations for TODOs
- ✅ Real-time synchronization
- ✅ Filtering functionality
- ✅ Optimistic UI updates

## What's Next?

In [Chapter 4](../chapter-04/README.md), we'll enhance the UI/UX by:
- Adding animations and transitions
- Implementing dark mode
- Creating a responsive design
- Adding keyboard shortcuts
- Improving accessibility

## Additional Resources

- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)