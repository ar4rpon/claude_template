# 第5章: テストとデプロイ

この最終章では、包括的なテストの実装とVercelへのCI/CDパイプラインでのデプロイにより、TODOアプリがプロダクション準備完了であることを確認します。

## 章の概要

**所要時間**: 2-3時間  
**難易度**: 中級〜上級

## 学習内容

- テスト環境の設定
- ユニットテストと統合テストの記述
- E2Eテストの基本実装
- Vercelへのデプロイ
- CI/CD用GitHub Actionsの設定
- アプリケーションパフォーマンスの監視

## 前提条件

- 第1〜4章の完了
- GitHubアカウント
- Vercelアカウント

## ステップ1: テスト環境の設定

テスト依存関係をインストール：

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
npm install -D @types/jest
```

`jest.config.js`を作成：

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/layout.tsx',
    '!app/**/page.tsx',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

`jest.setup.js`を作成：

```javascript
import '@testing-library/jest-dom'

// Next.jsルーターのモック
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  usePathname() {
    return ''
  },
}))

// Supabaseクライアントのモック
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
  })),
}))
```

`package.json`のスクリプトを更新：

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## ステップ2: ユニットテストの記述

### TODOフォームコンポーネントのテスト

`app/components/__tests__/TodoForm.test.tsx`を作成：

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TodoForm from '../TodoForm'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client')

describe('TodoForm', () => {
  const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
  const mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } }
      }),
    },
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  }

  beforeEach(() => {
    mockCreateClient.mockReturnValue(mockSupabase as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('フォーム要素を正しくレンダリングする', () => {
    render(<TodoForm />)
    
    expect(screen.getByText('新しいTODOを追加')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('何をする必要がありますか？')).toBeInTheDocument()
    expect(screen.getByText('TODOを追加')).toBeInTheDocument()
  })

  it('タイトルがフォーカスされたときに説明フィールドを表示する', async () => {
    const user = userEvent.setup()
    render(<TodoForm />)
    
    const titleInput = screen.getByPlaceholderText('何をする必要がありますか？')
    await user.click(titleInput)
    
    expect(screen.getByPlaceholderText('説明を追加（オプション）')).toBeInTheDocument()
  })

  it('有効なデータでフォームを送信する', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    render(<TodoForm onSuccess={onSuccess} />)
    
    const titleInput = screen.getByPlaceholderText('何をする必要がありますか？')
    await user.type(titleInput, 'テストTODO')
    
    const submitButton = screen.getByText('TODOを追加')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('送信失敗時にエラーメッセージを表示する', async () => {
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({
        error: { message: '挿入に失敗しました' }
      }),
    } as any)
    
    const user = userEvent.setup()
    render(<TodoForm />)
    
    const titleInput = screen.getByPlaceholderText('何をする必要がありますか？')
    await user.type(titleInput, 'テストTODO')
    
    const submitButton = screen.getByText('TODOを追加')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('挿入に失敗しました')).toBeInTheDocument()
    })
  })

  it('タイトルが空の場合は送信ボタンを無効にする', () => {
    render(<TodoForm />)
    
    const submitButton = screen.getByText('TODOを追加')
    expect(submitButton).toBeDisabled()
  })
})
```

### TODOアイテムコンポーネントのテスト

`app/components/__tests__/TodoItem.test.tsx`を作成：

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TodoItem from '../TodoItem'
import { Todo } from '@/types/todo'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client')

