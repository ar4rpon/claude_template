# Chapter 1: Environment Setup

Welcome to the first chapter of our TODO app tutorial! In this chapter, we'll set up everything you need to start building.

## Chapter Overview

**Duration**: 2-3 hours  
**Difficulty**: Beginner

## What You'll Learn

- Initialize a Next.js 15 project with TypeScript
- Configure Tailwind CSS 4
- Set up Supabase for your backend
- Understand the project structure
- Configure environment variables

## Prerequisites

Make sure you have:
- Node.js 18+ installed
- npm or yarn package manager
- A code editor (VS Code recommended)
- A Supabase account (sign up at [supabase.com](https://supabase.com))

## Step 1: Create Next.js Project

First, let's create a new Next.js project:

```bash
npx create-next-app@latest todo-app --typescript --tailwind --app
cd todo-app
```

When prompted, select:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: No
- App Router: Yes
- Import alias: Yes (keep @/*)

## Step 2: Install Additional Dependencies

Install Supabase client library:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Step 3: Set Up Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New project"
3. Fill in the project details:
   - Name: "todo-app"
   - Database Password: (generate a strong password)
   - Region: (choose closest to you)
4. Click "Create new project"

Wait for your project to be ready (this takes a few minutes).

## Step 4: Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
touch .env.local
```

Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings:
1. Go to Settings → API
2. Copy the "Project URL" and "anon public" key

## Step 5: Create Supabase Utilities

Create the Supabase client utilities:

```bash
mkdir -p utils/supabase
```

Create `utils/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `utils/supabase/server.ts`:

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
            // Cookie setting may fail in Server Components
          }
        },
      },
    }
  )
}
```

## Step 6: Update Project Structure

Your project structure should now look like this:

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

## Step 7: Test Your Setup

Update `app/page.tsx` to test the connection:

```typescript
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">TODO App</h1>
      <p className="mt-4 text-lg text-gray-600">
        Environment setup complete!
      </p>
    </main>
  )
}
```

Run the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app.

## Step 8: Initialize Git Repository

If not already initialized:

```bash
git init
git add .
git commit -m "Initial setup with Next.js, TypeScript, Tailwind CSS, and Supabase"
```

## Checkpoint Questions

1. What is the purpose of having separate Supabase clients for browser and server?
2. Why do we use environment variables for API keys?
3. What's the difference between `NEXT_PUBLIC_` prefixed variables and regular ones?

## Troubleshooting

### Common Issues

1. **Module not found errors**: Make sure all dependencies are installed
   ```bash
   npm install
   ```

2. **Environment variables not working**: 
   - Restart your development server after adding `.env.local`
   - Make sure variable names are exactly as shown

3. **Supabase connection errors**: 
   - Double-check your URL and anon key
   - Ensure your Supabase project is active

## Summary

Congratulations! You've successfully:
- ✅ Created a Next.js 15 project with TypeScript
- ✅ Configured Tailwind CSS 4
- ✅ Set up a Supabase project
- ✅ Created utility functions for Supabase clients
- ✅ Configured environment variables

## What's Next?

In [Chapter 2](../chapter-02/README.md), we'll implement authentication to allow users to sign up, log in, and manage their TODOs securely.

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Quickstart Guide](https://supabase.com/docs/guides/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)