# Chapter 5: Testing & Deployment

In this final chapter, we'll ensure our TODO app is production-ready by implementing comprehensive testing and deploying to Vercel with a CI/CD pipeline.

## Chapter Overview

**Duration**: 2-3 hours  
**Difficulty**: Intermediate to Advanced

## What You'll Learn

- Set up testing environment
- Write unit and integration tests
- Implement E2E testing basics
- Deploy to Vercel
- Set up GitHub Actions for CI/CD
- Monitor application performance

## Prerequisites

- Completed Chapters 1-4
- GitHub account
- Vercel account

## Step 1: Set Up Testing Environment

Install testing dependencies:

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
npm install -D @types/jest
```

Create `jest.config.js`:

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
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

Create `jest.setup.js`:

```javascript
import '@testing-library/jest-dom'

// Mock Next.js router
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

// Mock Supabase client
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

Update `package.json` scripts:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Step 2: Write Unit Tests

### Test TODO Form Component

Create `app/components/__tests__/TodoForm.test.tsx`:

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

  it('renders form elements correctly', () => {
    render(<TodoForm />)
    
    expect(screen.getByText('Add New TODO')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument()
    expect(screen.getByText('Add TODO')).toBeInTheDocument()
  })

  it('shows description field when title is focused', async () => {
    const user = userEvent.setup()
    render(<TodoForm />)
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.click(titleInput)
    
    expect(screen.getByPlaceholderText('Add a description (optional)')).toBeInTheDocument()
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    render(<TodoForm onSuccess={onSuccess} />)
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.type(titleInput, 'Test TODO')
    
    const submitButton = screen.getByText('Add TODO')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('displays error message on submission failure', async () => {
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({
        error: { message: 'Insert failed' }
      }),
    } as any)
    
    const user = userEvent.setup()
    render(<TodoForm />)
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.type(titleInput, 'Test TODO')
    
    const submitButton = screen.getByText('Add TODO')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Insert failed')).toBeInTheDocument()
    })
  })

  it('disables submit button when title is empty', () => {
    render(<TodoForm />)
    
    const submitButton = screen.getByText('Add TODO')
    expect(submitButton).toBeDisabled()
  })
})
```

### Test TODO Item Component

Create `app/components/__tests__/TodoItem.test.tsx`:

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
    title: 'Test TODO',
    description: 'Test description',
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

  it('renders todo item correctly', () => {
    render(<TodoItem todo={mockTodo} />)
    
    expect(screen.getByText('Test TODO')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('toggles completion status', async () => {
    const onUpdate = jest.fn()
    render(<TodoItem todo={mockTodo} onUpdate={onUpdate} />)
    
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onUpdate).toHaveBeenCalled()
    })
  })

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup()
    render(<TodoItem todo={mockTodo} />)
    
    const editButton = screen.getByText('Edit')
    await user.click(editButton)
    
    expect(screen.getByDisplayValue('Test TODO')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('saves edited title', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    render(<TodoItem todo={mockTodo} onUpdate={onUpdate} />)
    
    const editButton = screen.getByText('Edit')
    await user.click(editButton)
    
    const input = screen.getByDisplayValue('Test TODO')
    await user.clear(input)
    await user.type(input, 'Updated TODO')
    
    const saveButton = screen.getByText('Save')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onUpdate).toHaveBeenCalled()
    })
  })

  it('deletes todo item', async () => {
    const onDelete = jest.fn()
    window.confirm = jest.fn().mockReturnValue(true)
    
    const user = userEvent.setup()
    render(<TodoItem todo={mockTodo} onDelete={onDelete} />)
    
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('todos')
      expect(onDelete).toHaveBeenCalled()
    })
  })
})
```

## Step 3: Integration Testing

Create `app/__tests__/integration/todo-flow.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardPage from '@/app/dashboard/page'

describe('TODO Flow Integration', () => {
  it('completes full TODO workflow', async () => {
    const user = userEvent.setup()
    render(<DashboardPage />)
    
    // Wait for components to load
    await waitFor(() => {
      expect(screen.getByText('Add New TODO')).toBeInTheDocument()
    })
    
    // Add a new TODO
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.type(titleInput, 'Integration Test TODO')
    
    const addButton = screen.getByText('Add TODO')
    await user.click(addButton)
    
    // Verify TODO appears in list
    await waitFor(() => {
      expect(screen.getByText('Integration Test TODO')).toBeInTheDocument()
    })
    
    // Mark as complete
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    
    // Verify completed state
    await waitFor(() => {
      expect(checkbox).toBeChecked()
    })
  })
})
```

