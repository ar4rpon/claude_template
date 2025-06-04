# 第3章: TODO機能

この章では、データベース設定、CRUD操作、リアルタイム更新を含む、TODOアプリケーションのコア機能を実装します。

## 章の概要

**所要時間**: 3-4時間  
**難易度**: 中級

## 学習内容

- データベーススキーマの設計と作成
- 作成、読み取り、更新、削除操作の実装
- リアルタイム購読の追加
- 楽観的更新の処理
- フィルタリングとソートの実装

## 前提条件

- 第1章と第2章の完了
- 動作する認証システム
- 基本的なSQL知識があると便利

## ステップ1: データベーススキーマ設計

### TODOテーブルの作成

1. Supabaseダッシュボードに移動
2. SQLエディターに移動
3. 以下のSQLを実行してtodosテーブルを作成：

```sql
-- todosテーブルの作成
CREATE TABLE todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 行レベルセキュリティの有効化
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- ポリシーの作成
CREATE POLICY "ユーザーは自分のtodosを表示できる" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のtodosを作成できる" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のtodosを更新できる" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のtodosを削除できる" ON todos
  FOR DELETE USING (auth.uid() = user_id);

-- updated_atトリガーの作成
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

-- パフォーマンス用インデックスの作成
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_created_at ON todos(created_at DESC);
```

## ステップ2: 型定義の作成

`types/todo.ts`を作成：

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

## ステップ3: TODOコンポーネントの作成

### TODOフォームコンポーネントの作成

`app/components/TodoForm.tsx`を作成：

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
      setError('TODOを作成するにはログインが必要です')
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
      <h3 className="text-lg font-semibold text-gray-900">新しいTODOを追加</h3>
      
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          タイトル *
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="TODOのタイトルを入力"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          説明
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="TODO の説明を入力（オプション）"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '追加中...' : 'TODOを追加'}
      </button>
    </form>
  )
}
```

### TODOアイテムコンポーネントの作成

`app/components/TodoItem.tsx`を作成：

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
    if (!confirm('このTODOを削除してもよろしいですか？')) return

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
                保存
              </button>
              <button
                onClick={() => {
                  setTitle(todo.title)
                  setEditing(false)
                }}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                キャンセル
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
                作成日 {new Date(todo.created_at).toLocaleDateString()}
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
              編集
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-sm text-red-600 hover:text-red-500"
            >
              削除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

### TODOリストコンポーネントの作成

`app/components/TodoList.tsx`を作成：

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

    // リアルタイム購読の設定
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
        <p className="text-gray-500">TODOを読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <p className="text-sm text-gray-700">
          {activeTodoCount} 件のアクティブ、{todos.length} 件の合計
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
            すべて
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'active'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            アクティブ
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'completed'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            完了済み
          </button>
        </div>
      </div>

      {filteredTodos.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {filter === 'all'
              ? 'まだTODOがありません。最初のTODOを作成しましょう！'
              : `${filter === 'active' ? 'アクティブ' : '完了済み'}のTODOはありません。`}
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

## ステップ4: ダッシュボードページの更新

`app/dashboard/page.tsx`を更新：

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

## ステップ5: TODO機能のテスト

1. **TODOの作成**:
   - 異なるタイトルと説明を持つ複数のTODOを追加
   - リストに即座に表示されることを確認

2. **TODOの更新**:
   - 編集をクリックしてTODOタイトルを変更
   - 完了状態を切り替え
   - リフレッシュ後も変更が保持されることを確認

3. **TODOの削除**:
   - TODOを削除してアクションを確認
   - リストから削除されることを確認

4. **TODOのフィルタ**:
   - 完了済みとアクティブなTODOの両方を作成
   - 3つのフィルターオプションすべてをテスト

5. **リアルタイム更新**:
   - 同じユーザーでログインした2つのブラウザーウィンドウを開く
   - 片方のウィンドウでTODOを作成/更新/削除
   - もう片方のウィンドウに変更が表示されることを確認

## チェックポイント質問

1. 行レベルセキュリティポリシーはどのようにユーザーデータを保護しますか？
2. リアルタイム更新をトリガーするものは何ですか？
3. より良いUXのために楽観的更新を使用するのはなぜですか？
4. フィルター状態管理はどのように機能しますか？

## トラブルシューティング

### よくある問題

1. **TODOが表示されない**:
   - RLSポリシーが有効になっていることを確認
   - ユーザーが認証されていることを確認
   - ブラウザーコンソールでエラーを確認

2. **リアルタイム更新が機能しない**:
   - SupabaseのRealtimeがテーブルで有効になっていることを確認
   - ブラウザーのネットワークタブでWebSocket接続を確認

3. **TODOを作成/更新/削除できない**:
   - RLSポリシーが提供されたSQLと一致することを確認
   - ユーザー認証状態を確認

## まとめ

素晴らしい作業でした！以下を実装しました：
- ✅ RLSポリシー付きデータベーススキーマ
- ✅ TODOの完全なCRUD操作
- ✅ リアルタイム同期
- ✅ フィルタリング機能
- ✅ 楽観的UI更新

## 次のステップ

[第4章](../chapter-04/README_JA.md)では、以下によってUI/UXを改良します：
- アニメーションとトランジションの追加
- ダークモードの実装
- レスポンシブデザインの作成
- キーボードショートカットの追加
- アクセシビリティの改善

## 追加リソース

- [Supabase Database ドキュメント](https://supabase.com/docs/guides/database)
- [行レベルセキュリティガイド](https://supabase.com/docs/guides/auth/row-level-security)
- [リアルタイム購読](https://supabase.com/docs/guides/realtime)
- [PostgreSQL ドキュメント](https://www.postgresql.org/docs/)