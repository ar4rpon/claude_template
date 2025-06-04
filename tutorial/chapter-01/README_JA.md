# 第1章: 環境構築

TODOアプリチュートリアルの第1章へようこそ！この章では、構築を開始するために必要なすべてを設定します。

## 章の概要

**所要時間**: 2-3時間  
**難易度**: 初級

## 学習内容

- TypeScript付きNext.js 15プロジェクトの初期化
- Tailwind CSS 4の設定
- バックエンド用Supabaseの設定
- プロジェクト構造の理解
- 環境変数の設定

## 前提条件

以下があることを確認してください：
- Node.js 18+がインストール済み
- npmまたはyarnパッケージマネージャー
- コードエディター（VS Code推奨）
- Supabaseアカウント（[supabase.com](https://supabase.com)でサインアップ）

## ステップ1: Next.jsプロジェクトの作成

まず、新しいNext.jsプロジェクトを作成します：

```bash
npx create-next-app@latest todo-app --typescript --tailwind --app
cd todo-app
```

プロンプトで以下を選択します：
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` ディレクトリ: No
- App Router: Yes
- Import alias: Yes (@/*を維持)

## ステップ2: 追加の依存関係をインストール

Supabaseクライアントライブラリをインストールします：

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## ステップ3: Supabaseプロジェクトの設定

1. [app.supabase.com](https://app.supabase.com)に移動
2. 「New project」をクリック
3. プロジェクト詳細を入力：
   - 名前: "todo-app"
   - データベースパスワード: （強力なパスワードを生成）
   - リージョン: （お住まいに最も近い地域を選択）
4. 「Create new project」をクリック

プロジェクトの準備が整うまで待ちます（数分かかります）。

## ステップ4: 環境変数の設定

プロジェクトルートに`.env.local`ファイルを作成します：

```bash
touch .env.local
```

Supabaseの認証情報を追加します：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

これらの値はSupabaseプロジェクトの設定で見つけることができます：
1. Settings → APIに移動
2. 「Project URL」と「anon public」キーをコピー

## ステップ5: Supabaseユーティリティの作成

Supabaseクライアントユーティリティを作成します：

```bash
mkdir -p utils/supabase
```

`utils/supabase/client.ts`を作成：

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`utils/supabase/server.ts`を作成：

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Componentsでのクッキー設定が失敗する場合があります
          }
        },
      },
    }
  )
}
```

## ステップ6: プロジェクト構造の更新

プロジェクト構造は以下のようになるはずです：

```
todo-app/
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── utils/
│   └── supabase/
│       ├── client.ts
│       └── server.ts
├── public/
├── .env.local
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## ステップ7: セットアップのテスト

接続をテストするために`app/page.tsx`を更新：

```typescript
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">TODOアプリ</h1>
      <p className="mt-4 text-lg text-gray-600">
        環境構築完了！
      </p>
    </main>
  )
}
```

開発サーバーを実行：

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)にアクセスしてアプリを確認します。

## ステップ8: Gitリポジトリの初期化

まだ初期化されていない場合：

```bash
git init
git add .
git commit -m "Initial setup with Next.js, TypeScript, Tailwind CSS, and Supabase"
```

## チェックポイント質問

1. ブラウザー用とサーバー用でSupabaseクライアントを分ける目的は何ですか？
2. APIキーに環境変数を使う理由は何ですか？
3. `NEXT_PUBLIC_`プレフィックス付きの変数と通常の変数の違いは何ですか？

## トラブルシューティング

### よくある問題

1. **Module not found エラー**: すべての依存関係がインストールされていることを確認
   ```bash
   npm install
   ```

2. **環境変数が機能しない**: 
   - `.env.local`を追加した後、開発サーバーを再起動
   - 変数名が正確に記載されていることを確認

3. **Supabase接続エラー**: 
   - URLとanonキーを再確認
   - Supabaseプロジェクトがアクティブであることを確認

## まとめ

おめでとうございます！以下を正常に完了しました：
- ✅ TypeScript付きNext.js 15プロジェクトの作成
- ✅ Tailwind CSS 4の設定
- ✅ Supabaseプロジェクトの設定
- ✅ Supabaseクライアント用ユーティリティ関数の作成
- ✅ 環境変数の設定

## 次のステップ

[第2章](../chapter-02/README_JA.md)では、ユーザーがサインアップ、ログイン、TODOを安全に管理できるように認証を実装します。

## 追加リソース

- [Next.js ドキュメント](https://nextjs.org/docs)
- [Supabase クイックスタートガイド](https://supabase.com/docs/guides/getting-started)
- [TypeScript ハンドブック](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Tailwind CSS ドキュメント](https://tailwindcss.com/docs)