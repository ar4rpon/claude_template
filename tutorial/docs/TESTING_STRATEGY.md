# Testing Strategy Documentation

This comprehensive guide covers testing strategies, best practices, and implementation details for ensuring the quality and reliability of our TODO application.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Pyramid](#testing-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Testing Best Practices](#testing-best-practices)

## Testing Philosophy

### Core Principles

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Maintain Test Independence**: Each test should run in isolation
3. **Keep Tests Simple**: A test should verify one thing
4. **Fast Feedback**: Tests should run quickly to encourage frequent execution
5. **Comprehensive Coverage**: Aim for high coverage without sacrificing quality

### Testing Goals

- **Confidence**: Tests should give confidence that the code works
- **Documentation**: Tests serve as living documentation
- **Regression Prevention**: Catch bugs before they reach production
- **Design Feedback**: Hard-to-test code often indicates design issues

## Testing Pyramid

```
         /\
        /  \    E2E Tests (10%)
       /----\   - Critical user journeys
      /      \  - Cross-browser testing
     /--------\ Integration Tests (30%)
    /          \- API testing
   /            \- Component integration
  /--------------\ Unit Tests (60%)
 /                \- Business logic
/                  \- Utility functions
```

## Unit Testing

### Component Testing

```typescript
// TodoForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoForm } from '@/components/TodoForm'
import { createClient } from '@/utils/supabase/client'

// Mock dependencies
jest.mock('@/utils/supabase/client')
const mockSupabase = createClient as jest.MockedFunction<typeof createClient>

describe('TodoForm', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup default mock behavior
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

  describe('Rendering', () => {
    it('should render all form elements', () => {
      render(<TodoForm />)
      
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add todo/i })).toBeInTheDocument()
    })

    it('should show loading state during submission', async () => {
      render(<TodoForm />)
      
      await user.type(screen.getByLabelText(/title/i), 'Test TODO')
      await user.click(screen.getByRole('button', { name: /add todo/i }))
      
      expect(screen.getByText(/adding/i)).toBeInTheDocument()
    })
  })

  describe('Validation', () => {
    it('should require title field', async () => {
      render(<TodoForm />)
      
      const submitButton = screen.getByRole('button', { name: /add todo/i })
      expect(submitButton).toBeDisabled()
      
      await user.type(screen.getByLabelText(/title/i), 'Test')
      expect(submitButton).toBeEnabled()
    })

    it('should trim whitespace from inputs', async () => {
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

  describe('Error Handling', () => {
    it('should display server errors', async () => {
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

    it('should handle authentication errors', async () => {
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

### Hook Testing

```typescript
// useDebounce.test.ts
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  jest.useFakeTimers()

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('should debounce value updates', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    // Update value
    rerender({ value: 'updated', delay: 500 })
    
    // Value should not change immediately
    expect(result.current).toBe('initial')
    
    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    // Value should now be updated
    expect(result.current).toBe('updated')
  })

  it('should cancel pending updates on unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })
    unmount()
    
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    // No errors should occur
    expect(true).toBe(true)
  })
})
```

### Utility Function Testing

```typescript
// validation.test.ts
import { 
  validateEmail, 
  validatePassword, 
  sanitizeInput,
  formatDate 
} from '@/utils/validation'

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it.each([
      ['user@example.com', true],
      ['user.name@example.co.uk', true],
      ['user+tag@example.com', true],
      ['invalid.email', false],
      ['@example.com', false],
      ['user@', false],
      ['', false],
    ])('validateEmail(%s) should return %s', (email, expected) => {
      expect(validateEmail(email)).toBe(expected)
    })
  })

  describe('validatePassword', () => {
    it('should enforce minimum length', () => {
      expect(validatePassword('short')).toContain('8 characters')
      expect(validatePassword('longenough')).not.toContain('8 characters')
    })

    it('should require uppercase letter', () => {
      expect(validatePassword('lowercase123!')).toContain('uppercase')
      expect(validatePassword('Uppercase123!')).not.toContain('uppercase')
    })

    it('should require special character', () => {
      expect(validatePassword('NoSpecial123')).toContain('special')
      expect(validatePassword('Special123!')).not.toContain('special')
    })
  })

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script')
      expect(sanitizeInput('normal text')).toBe('normal text')
    })

    it('should trim whitespace', () => {
      expect(sanitizeInput('  text  ')).toBe('text')
    })
  })

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      expect(formatDate(date)).toBe('Jan 15, 2024')
      expect(formatDate(date, 'time')).toBe('10:30 AM')
      expect(formatDate(date, 'full')).toBe('January 15, 2024 at 10:30 AM')
    })

    it('should handle invalid dates', () => {
      expect(formatDate('invalid')).toBe('Invalid Date')
    })
  })
})
```

## Integration Testing

### API Integration Tests

```typescript
// api.integration.test.ts
import { createClient } from '@/utils/supabase/client'
import { Todo } from '@/types/todo'