## Step 4: Prepare for Deployment

### Create Environment Variables Configuration

Create `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Update .gitignore

Ensure these are in `.gitignore`:

```
# Local env files
.env*.local

# Testing
/coverage
```

## Step 5: Deploy to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Complete TODO app with testing"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables:
     - Add `NEXT_PUBLIC_SUPABASE_URL`
     - Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click "Deploy"

## Step 6: Set Up CI/CD with GitHub Actions

Create `.github/workflows/ci.yml`:

```yaml
name: CI/CD Pipeline

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
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
      
      - name: Build application
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Set Up GitHub Secrets

1. Get Vercel tokens:
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel login`
   - Run `vercel link` in your project
   - Get tokens from `.vercel/project.json`

2. Add to GitHub repository secrets:
   - Go to Settings → Secrets → Actions
   - Add `VERCEL_TOKEN` (from Vercel account settings)
   - Add `VERCEL_ORG_ID` (from `.vercel/project.json`)
   - Add `VERCEL_PROJECT_ID` (from `.vercel/project.json`)

## Step 7: Performance Monitoring

### Add Web Vitals Monitoring

Create `app/components/WebVitals.tsx`:

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

Add to `app/layout.tsx`:

```typescript
import { WebVitals } from '@/app/components/WebVitals'

// In the body
<body className={inter.className}>
  <WebVitals />
  <ThemeProvider>{children}</ThemeProvider>
</body>
```

### Set Up Error Monitoring (Optional)

For production apps, consider adding:
- Sentry for error tracking
- Vercel Analytics for performance monitoring
- LogRocket for session replay

## Step 8: Production Checklist

Before going live, ensure:

- [ ] All tests pass
- [ ] Environment variables are set in Vercel
- [ ] Database has proper indexes
- [ ] RLS policies are correctly configured
- [ ] Error boundaries are implemented
- [ ] Loading states handle edge cases
- [ ] Forms have proper validation
- [ ] SEO meta tags are configured
- [ ] Security headers are set
- [ ] Performance budget is met

## Checkpoint Questions

1. What's the difference between unit and integration tests?
2. How does the CI/CD pipeline ensure code quality?
3. Why use GitHub Actions over other CI tools?
4. What metrics should you monitor in production?

## Troubleshooting

### Common Deployment Issues

1. **Build failures on Vercel**:
   - Check build logs for specific errors
   - Ensure all dependencies are in `package.json`
   - Verify environment variables are set

2. **Tests failing in CI**:
   - Run tests locally first
   - Check for environment-specific issues
   - Ensure mocks are properly configured

3. **Supabase connection issues**:
   - Verify environment variables
   - Check Supabase project is active
   - Review CORS settings

## Summary

Congratulations! You've successfully:
- ✅ Set up comprehensive testing
- ✅ Written unit and integration tests
- ✅ Deployed to production on Vercel
- ✅ Implemented CI/CD pipeline
- ✅ Added performance monitoring

## What You've Accomplished

Throughout this tutorial, you've built a complete, production-ready TODO application featuring:

1. **Modern Tech Stack**: Next.js 15, TypeScript, Tailwind CSS 4
2. **Full Authentication**: Secure user management with Supabase
3. **Real-time Features**: Live updates across sessions
4. **Beautiful UI/UX**: Animations, dark mode, responsive design
5. **Testing & Deployment**: Automated testing and CI/CD

## Next Steps

To further enhance your TODO app:

1. **Add Features**:
   - Due dates and reminders
   - Tags and categories
   - Search functionality
   - Bulk operations

2. **Improve Performance**:
   - Implement virtual scrolling
   - Add service worker for offline support
   - Optimize bundle size

3. **Enhance Security**:
   - Add rate limiting
   - Implement CSRF protection
   - Add 2FA support

4. **Scale the Application**:
   - Add team collaboration
   - Implement permissions system
   - Add API for mobile apps

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Web Vitals Documentation](https://web.dev/vitals/)

## Final Words

You've completed a comprehensive journey from setup to deployment. The skills you've learned here—modern React patterns, TypeScript, testing, and deployment—will serve you well in building any web application.

Keep building, keep learning, and most importantly, keep shipping! 🚀