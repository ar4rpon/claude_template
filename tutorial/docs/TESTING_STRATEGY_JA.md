# テスト戦略ドキュメント

このコンプリヘンシブガイドでは、TODOアプリケーションの品質と信頼性を確保するためのテスト戦略、ベストプラクティス、実装詳細について説明します。

## 目次

1. [テスト哲学](#テスト哲学)
2. [テストピラミッド](#テストピラミッド)
3. [ユニットテスト](#ユニットテスト)
4. [統合テスト](#統合テスト)
5. [エンドツーエンドテスト](#エンドツーエンドテスト)
6. [パフォーマンステスト](#パフォーマンステスト)
7. [セキュリティテスト](#セキュリティテスト)
8. [テストベストプラクティス](#テストベストプラクティス)

## テスト哲学

### 基本原則

1. **実装ではなく振る舞いをテスト**: コードがどのように動作するかに焦点を当て、どのように実装されているかではない
2. **テストの独立性を維持**: 各テストは独立して実行されるべき
3. **テストをシンプルに保つ**: 1つのテストは1つのことを検証するべき
4. **高速フィードバック**: テストは頻繁な実行を促すために素早く実行されるべき
5. **包括的カバレッジ**: 品質を犠牲にすることなく高いカバレッジを目指す

### テストの目標

- **信頼性**: テストはコードが動作することに対する信頼を与えるべき
- **ドキュメント**: テストは生きたドキュメントとして機能する
- **リグレッション防止**: バグが本番環境に到達する前にキャッチする
- **設計フィードバック**: テストしにくいコードは設計上の問題を示すことが多い

## テストピラミッド

```
         /\
        /  \    E2Eテスト (10%)
       /----\   - 重要なユーザージャーニー
      /      \  - クロスブラウザテスト
     /--------\ 統合テスト (30%)
    /          \- APIテスト
   /            \- コンポーネント統合
  /--------------\ ユニットテスト (60%)
 /                \- ビジネスロジック
/                  \- ユーティリティ関数
```

## ユニットテスト

### コンポーネントテスト

```typescript
// TodoForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoForm } from '@/components/TodoForm'
import { createClient } from '@/utils/supabase/client'

// 依存関係をモック
jest.mock('@/utils/supabase/client')
const mockSupabase = createClient as jest.MockedFunction<typeof createClient>

describe('TodoForm', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks()
    
    // デフォルトのモック動作を設定
    mockSupabase.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } }
        })
      },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      })
    } as any)
  })

  describe('レンダリング', () => {
    it('すべてのフォーム要素をレンダリングする', () => {
      render(<TodoForm />)
      
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add todo/i })).toBeInTheDocument()
    })

    it('送信中にローディング状態を表示する', async () => {
      render(<TodoForm />)
      
      await user.type(screen.getByLabelText(/title/i), 'Test TODO')
      await user.click(screen.getByRole('button', { name: /add todo/i }))
      
      expect(screen.getByText(/adding/i)).toBeInTheDocument()
    })
  })

  describe('バリデーション', () => {
    it('タイトルフィールドを必須にする', async () => {
      render(<TodoForm />)
      
      const submitButton = screen.getByRole('button', { name: /add todo/i })
      expect(submitButton).toBeDisabled()
      
      await user.type(screen.getByLabelText(/title/i), 'Test')
      expect(submitButton).toBeEnabled()
    })

    it('入力から空白をトリムする', async () => {
      const onSuccess = jest.fn()
      render(<TodoForm onSuccess={onSuccess} />)
      
      await user.type(screen.getByLabelText(/title/i), '  Test TODO  ')
      await user.type(screen.getByLabelText(/description/i), '  Description  ')
      await user.click(screen.getByRole('button', { name: /add todo/i }))
      
      await waitFor(() => {
        expect(mockSupabase().from).toHaveBeenCalledWith('todos')
        const insertCall = mockSupabase().from('todos').insert
        expect(insertCall).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test TODO',
            description: 'Description'
          })
        )
      })
    })
  })

  describe('エラーハンドリング', () => {
    it('サーバーエラーを表示する', async () => {
      mockSupabase().from('todos').insert.mockResolvedValue({
        error: { message: 'Database error' }
      })
      
      render(<TodoForm />)
      
      await user.type(screen.getByLabelText(/title/i), 'Test TODO')
      await user.click(screen.getByRole('button', { name: /add todo/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/database error/i)).toBeInTheDocument()
      })
    })

    it('認証エラーを処理する', async () => {
      mockSupabase().auth.getUser.mockResolvedValue({
        data: { user: null }
      })
      
      render(<TodoForm />)
      
      await user.type(screen.getByLabelText(/title/i), 'Test TODO')
      await user.click(screen.getByRole('button', { name: /add todo/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/must be logged in/i)).toBeInTheDocument()
      })
    })
  })
})
```

### フックテスト

```typescript
// useDebounce.test.ts
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  jest.useFakeTimers()

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('初期値を即座に返す', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('値の更新をデバウンスする', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    // 値を更新
    rerender({ value: 'updated', delay: 500 })
    
    // 値は即座に変更されるべきではない
    expect(result.current).toBe('initial')
    
    // 時間を進める
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    // 値が更新されているべき
    expect(result.current).toBe('updated')
  })

  it('アンマウント時に保留中の更新をキャンセルする', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })
    unmount()
    
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    // エラーが発生すべきではない
    expect(true).toBe(true)
  })
})
```

### ユーティリティ関数テスト

```typescript
// validation.test.ts
import { 
  validateEmail, 
  validatePassword, 
  sanitizeInput,
  formatDate 
} from '@/utils/validation'

describe('バリデーションユーティリティ', () => {
  describe('validateEmail', () => {
    it.each([
      ['user@example.com', true],
      ['user.name@example.co.uk', true],
      ['user+tag@example.com', true],
      ['invalid.email', false],
      ['@example.com', false],
      ['user@', false],
      ['', false],
    ])('validateEmail(%s) は %s を返すべき', (email, expected) => {
      expect(validateEmail(email)).toBe(expected)
    })
  })

  describe('validatePassword', () => {
    it('最小長を強制する', () => {
      expect(validatePassword('short')).toContain('8 characters')
      expect(validatePassword('longenough')).not.toContain('8 characters')
    })

    it('大文字を要求する', () => {
      expect(validatePassword('lowercase123!')).toContain('uppercase')
      expect(validatePassword('Uppercase123!')).not.toContain('uppercase')
    })

    it('特殊文字を要求する', () => {
      expect(validatePassword('NoSpecial123')).toContain('special')
      expect(validatePassword('Special123!')).not.toContain('special')
    })
  })

  describe('sanitizeInput', () => {
    it('危険な文字を削除する', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script')
      expect(sanitizeInput('normal text')).toBe('normal text')
    })

    it('空白をトリムする', () => {
      expect(sanitizeInput('  text  ')).toBe('text')
    })
  })

  describe('formatDate', () => {
    it('日付を正しくフォーマットする', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      expect(formatDate(date)).toBe('Jan 15, 2024')
      expect(formatDate(date, 'time')).toBe('10:30 AM')
      expect(formatDate(date, 'full')).toBe('January 15, 2024 at 10:30 AM')
    })

    it('無効な日付を処理する', () => {
      expect(formatDate('invalid')).toBe('Invalid Date')
    })
  })
})
```

## 統合テスト

### API統合テスト

```typescript
// api.integration.test.ts
import { createClient } from '@/utils/supabase/client'
import { Todo } from '@/types/todo'

describe('TODO API統合', () => {
  let supabase: ReturnType<typeof createClient>
  let testUser: any
  let createdTodos: string[] = []

  beforeAll(async () => {
    supabase = createClient()
    
    // テストユーザーを作成
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!'
    })
    
    if (error) throw error
    testUser = data.user
  })

  afterEach(async () => {
    // 作成されたTODOをクリーンアップ
    if (createdTodos.length > 0) {
      await supabase.from('todos').delete().in('id', createdTodos)
      createdTodos = []
    }
  })

  afterAll(async () => {
    // テストユーザーをクリーンアップ
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id)
    }
  })

  describe('CRUD操作', () => {
    it('新しいTODOを作成する', async () => {
      const newTodo = {
        title: '統合テストTODO',
        description: 'APIをテスト中',
        user_id: testUser.id
      }

      const { data, error } = await supabase
        .from('todos')
        .insert(newTodo)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toMatchObject({
        title: newTodo.title,
        description: newTodo.description,
        completed: false
      })
      
      createdTodos.push(data.id)
    })

    it('TODOを更新する', async () => {
      // まずTODOを作成
      const { data: todo } = await supabase
        .from('todos')
        .insert({ title: '更新テスト', user_id: testUser.id })
        .select()
        .single()
      
      createdTodos.push(todo.id)

      // 更新
      const { data: updated, error } = await supabase
        .from('todos')
        .update({ completed: true })
        .eq('id', todo.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated.completed).toBe(true)
    })

    it('行レベルセキュリティを強制する', async () => {
      // 他のユーザーのTODOを作成（失敗するべき）
      const { error } = await supabase
        .from('todos')
        .insert({
          title: '無認可TODO',
          user_id: 'different-user-id'
        })

      expect(error).not.toBeNull()
      expect(error.message).toContain('security')
    })
  })

  describe('リアルタイムサブスクリプション', () => {
    it('リアルタイム更新を受信する', (done) => {
      const channel = supabase
        .channel('test-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'todos',
            filter: `user_id=eq.${testUser.id}`
          },
          (payload) => {
            expect(payload.new).toMatchObject({
              title: 'リアルタイムテスト'
            })
            channel.unsubscribe()
            done()
          }
        )
        .subscribe()

      // サブスクリプションをトリガーするためにTODOを挿入
      setTimeout(async () => {
        const { data } = await supabase
          .from('todos')
          .insert({
            title: 'リアルタイムテスト',
            user_id: testUser.id
          })
          .select()
          .single()
        
        createdTodos.push(data.id)
      }, 100)
    })
  })
})
```

### コンポーネント統合テスト

```typescript
// TodoList.integration.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoList } from '@/components/TodoList'
import { TodoProvider } from '@/contexts/TodoContext'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client')

describe('TodoList統合', () => {
  const mockTodos = [
    {
      id: '1',
      title: '最初のTODO',
      completed: false,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      title: '2番目のTODO',
      completed: true,
      created_at: '2024-01-02T00:00:00Z'
    }
  ]

  beforeEach(() => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockTodos, error: null })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      }),
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn()
      })
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  it('TODOをレンダリングしてフィルタリングする', async () => {
    const user = userEvent.setup()
    
    render(
      <TodoProvider>
        <TodoList />
      </TodoProvider>
    )

    // TODOがロードされるまで待機
    await waitFor(() => {
      expect(screen.getByText('最初のTODO')).toBeInTheDocument()
      expect(screen.getByText('2番目のTODO')).toBeInTheDocument()
    })

    // フィルタリングをテスト
    await user.click(screen.getByRole('button', { name: /active/i }))
    
    expect(screen.getByText('最初のTODO')).toBeInTheDocument()
    expect(screen.queryByText('2番目のTODO')).not.toBeInTheDocument()

    // 完了フィルターをテスト
    await user.click(screen.getByRole('button', { name: /completed/i }))
    
    expect(screen.queryByText('最初のTODO')).not.toBeInTheDocument()
    expect(screen.getByText('2番目のTODO')).toBeInTheDocument()
  })

  it('TODOのインタラクションを処理する', async () => {
    const user = userEvent.setup()
    
    render(
      <TodoProvider>
        <TodoList />
      </TodoProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('最初のTODO')).toBeInTheDocument()
    })

    // 完了状態をトグル
    const firstTodo = screen.getByText('最初のTODO').closest('[role="article"]')!
    const checkbox = within(firstTodo).getByRole('checkbox')
    
    await user.click(checkbox)
    
    await waitFor(() => {
      expect(createClient().from('todos').update).toHaveBeenCalledWith({
        completed: true
      })
    })
  })
})
```

## エンドツーエンドテスト

### Playwright設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

### E2Eテストの例

```typescript
// e2e/todo-journey.spec.ts
import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser } from './helpers'

test.describe('TODOユーザージャーニー', () => {
  let testEmail: string
  let testPassword: string

  test.beforeEach(async ({ page }) => {
    // ユニークなテストユーザーを作成
    const user = await createTestUser()
    testEmail = user.email
    testPassword = user.password
    
    // ログイン
    await page.goto('/login')
    await page.fill('[name="email"]', testEmail)
    await page.fill('[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    
    // ダッシュボードを待機
    await expect(page).toHaveURL('/dashboard')
  })

  test.afterEach(async () => {
    await deleteTestUser(testEmail)
  })

  test('完全なTODOワークフロー', async ({ page }) => {
    // 新しいTODOを作成
    await page.fill('[placeholder="What needs to be done?"]', 'E2EテストTODO')
    await page.fill('[placeholder*="description"]', 'これはテスト説明です')
    await page.click('button:has-text("Add TODO")')
    
    // TODOが表示されることを確認
    const todoItem = page.locator('article').filter({ hasText: 'E2EテストTODO' })
    await expect(todoItem).toBeVisible()
    
    // TODOを編集
    await todoItem.locator('button:has-text("Edit")').click()
    await todoItem.locator('input[type="text"]').fill('更新されたE2EテストTODO')
    await todoItem.locator('button:has-text("Save")').click()
    
    // 更新を確認
    await expect(todoItem).toContainText('更新されたE2EテストTODO')
    
    // TODOを完了
    await todoItem.locator('input[type="checkbox"]').check()
    await expect(todoItem).toHaveClass(/line-through/)
    
    // 完了したTODOをフィルタ
    await page.click('button:has-text("Completed")')
    await expect(todoItem).toBeVisible()
    
    // TODOを削除
    await todoItem.locator('button:has-text("Delete")').click()
    await page.click('button:has-text("Confirm")')
    
    // 削除を確認
    await expect(todoItem).not.toBeVisible()
  })

  test('レスポンシブデザイン', async ({ page, viewport }) => {
    // モバイルビューポートをテスト
    await page.setViewportSize({ width: 375, height: 667 })
    
    // モバイルメニューを確認
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
    
    // レイアウト適応を確認
    const todoForm = page.locator('[data-testid="todo-form"]')
    await expect(todoForm).toHaveCSS('width', '100%')
    
    // デスクトップビューポートをテスト
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    // デスクトップレイアウトを確認
    await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible()
    await expect(todoForm).toHaveCSS('max-width', '400px')
  })

  test('ダークモードトグル', async ({ page }) => {
    // 初期ライトモードを確認
    await expect(page.locator('html')).not.toHaveClass('dark')
    
    // ダークモードをトグル
    await page.click('[aria-label="Toggle theme"]')
    
    // ダークモードを確認
    await expect(page.locator('html')).toHaveClass('dark')
    
    // リロード時の永続化を確認
    await page.reload()
    await expect(page.locator('html')).toHaveClass('dark')
  })

  test('キーボードナビゲーション', async ({ page }) => {
    // 複数のTODOを作成
    for (let i = 1; i <= 3; i++) {
      await page.fill('[placeholder="What needs to be done?"]', `TODO ${i}`)
      await page.keyboard.press('Enter')
    }
    
    // Tabでナビゲート
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('type', 'checkbox')
    
    // Spaceでトグル
    await page.keyboard.press('Space')
    const firstCheckbox = page.locator('input[type="checkbox"]').first()
    await expect(firstCheckbox).toBeChecked()
    
    // 編集ボタンに移動
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveText('Edit')
    
    // Enterで編集モードを開く
    await page.keyboard.press('Enter')
    await expect(page.locator('input[type="text"]:focus')).toBeVisible()
  })
})
```

### ビジュアルリグレッションテスト

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test'

test.describe('ビジュアルリグレッション', () => {
  test('ダッシュボードの外観', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // スクリーンショットを取得
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      animations: 'disabled'
    })
  })

  test('コンポーネントの状態', async ({ page }) => {
    await page.goto('/dashboard')
    
    // 通常状態
    const todoItem = page.locator('article').first()
    await expect(todoItem).toHaveScreenshot('todo-item-normal.png')
    
    // ホバー状態
    await todoItem.hover()
    await expect(todoItem).toHaveScreenshot('todo-item-hover.png')
    
    // 完了状態
    await todoItem.locator('input[type="checkbox"]').check()
    await expect(todoItem).toHaveScreenshot('todo-item-completed.png')
  })
})
```

## パフォーマンステスト

### k6による負荷テスト

```javascript
// k6/load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '2m', target: 10 },  // 10ユーザーまでランプアップ
    { duration: '5m', target: 10 },  // 10ユーザーを維持
    { duration: '2m', target: 50 },  // 50ユーザーまでランプアップ
    { duration: '5m', target: 50 },  // 50ユーザーを維持
    { duration: '2m', target: 0 },   // 0ユーザーまでランプダウン
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%のリクエストが500ms未満
    errors: ['rate<0.1'],             // エラー率10%未満
  },
}

export default function () {
  const BASE_URL = 'https://your-app.com'
  
  // ログイン
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'password123',
  })
  
  check(loginRes, {
    'ログイン成功': (r) => r.status === 200,
    '認証トークンを受信': (r) => r.json('token') !== '',
  })
  
  errorRate.add(loginRes.status !== 200)
  
  const authToken = loginRes.json('token')
  const headers = { Authorization: `Bearer ${authToken}` }
  
  // TODOを取得
  const todosRes = http.get(`${BASE_URL}/api/todos`, { headers })
  
  check(todosRes, {
    'TODO取得完了': (r) => r.status === 200,
    'TODOが配列': (r) => Array.isArray(r.json()),
  })
  
  errorRate.add(todosRes.status !== 200)
  
  // TODO作成
  const createRes = http.post(
    `${BASE_URL}/api/todos`,
    JSON.stringify({
      title: 'パフォーマンステストTODO',
      description: 'k6によって作成',
    }),
    { headers }
  )
  
  check(createRes, {
    'TODO作成完了': (r) => r.status === 201,
    'TODO IDあり': (r) => r.json('id') !== '',
  })
  
  errorRate.add(createRes.status !== 201)
  
  sleep(1)
}
```

### フロントエンドパフォーマンステスト

```typescript
// performance/web-vitals.test.ts
import { test, expect } from '@playwright/test'

test.describe('パフォーマンスメトリクス', () => {
  test('Core Web Vitalsを測定', async ({ page }) => {
    // ページにナビゲート
    await page.goto('/dashboard')
    
    // LCP（Largest Contentful Paint）を測定
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          resolve(lastEntry.startTime)
        }).observe({ entryTypes: ['largest-contentful-paint'] })
      })
    })
    
    expect(lcp).toBeLessThan(2500) // 良いLCPは2.5秒未満
    
    // FID（First Input Delay）を測定
    await page.click('button:has-text("Add TODO")')
    const fid = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          resolve(entries[0].processingStart - entries[0].startTime)
        }).observe({ entryTypes: ['first-input'] })
      })
    })
    
    expect(fid).toBeLessThan(100) // 良いFIDは100ms未満
    
    // CLS（Cumulative Layout Shift）を測定
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          }
          resolve(clsValue)
        }).observe({ entryTypes: ['layout-shift'] })
        
        // レイアウトシフトを引き起こす可能性のあるアクションをトリガー
        setTimeout(() => resolve(clsValue), 5000)
      })
    })
    
    expect(cls).toBeLessThan(0.1) // 良いCLSは0.1未満
  })

  test('バンドルサイズ分析', async ({ page }) => {
    const coverage = await page.coverage.startJSCoverage()
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    const jsCoverage = await page.coverage.stopJSCoverage()
    
    let totalBytes = 0
    let usedBytes = 0
    
    for (const entry of jsCoverage) {
      totalBytes += entry.text.length
      usedBytes += entry.ranges.reduce(
        (sum, range) => sum + range.end - range.start,
        0
      )
    }
    
    const unusedPercentage = ((totalBytes - usedBytes) / totalBytes) * 100
    
    console.log(`総JS: ${totalBytes} バイト`)
    console.log(`使用済みJS: ${usedBytes} バイト`)
    console.log(`未使用JS: ${unusedPercentage.toFixed(2)}%`)
    
    expect(unusedPercentage).toBeLessThan(50) // 未使用が50%未満
  })
})
```

## セキュリティテスト

### セキュリティテストスイート

```typescript
// security/security.test.ts
import { test, expect } from '@playwright/test'

