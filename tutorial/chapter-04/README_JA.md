# 第4章: UI/UX改良

この章では、機能的なTODOアプリを美しく、レスポンシブで、アクセシブルなアプリケーションに変換し、モダンなUIパターンと素晴らしいユーザーエクスペリエンスを実現します。

## 章の概要

**所要時間**: 2-3時間  
**難易度**: 中級

## 学習内容

- レスポンシブデザインパターンの実装
- スムーズなアニメーションとトランジションの追加
- ダークモードトグルの作成
- アクセシビリティの改善
- キーボードショートカットの追加
- ローディングとエラー状態の実装

## 前提条件

- 第1〜3章の完了
- 動作するTODO機能
- 基本的なCSS知識

## ステップ1: UI依存関係のインストール

アニメーションとアイコン用の追加依存関係をインストール：

```bash
npm install framer-motion lucide-react
npm install -D @types/node
```

## ステップ2: テーマコンテキストの作成

`app/contexts/ThemeContext.tsx`を作成：

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
```

## ステップ3: Tailwind設定の更新

`tailwind.config.ts`を更新：

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

## ステップ4: グローバルスタイルの更新

`app/globals.css`を更新：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

@layer components {
  .btn-primary {
    @apply bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600;
  }

  .btn-secondary {
    @apply bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600;
  }

  .input-field {
    @apply border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400;
  }
}

body {
  transition: background-color 0.3s ease;
}
```

## ステップ5: 改良されたコンポーネントの作成

### ローディングスピナーの作成

`app/components/LoadingSpinner.tsx`を作成：

```typescript
export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  return (
    <div className="flex justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400`}
      />
    </div>
  )
}
```

### アニメーション付きTODOフォームの更新

`app/components/TodoForm.tsx`を更新：

```typescript
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CreateTodoInput } from '@/types/todo'
import LoadingSpinner from './LoadingSpinner'

interface TodoFormProps {
  onSuccess?: () => void
}

