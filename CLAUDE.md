# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15.3.3 application with TypeScript, Tailwind CSS, and Supabase integration, designed for deployment on Vercel.

Stack:
- Next.js 15.3.3 (App Router)
- React 19.0.0
- TypeScript 5.x
- Tailwind CSS 4.x
- Supabase (for backend/auth)
- Vercel (deployment platform)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

## Project Structure

```
├── app/                    # Next.js App Router pages
├── utils/
│   └── supabase/          # Supabase client configurations
│       ├── client.ts      # Browser client
│       ├── server.ts      # Server component client
│       └── middleware.ts  # Middleware utilities
├── middleware.ts          # Next.js middleware for auth
└── .env.local            # Environment variables (git ignored)
```

## Supabase Integration

- Client components: Use `@/utils/supabase/client`
- Server components: Use `@/utils/supabase/server`
- Middleware handles automatic session refresh
- Environment variables required: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Important Notes

- Always check existing components/patterns before creating new ones
- Follow the established file structure
- Use TypeScript strict mode
- Tailwind CSS 4 is configured with PostCSS
- Never commit `.env.local` file
- Service role keys should only be used server-side