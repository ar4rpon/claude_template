# Next.js + TypeScript + Supabase + Vercel セットアップガイド

## 環境構築完了

以下の最新バージョンで環境を構築しました：

- **Next.js**: 15.3.3
- **React**: 19.0.0
- **TypeScript**: 5.x
- **Tailwind CSS**: 4.x (with PostCSS)
- **Supabase JS**: 2.49.9
- **Supabase SSR**: 0.6.1

## 必要な設定値

### 1. Supabase設定

`.env.local`ファイルに以下の値を設定してください：

```env
# Supabaseプロジェクトの設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# オプション: サーバーサイドのみ（セキュリティ強化用）
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### Supabaseの設定値の取得方法：

1. [Supabase Dashboard](https://supabase.com/dashboard)にアクセス
2. プロジェクトを選択（または新規作成）
3. 左サイドバーの「Settings」→「API」をクリック
4. 以下の値をコピー：
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`に設定
   - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`に設定
   - **service_role**: `SUPABASE_SERVICE_ROLE_KEY`に設定（オプション）

### 2. Vercelデプロイ設定

#### 環境変数の設定：

Vercelダッシュボードで以下の環境変数を設定：

1. Vercelプロジェクトダッシュボード → Settings → Environment Variables
2. 以下の変数を追加：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（本番環境でのみ必要な場合）

#### デプロイコマンド：

```bash
# Vercel CLIをインストール（未インストールの場合）
npm i -g vercel

# デプロイ
vercel
```

### 3. プロジェクト構造

```
/workspaces/claude_template/
├── app/                    # Next.js App Router
├── utils/
│   └── supabase/          # Supabaseクライアント設定
│       ├── client.ts      # ブラウザ用クライアント
│       ├── server.ts      # サーバーコンポーネント用
│       └── middleware.ts  # ミドルウェア用
├── middleware.ts          # Next.jsミドルウェア（認証セッション更新）
├── .env.local            # 環境変数（Gitignore対象）
└── .env.local.example    # 環境変数のサンプル
```

### 4. 開発コマンド

```bash
# 開発サーバー起動（Turbopack使用）
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm run start

# リント
npm run lint
```

### 5. 使用方法

#### クライアントコンポーネントでSupabaseを使用：

```typescript
'use client'
import { createClient } from '@/utils/supabase/client'

export default function Page() {
  const supabase = createClient()
  // Supabaseクライアントを使用
}
```

#### サーバーコンポーネントでSupabaseを使用：

```typescript
import { createClient } from '@/utils/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  // Supabaseクライアントを使用
}
```

### 6. 追加推奨設定

#### Supabase型定義の生成（推奨）：

```bash
# Supabase CLIをインストール
npm install -D supabase

# ログイン
npx supabase login

# 型定義を生成
npx supabase gen types typescript --project-id your-project-id > types/supabase.ts
```

#### 認証ヘルパーのインストール（オプション）：

```bash
npm install @supabase/auth-helpers-nextjs
```

## 注意事項

- `.env.local`ファイルは必ずGitignoreに含めてください
- `SUPABASE_SERVICE_ROLE_KEY`は絶対にクライアントサイドで使用しないでください
- Vercelデプロイ時は環境変数を必ず設定してください