test.describe('セキュリティテスト', () => {
  test('XSS防止', async ({ page }) => {
    await page.goto('/dashboard')
    
    // スクリプトの注入を試行
    const xssPayload = '<script>alert("XSS")</script>'
    await page.fill('[placeholder="What needs to be done?"]', xssPayload)
    await page.click('button:has-text("Add TODO")')
    
    // スクリプトが実行されないことを確認
    const alertFired = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.alert = () => resolve(true)
        setTimeout(() => resolve(false), 1000)
      })
    })
    
    expect(alertFired).toBe(false)
    
    // コンテンツがエスケープされていることを確認
    const todoText = await page.textContent('article')
    expect(todoText).not.toContain('<script>')
    expect(todoText).toContain('&lt;script&gt;')
  })

  test('CSRF保護', async ({ page, request }) => {
    // CSRFトークンなしでリクエストを試行
    const response = await request.post('/api/todos', {
      data: { title: 'CSRFテスト' },
      headers: {
        'Origin': 'https://evil-site.com'
      }
    })
    
    expect(response.status()).toBe(403)
  })

  test('SQLインジェクション防止', async ({ page }) => {
    await page.goto('/dashboard')
    
    // 検索でSQLインジェクションを試行
    const sqlPayload = "'; DROP TABLE todos; --"
    await page.fill('[placeholder="Search todos"]', sqlPayload)
    await page.keyboard.press('Enter')
    
    // アプリがまだ動作することを確認
    await page.reload()
    await expect(page.locator('article')).toBeVisible()
  })

  test('認証が必要', async ({ page }) => {
    // 認証なしで保護されたルートにアクセスを試行
    await page.goto('/dashboard')
    
    // ログインにリダイレクトされるべき
    await expect(page).toHaveURL('/login')
  })

  test('レート制限', async ({ page, request }) => {
    const attempts = []
    
    // 短時間で多くのリクエストを作成
    for (let i = 0; i < 20; i++) {
      attempts.push(
        request.post('/api/auth/login', {
          data: {
            email: 'test@example.com',
            password: 'wrong-password'
          }
        })
      )
    }
    
    const responses = await Promise.all(attempts)
    const tooManyRequests = responses.filter(r => r.status() === 429)
    
    expect(tooManyRequests.length).toBeGreaterThan(0)
  })
})
```

### 依存関係スキャニング

```json
// package.json スクリプト
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "deps:check": "npm-check-updates",
    "deps:update": "npm-check-updates -u",
    "security:scan": "snyk test"
  }
}
```

## テストベストプラクティス

### 1. テスト構造

```typescript
// AAAパターンに従う
test('何かをするべき', () => {
  // Arrange（準備）
  const input = 'test'
  const expected = 'TEST'
  
  // Act（実行）
  const result = toUpperCase(input)
  
  // Assert（検証）
  expect(result).toBe(expected)
})
```

### 2. テストデータ管理

```typescript
// factories/todo.factory.ts
import { faker } from '@faker-js/faker'
import { Todo } from '@/types/todo'