describe('TODO API Integration', () => {
  let supabase: ReturnType<typeof createClient>
  let testUser: any
  let createdTodos: string[] = []

  beforeAll(async () => {
    supabase = createClient()
    
    // Create test user
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!'
    })
    
    if (error) throw error
    testUser = data.user
  })

  afterEach(async () => {
    // Clean up created todos
    if (createdTodos.length > 0) {
      await supabase.from('todos').delete().in('id', createdTodos)
      createdTodos = []
    }
  })

  afterAll(async () => {
    // Clean up test user
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id)
    }
  })

  describe('CRUD Operations', () => {
    it('should create a new todo', async () => {
      const newTodo = {
        title: 'Integration Test TODO',
        description: 'Testing the API',
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

    it('should update a todo', async () => {
      // Create a todo first
      const { data: todo } = await supabase
        .from('todos')
        .insert({ title: 'Update Test', user_id: testUser.id })
        .select()
        .single()
      
      createdTodos.push(todo.id)

      // Update it
      const { data: updated, error } = await supabase
        .from('todos')
        .update({ completed: true })
        .eq('id', todo.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated.completed).toBe(true)
    })

    it('should enforce row level security', async () => {
      // Create another user's todo (should fail)
      const { error } = await supabase
        .from('todos')
        .insert({
          title: 'Unauthorized TODO',
          user_id: 'different-user-id'
        })

      expect(error).not.toBeNull()
      expect(error.message).toContain('security')
    })
  })

  describe('Real-time Subscriptions', () => {
    it('should receive real-time updates', (done) => {
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
              title: 'Real-time Test'
            })
            channel.unsubscribe()
            done()
          }
        )
        .subscribe()

      // Insert a todo to trigger the subscription
      setTimeout(async () => {
        const { data } = await supabase
          .from('todos')
          .insert({
            title: 'Real-time Test',
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

### Component Integration Tests

```typescript
// TodoList.integration.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoList } from '@/components/TodoList'
import { TodoProvider } from '@/contexts/TodoContext'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client')

describe('TodoList Integration', () => {
  const mockTodos = [
    {
      id: '1',
      title: 'First TODO',
      completed: false,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      title: 'Second TODO',
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

  it('should render and filter todos', async () => {
    const user = userEvent.setup()
    
    render(
      <TodoProvider>
        <TodoList />
      </TodoProvider>
    )

    // Wait for todos to load
    await waitFor(() => {
      expect(screen.getByText('First TODO')).toBeInTheDocument()
      expect(screen.getByText('Second TODO')).toBeInTheDocument()
    })

    // Test filtering
    await user.click(screen.getByRole('button', { name: /active/i }))
    
    expect(screen.getByText('First TODO')).toBeInTheDocument()
    expect(screen.queryByText('Second TODO')).not.toBeInTheDocument()

    // Test completed filter
    await user.click(screen.getByRole('button', { name: /completed/i }))
    
    expect(screen.queryByText('First TODO')).not.toBeInTheDocument()
    expect(screen.getByText('Second TODO')).toBeInTheDocument()
  })

  it('should handle todo interactions', async () => {
    const user = userEvent.setup()
    
    render(
      <TodoProvider>
        <TodoList />
      </TodoProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('First TODO')).toBeInTheDocument()
    })

    // Toggle completion
    const firstTodo = screen.getByText('First TODO').closest('[role="article"]')!
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

## End-to-End Testing

### Playwright Configuration

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

### E2E Test Examples

```typescript
// e2e/todo-journey.spec.ts
import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser } from './helpers'

test.describe('TODO User Journey', () => {
  let testEmail: string
  let testPassword: string

  test.beforeEach(async ({ page }) => {
    // Create unique test user
    const user = await createTestUser()
    testEmail = user.email
    testPassword = user.password
    
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', testEmail)
    await page.fill('[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard')
  })

  test.afterEach(async () => {
    await deleteTestUser(testEmail)
  })

  test('complete TODO workflow', async ({ page }) => {
    // Create a new TODO
    await page.fill('[placeholder="What needs to be done?"]', 'E2E Test TODO')
    await page.fill('[placeholder*="description"]', 'This is a test description')
    await page.click('button:has-text("Add TODO")')
    
    // Verify TODO appears
    const todoItem = page.locator('article').filter({ hasText: 'E2E Test TODO' })
    await expect(todoItem).toBeVisible()
    
    // Edit TODO
    await todoItem.locator('button:has-text("Edit")').click()
    await todoItem.locator('input[type="text"]').fill('Updated E2E Test TODO')
    await todoItem.locator('button:has-text("Save")').click()
    
    // Verify update
    await expect(todoItem).toContainText('Updated E2E Test TODO')
    
    // Complete TODO
    await todoItem.locator('input[type="checkbox"]').check()
    await expect(todoItem).toHaveClass(/line-through/)
    
    // Filter completed TODOs
    await page.click('button:has-text("Completed")')
    await expect(todoItem).toBeVisible()
    
    // Delete TODO
    await todoItem.locator('button:has-text("Delete")').click()
    await page.click('button:has-text("Confirm")')
    
    // Verify deletion
    await expect(todoItem).not.toBeVisible()
  })

  test('responsive design', async ({ page, viewport }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check mobile menu
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
    
    // Check layout adaptation
    const todoForm = page.locator('[data-testid="todo-form"]')
    await expect(todoForm).toHaveCSS('width', '100%')
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    // Check desktop layout
    await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible()
    await expect(todoForm).toHaveCSS('max-width', '400px')
  })

  test('dark mode toggle', async ({ page }) => {
    // Check initial light mode
    await expect(page.locator('html')).not.toHaveClass('dark')
    
    // Toggle dark mode
    await page.click('[aria-label="Toggle theme"]')
    
    // Verify dark mode
    await expect(page.locator('html')).toHaveClass('dark')
    
    // Verify persistence on reload
    await page.reload()
    await expect(page.locator('html')).toHaveClass('dark')
  })

  test('keyboard navigation', async ({ page }) => {
    // Create multiple TODOs
    for (let i = 1; i <= 3; i++) {
      await page.fill('[placeholder="What needs to be done?"]', `TODO ${i}`)
      await page.keyboard.press('Enter')
    }
    
    // Navigate with Tab
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('type', 'checkbox')
    
    // Toggle with Space
    await page.keyboard.press('Space')
    const firstCheckbox = page.locator('input[type="checkbox"]').first()
    await expect(firstCheckbox).toBeChecked()
    
    // Navigate to edit button
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveText('Edit')
    
    // Open edit mode with Enter
    await page.keyboard.press('Enter')
    await expect(page.locator('input[type="text"]:focus')).toBeVisible()
  })
})
```

### Visual Regression Testing

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Visual Regression', () => {
  test('dashboard appearance', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Take screenshot
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      animations: 'disabled'
    })
  })

  test('component states', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Normal state
    const todoItem = page.locator('article').first()
    await expect(todoItem).toHaveScreenshot('todo-item-normal.png')
    
    // Hover state
    await todoItem.hover()
    await expect(todoItem).toHaveScreenshot('todo-item-hover.png')
    
    // Completed state
    await todoItem.locator('input[type="checkbox"]').check()
    await expect(todoItem).toHaveScreenshot('todo-item-completed.png')
  })
})
```

## Performance Testing

### Load Testing with k6

```javascript
// k6/load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],             // Error rate under 10%
  },
}

export default function () {
  const BASE_URL = 'https://your-app.com'
  
  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'password123',
  })
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'received auth token': (r) => r.json('token') !== '',
  })
  
  errorRate.add(loginRes.status !== 200)
  
  const authToken = loginRes.json('token')
  const headers = { Authorization: `Bearer ${authToken}` }
  
  // Get TODOs
  const todosRes = http.get(`${BASE_URL}/api/todos`, { headers })
  
  check(todosRes, {
    'todos retrieved': (r) => r.status === 200,
    'todos is array': (r) => Array.isArray(r.json()),
  })
  
  errorRate.add(todosRes.status !== 200)
  
  // Create TODO
  const createRes = http.post(
    `${BASE_URL}/api/todos`,
    JSON.stringify({
      title: 'Performance Test TODO',
      description: 'Created by k6',
    }),
    { headers }
  )
  
  check(createRes, {
    'todo created': (r) => r.status === 201,
    'has todo id': (r) => r.json('id') !== '',
  })
  
  errorRate.add(createRes.status !== 201)
  
  sleep(1)
}
```

### Frontend Performance Testing

```typescript
// performance/web-vitals.test.ts
import { test, expect } from '@playwright/test'

test.describe('Performance Metrics', () => {
  test('measure Core Web Vitals', async ({ page }) => {
    // Navigate to page
    await page.goto('/dashboard')
    
    // Measure LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          resolve(lastEntry.startTime)
        }).observe({ entryTypes: ['largest-contentful-paint'] })
      })
    })
    
    expect(lcp).toBeLessThan(2500) // Good LCP is under 2.5s
    
    // Measure FID (First Input Delay)
    await page.click('button:has-text("Add TODO")')
    const fid = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          resolve(entries[0].processingStart - entries[0].startTime)
        }).observe({ entryTypes: ['first-input'] })
      })
    })
    
    expect(fid).toBeLessThan(100) // Good FID is under 100ms
    
    // Measure CLS (Cumulative Layout Shift)
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
        
        // Trigger some actions that might cause layout shift
        setTimeout(() => resolve(clsValue), 5000)
      })
    })
    
    expect(cls).toBeLessThan(0.1) // Good CLS is under 0.1
  })

  test('bundle size analysis', async ({ page }) => {
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
    
    console.log(`Total JS: ${totalBytes} bytes`)
    console.log(`Used JS: ${usedBytes} bytes`)
    console.log(`Unused JS: ${unusedPercentage.toFixed(2)}%`)
    
    expect(unusedPercentage).toBeLessThan(50) // Less than 50% unused
  })
})
```

## Security Testing

### Security Test Suite

```typescript
// security/security.test.ts
import { test, expect } from '@playwright/test'

test.describe('Security Tests', () => {
  test('XSS Prevention', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Try to inject script
    const xssPayload = '<script>alert("XSS")</script>'
    await page.fill('[placeholder="What needs to be done?"]', xssPayload)
    await page.click('button:has-text("Add TODO")')
    
    // Check that script is not executed
    const alertFired = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.alert = () => resolve(true)
        setTimeout(() => resolve(false), 1000)
      })
    })
    
    expect(alertFired).toBe(false)
    
    // Check that content is escaped
    const todoText = await page.textContent('article')
    expect(todoText).not.toContain('<script>')
    expect(todoText).toContain('&lt;script&gt;')
  })

  test('CSRF Protection', async ({ page, request }) => {
    // Try to make request without CSRF token
    const response = await request.post('/api/todos', {
      data: { title: 'CSRF Test' },
      headers: {
        'Origin': 'https://evil-site.com'
      }
    })
    
    expect(response.status()).toBe(403)
  })

  test('SQL Injection Prevention', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Try SQL injection in search
    const sqlPayload = "'; DROP TABLE todos; --"
    await page.fill('[placeholder="Search todos"]', sqlPayload)
    await page.keyboard.press('Enter')
    
    // Check that app still works
    await page.reload()
    await expect(page.locator('article')).toBeVisible()
  })

  test('Authentication Required', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('Rate Limiting', async ({ page, request }) => {
    const attempts = []
    
    // Make many requests quickly
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

### Dependency Scanning

```json
// package.json scripts
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

## Testing Best Practices

### 1. Test Structure

```typescript
// Follow AAA pattern
test('should do something', () => {
  // Arrange
  const input = 'test'
  const expected = 'TEST'
  
  // Act
  const result = toUpperCase(input)
  
  // Assert
  expect(result).toBe(expected)
})
```

### 2. Test Data Management

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

### 3. Custom Matchers

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
          ? `expected ${received} not to be a valid todo`
          : `expected ${received} to be a valid todo`
    }
  }
})

// Usage
expect(todo).toBeValidTodo()
```

### 4. Test Utilities

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

### 5. Testing Checklist

Before pushing code, ensure:

- [ ] All tests pass locally
- [ ] New features have corresponding tests
- [ ] Edge cases are covered
- [ ] Error states are tested
- [ ] Loading states are tested
- [ ] Accessibility tests pass
- [ ] Performance benchmarks are met
- [ ] Security tests pass
- [ ] No console errors in tests
- [ ] Test coverage meets threshold

## Summary

A comprehensive testing strategy includes:

1. **Unit Tests**: Fast, focused tests for individual components
2. **Integration Tests**: Verify components work together
3. **E2E Tests**: Validate critical user journeys
4. **Performance Tests**: Ensure app meets speed requirements
5. **Security Tests**: Verify protection against common vulnerabilities

Remember:
- Write tests as you code, not after
- Maintain tests as diligently as production code
- Use tests as documentation
- Optimize for confidence, not coverage
- Keep tests simple and readable

For more resources:
- [Testing Library Documentation](https://testing-library.com/)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [k6 Documentation](https://k6.io/docs/)