export default function TodoForm({ onSuccess }: TodoFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
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
      setIsExpanded(false)
      setLoading(false)
      onSuccess?.()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-gray-900/30"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        新しいTODOを追加
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2 rounded-md bg-red-50 dark:bg-red-900/20 p-3"
          >
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </motion.div>
        )}

        <div>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            className="w-full px-4 py-2 rounded-lg input-field transition-all"
            placeholder="何をする必要がありますか？"
          />
        </div>

        <motion.div
          initial={false}
          animate={{ height: isExpanded ? 'auto' : 0 }}
          className="overflow-hidden"
        >
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 rounded-lg input-field transition-all resize-none"
            placeholder="説明を追加（オプション）"
          />
        </motion.div>

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>TODOを追加</span>
            </>
          )}
        </button>
      </form>
    </motion.div>
  )
}
```

### アニメーション付きTODOアイテムの更新

`app/components/TodoItem.tsx`を更新：

```typescript
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Edit2, Trash2, Save } from 'lucide-react'
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
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm dark:shadow-gray-900/30 transition-all hover:shadow-md ${
        loading ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start space-x-3">
        <button
          onClick={handleToggleComplete}
          disabled={loading}
          className={`mt-1 h-5 w-5 rounded border-2 transition-all ${
            todo.completed
              ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
          }`}
        >
          <AnimatePresence>
            {todo.completed && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center justify-center text-white"
              >
                <Check className="h-3 w-3" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
        
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {editing ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center space-x-2"
              >
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
                  className="flex-1 px-2 py-1 text-sm rounded input-field"
                  autoFocus
                />
                <button
                  onClick={handleUpdate}
                  disabled={loading}
                  className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setTitle(todo.title)
                    setEditing(false)
                  }}
                  className="p-1 text-gray-600 hover:text-gray-700 dark:text-gray-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <motion.div key="viewing">
                <h3 
                  className={`text-sm font-medium transition-all ${
                    todo.completed 
                      ? 'line-through text-gray-500 dark:text-gray-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {todo.title}
                </h3>
                {todo.description && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {todo.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  作成日 {new Date(todo.created_at).toLocaleDateString()}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!editing && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setEditing(true)}
              disabled={loading}
              className="p-1 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
```

### テーマトグル付きダッシュボードレイアウトの更新

`app/dashboard/layout.tsx`を更新：

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Moon, Sun, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'
import { useTheme } from '@/app/contexts/ThemeContext'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <nav className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                TODOダッシュボード
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user.email}
              </span>
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                aria-label="テーマを切り替え"
              >
                <motion.div
                  key={theme}
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {theme === 'light' ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                </motion.div>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
```

### ルートレイアウトの更新

`app/layout.tsx`を更新：

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/app/contexts/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TODOアプリ",
  description: "Next.jsとSupabaseで構築されたモダンなTODOアプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

## ステップ6: キーボードショートカットの追加

`app/hooks/useKeyboardShortcuts.ts`を作成：

```typescript
import { useEffect } from 'react'

interface Shortcut {
  key: string
  ctrlKey?: boolean
  callback: () => void
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach(({ key, ctrlKey, callback }) => {
        if (
          e.key === key &&
          (ctrlKey === undefined || e.ctrlKey === ctrlKey)
        ) {
          e.preventDefault()
          callback()
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
```

## ステップ7: レスポンシブデザインの追加

TodoListコンポーネントをレスポンシブに更新：

```typescript
// TodoList.tsxで、フィルターボタンセクションを更新:
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
  <p className="text-sm text-gray-700 dark:text-gray-300">
    {activeTodoCount} 件のアクティブ、{todos.length} 件の合計
  </p>
  <div className="flex space-x-2 justify-center sm:justify-end">
    {/* フィルターボタンは同じまま */}
  </div>
</div>
```

## ステップ8: すべての機能のテスト

1. **テーマトグル**:
   - 月/太陽アイコンをクリック
   - テーマ間のスムーズなトランジションを確認
   - リフレッシュ時のテーマ持続性を確認

2. **アニメーション**:
   - 新しいTODOを追加してフェードインアニメーションを観察
   - 完了状態の切り替えでスムーズなトランジションを確認
   - アイテムを削除してフェードアウト効果を確認

3. **レスポンシブデザイン**:
   - ブラウザーウィンドウをリサイズ
   - モバイルデバイスでテスト
   - レイアウトが適切に適応することを確認

4. **アクセシビリティ**:
   - キーボードのみでナビゲート
   - スクリーンリーダーでテスト
   - 適切なARIAラベルを確認

## チェックポイント質問

1. ダークモードの持続性はどのように機能しますか？
2. アニメーションをパフォーマンス良くするものは何ですか？
3. CSSアニメーションではなくFramer Motionを使用する理由は何ですか？
4. キーボードショートカットはどのようにUXを改善しますか？

## まとめ

素晴らしい作業でした！TODOアプリを以下で改良しました：
- ✅ 美しいアニメーションとトランジション
- ✅ ダークモードサポート
- ✅ レスポンシブデザイン
- ✅ アクセシビリティの改善
- ✅ モダンなUIコンポーネント
- ✅ より良いローディングとエラー状態

## 次のステップ

[第5章](../chapter-05/README_JA.md)では、以下によってアプリを完成させます：
- 包括的なテストの記述
- CI/CDパイプラインの設定
- Vercelへのデプロイ
- パフォーマンス監視の追加

## 追加リソース

- [Framer Motion ドキュメント](https://www.framer.com/motion/)
- [Tailwind CSS ダークモード](https://tailwindcss.com/docs/dark-mode)
- [Webアクセシビリティガイドライン](https://www.w3.org/WAI/WCAG21/quickref/)
- [レスポンシブデザインのベストプラクティス](https://web.dev/responsive-web-design-basics/)