export const todoFactory = {
  build: (overrides?: Partial<Todo>): Todo => ({
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    completed: faker.datatype.boolean(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    user_id: faker.string.uuid(),
    ...overrides
  }),
  
  buildList: (count: number, overrides?: Partial<Todo>): Todo[] => {
    return Array.from({ length: count }, () => todoFactory.build(overrides))
  }
}
```

### 3. カスタムマッチャー

```typescript
// test-utils/custom-matchers.ts
expect.extend({
  toBeValidTodo(received) {
    const pass = 
      received &&
      typeof received.id === 'string' &&
      typeof received.title === 'string' &&
      typeof received.completed === 'boolean'
    
    return {
      pass,
      message: () => 
        pass
          ? `${received} が有効なTODOではないことを期待`
          : `${received} が有効なTODOであることを期待`
    }
  }
})

// 使用法
expect(todo).toBeValidTodo()
```

### 4. テストユーティリティ

```typescript
// test-utils/render.tsx
import { render as rtlRender } from '@testing-library/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { TodoProvider } from '@/contexts/TodoContext'

function render(ui: React.ReactElement, options = {}) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider>
        <TodoProvider>
          {children}
        </TodoProvider>
      </ThemeProvider>
    )
  }
  
  return rtlRender(ui, { wrapper: Wrapper, ...options })
}