describe('TodoItem', () => {
  const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
  const mockSupabase = {
    from: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    })),
  }

  const mockTodo: Todo = {
    id: 'test-id',
    user_id: 'test-user-id',
    title: 'テストTODO',
    description: 'テスト説明',
    completed: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    mockCreateClient.mockReturnValue(mockSupabase as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('TODOアイテムを正しくレンダリングする', () => {
    render(<TodoItem todo={mockTodo} />)
    
    expect(screen.getByText('テストTODO')).toBeInTheDocument()
    expect(screen.getByText('テスト説明')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('完了状態を切り替える', async () => {
    const onUpdate = jest.fn()
    render(<TodoItem todo={mockTodo} onUpdate={onUpdate} />)
    
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onUpdate).toHaveBeenCalled()
    })
  })

  it('編集ボタンクリック時に編集モードに入る', async () => {
    const user = userEvent.setup()
    render(<TodoItem todo={mockTodo} />)
    
    const editButton = screen.getByText('編集')
    await user.click(editButton)
    
    expect(screen.getByDisplayValue('テストTODO')).toBeInTheDocument()
    expect(screen.getByText('保存')).toBeInTheDocument()
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('編集されたタイトルを保存する', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    render(<TodoItem todo={mockTodo} onUpdate={onUpdate} />)
    
    const editButton = screen.getByText('編集')
    await user.click(editButton)
    
    const input = screen.getByDisplayValue('テストTODO')
    await user.clear(input)
    await user.type(input, '更新されたTODO')
    
    const saveButton = screen.getByText('保存')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onUpdate).toHaveBeenCalled()
    })
  })

  it('TODOアイテムを削除する', async () => {
    const onDelete = jest.fn()
    window.confirm = jest.fn().mockReturnValue(true)
    
    const user = userEvent.setup()
    render(<TodoItem todo={mockTodo} onDelete={onDelete} />)
    
    const deleteButton = screen.getByText('削除')
    await user.click(deleteButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onDelete).toHaveBeenCalled()
    })
  })
})
```

## ステップ3: 統合テスト

`app/__tests__/integration/todo-flow.test.tsx`を作成：

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardPage from '@/app/dashboard/page'

describe('TODO フロー統合テスト', () => {
  it('完全なTODOワークフローを完了する', async () => {
    const user = userEvent.setup()
    render(<DashboardPage />)
    
    // コンポーネントの読み込みを待つ
    await waitFor(() => {
      expect(screen.getByText('新しいTODOを追加')).toBeInTheDocument()
    })
    
    // 新しいTODOを追加
    const titleInput = screen.getByPlaceholderText('何をする必要がありますか？')
    await user.type(titleInput, '統合テストTODO')
    
    const addButton = screen.getByText('TODOを追加')
    await user.click(addButton)
    
    // リストにTODOが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText('統合テストTODO')).toBeInTheDocument()
    })
    
    // 完了状態にする
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    
    // 完了状態を確認
    await waitFor(() => {
      expect(checkbox).toBeChecked()
    })
  })
})
```

## ステップ4: デプロイ準備

### 環境変数設定の作成

`.env.example`を作成：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### .gitignoreの更新

以下が`.gitignore`に含まれていることを確認：

```
# ローカル環境ファイル
.env*.local

# テスト
/coverage
```

## ステップ5: Vercelへのデプロイ

1. **GitHubにプッシュ**：
   ```bash
   git add .
   git commit -m "Complete TODO app with testing"
   git push origin main
   ```