export * from '@testing-library/react'
export { render }
```

### 5. テストチェックリスト

コードをプッシュする前に確認すること：

- [ ] すべてのテストがローカルで合格
- [ ] 新機能に対応するテストがある
- [ ] エッジケースがカバーされている
- [ ] エラー状態がテストされている
- [ ] ローディング状態がテストされている
- [ ] アクセシビリティテストが合格
- [ ] パフォーマンスベンチマークが満たされている
- [ ] セキュリティテストが合格
- [ ] テストでコンソールエラーがない
- [ ] テストカバレッジが閾値を満たしている

## まとめ

包括的なテスト戦略には以下が含まれます：

1. **ユニットテスト**: 個別コンポーネントのための高速で集中的なテスト
2. **統合テスト**: コンポーネント間の連携を検証
3. **E2Eテスト**: 重要なユーザージャーニーを検証
4. **パフォーマンステスト**: アプリが速度要件を満たすことを確認
5. **セキュリティテスト**: 一般的な脆弱性に対する保護を検証

記憶しておくべきこと：
- コード後ではなく、コード中にテストを書く
- プロダクションコードと同じくらい丁寧にテストを維持
- ドキュメントとしてテストを使用
- カバレッジではなく信頼性を重視
- テストをシンプルで読みやすく保つ

さらなるリソース：
- [Testing Library ドキュメント](https://testing-library.com/)
- [Jest ドキュメント](https://jestjs.io/)
- [Playwright ドキュメント](https://playwright.dev/)
- [k6 ドキュメント](https://k6.io/docs/)