2. **Vercelに接続**：
   - [vercel.com](https://vercel.com)に移動
   - 「New Project」をクリック
   - GitHubリポジトリをインポート
   - 環境変数を設定：
     - `NEXT_PUBLIC_SUPABASE_URL`を追加
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`を追加
   - 「Deploy」をクリック

## ステップ6: GitHub ActionsでのCI/CDの設定

`.github/workflows/ci.yml`を作成：

```yaml
name: CI/CD パイプライン

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Node.jsの設定
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: 依存関係のインストール
        run: npm ci
      
      - name: リンターの実行
        run: npm run lint
      
      - name: テストの実行
        run: npm test -- --coverage
      
      - name: カバレッジレポートのアップロード
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
      
      - name: アプリケーションのビルド
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Vercelへデプロイ
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### GitHubシークレットの設定

1. Vercelトークンを取得：
   - Vercel CLIをインストール：`npm i -g vercel`
   - `vercel login`を実行
   - プロジェクトで`vercel link`を実行
   - `.vercel/project.json`からトークンを取得

2. GitHubリポジトリシークレットに追加：
   - Settings → Secrets → Actionsに移動
   - `VERCEL_TOKEN`を追加（Vercelアカウント設定から）
   - `VERCEL_ORG_ID`を追加（`.vercel/project.json`から）
   - `VERCEL_PROJECT_ID`を追加（`.vercel/project.json`から）

## ステップ7: パフォーマンス監視

### Web Vitals監視の追加

`app/components/WebVitals.tsx`を作成：

```typescript
'use client'

import { useEffect } from 'react'
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals'

export function WebVitals() {
  useEffect(() => {
    onCLS(console.log)
    onFID(console.log)
    onFCP(console.log)
    onLCP(console.log)
    onTTFB(console.log)
  }, [])

  return null
}
```

`app/layout.tsx`に追加：

```typescript
import { WebVitals } from '@/app/components/WebVitals'

// bodyタグ内
<body className={inter.className}>
  <WebVitals />
  <ThemeProvider>{children}</ThemeProvider>
</body>
```

### エラー監視の設定（オプション）

プロダクションアプリには以下の追加を検討：
- エラー追跡のためのSentry
- パフォーマンス監視のためのVercel Analytics
- セッション再生のためのLogRocket

## ステップ8: プロダクションチェックリスト

本番稼働前に確認：

- [ ] すべてのテストが通る
- [ ] 環境変数がVercelで設定済み
- [ ] データベースに適切なインデックスがある
- [ ] RLSポリシーが正しく設定されている
- [ ] エラーバウンダリが実装されている
- [ ] ローディング状態がエッジケースを処理している
- [ ] フォームに適切なバリデーションがある
- [ ] SEOメタタグが設定されている
- [ ] セキュリティヘッダーが設定されている
- [ ] パフォーマンス予算が満たされている

## チェックポイント質問

1. ユニットテストと統合テストの違いは何ですか？
2. CI/CDパイプラインはどのようにコード品質を保証しますか？
3. 他のCIツールではなくGitHub Actionsを使用する理由は何ですか？
4. プロダクションで監視すべきメトリクスは何ですか？

## トラブルシューティング

### よくあるデプロイ問題

1. **Vercelでのビルド失敗**：
   - 特定のエラーのビルドログを確認
   - すべての依存関係が`package.json`にあることを確認
   - 環境変数が設定されていることを確認

2. **CIでテストが失敗**：
   - まずローカルでテストを実行
   - 環境固有の問題を確認
   - モックが適切に設定されていることを確認

3. **Supabase接続の問題**：
   - 環境変数を確認
   - Supabaseプロジェクトがアクティブであることを確認
   - CORS設定を確認

## まとめ

おめでとうございます！以下を正常に完了しました：
- ✅ 包括的なテストの設定
- ✅ ユニットテストと統合テストの記述
- ✅ Vercelでのプロダクションデプロイ
- ✅ CI/CDパイプラインの実装
- ✅ パフォーマンス監視の追加

## 達成したこと

このチュートリアルを通じて、以下を含む完全なプロダクション対応TODOアプリケーションを構築しました：

1. **モダンな技術スタック**: Next.js 15、TypeScript、Tailwind CSS 4
2. **完全な認証**: Supabaseによる安全なユーザー管理
3. **リアルタイム機能**: セッション間でのライブ更新
4. **美しいUI/UX**: アニメーション、ダークモード、レスポンシブデザイン
5. **テストとデプロイ**: 自動テストとCI/CD

## 次のステップ

TODOアプリをさらに改良するには：

1. **機能追加**：
   - 期限とリマインダー
   - タグとカテゴリー
   - 検索機能
   - 一括操作

2. **パフォーマンス改善**：
   - 仮想スクロールの実装
   - オフラインサポート用サービスワーカーの追加
   - バンドルサイズの最適化

3. **セキュリティ強化**：
   - レート制限の追加
   - CSRF保護の実装
   - 2FA サポートの追加

4. **アプリケーションのスケール**：
   - チームコラボレーションの追加
   - 権限システムの実装
   - モバイルアプリ用APIの追加

## 追加リソース

- [Next.js デプロイメントドキュメント](https://nextjs.org/docs/deployment)
- [Vercel ドキュメント](https://vercel.com/docs)
- [Jest ドキュメント](https://jestjs.io/docs/getting-started)
- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
- [Web Vitals ドキュメント](https://web.dev/vitals/)

## 最後に

セットアップからデプロイまでの包括的な旅を完了しました。ここで学んだスキル—モダンなReactパターン、TypeScript、テスト、デプロイ—は、あらゆるWebアプリケーションの構築に役立ちます。

構築し続け、学び続け、そして最も重要なこと、出荷し続けましょう！🚀