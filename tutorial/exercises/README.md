# TODO App Tutorial Exercises

Welcome to the exercises section! These hands-on challenges will help reinforce what you've learned in each chapter.

## How to Use These Exercises

1. **Complete the main tutorial first** - Each exercise builds on concepts from the chapters
2. **Try solving independently** - Attempt each exercise before looking at hints
3. **Check your work** - Compare with the solutions in the `/solutions` directory
4. **Experiment** - Feel free to go beyond the requirements

## Exercise Structure

Each exercise includes:
- **Objective**: What you'll build or implement
- **Requirements**: Specific features to include
- **Hints**: Helpful pointers if you get stuck
- **Bonus Challenges**: Extra features for additional practice

## Chapter 1 Exercises: Environment Setup

### Exercise 1.1: Custom Environment Configuration

**Objective**: Extend the environment setup with additional development tools

**Requirements**:
1. Add Prettier for code formatting
2. Configure ESLint with custom rules
3. Set up pre-commit hooks with Husky
4. Add VS Code recommended extensions

**Hints**:
- Install `prettier`, `eslint-config-prettier`, `husky`, and `lint-staged`
- Create `.prettierrc` and update `.eslintrc.json`
- Use `npx husky init` to set up Git hooks

**Bonus**:
- Add a custom npm script for checking code quality
- Set up a `.editorconfig` file

### Exercise 1.2: Docker Development Environment

**Objective**: Create a Docker setup for consistent development

**Requirements**:
1. Create a Dockerfile for the Next.js app
2. Set up docker-compose with app and Supabase services
3. Configure hot reloading in Docker
4. Add a Makefile for common commands

**Hints**:
- Use `node:18-alpine` as base image
- Mount source code as volume for hot reloading
- Use Supabase's official Docker image

## Chapter 2 Exercises: Authentication

### Exercise 2.1: Password Strength Indicator

**Objective**: Add a visual password strength indicator to the signup form

**Requirements**:
1. Create a password strength calculation function
2. Display strength visually (weak, medium, strong)
3. Show specific requirements not met
4. Prevent weak passwords from being submitted

**Hints**:
- Check length, uppercase, lowercase, numbers, special characters
- Use a progress bar or colored indicator
- Update in real-time as user types

**Bonus**:
- Add password visibility toggle
- Implement "suggested strong password" generator

### Exercise 2.2: OAuth Integration

**Objective**: Add social login options (Google, GitHub)

**Requirements**:
1. Configure OAuth providers in Supabase
2. Add social login buttons to login/signup pages
3. Handle OAuth callback properly
4. Show user's avatar from social provider

**Hints**:
- Set up OAuth apps in Google/GitHub developer consoles
- Use Supabase's `signInWithOAuth` method
- Create an `/auth/callback` route

**Bonus**:
- Allow linking multiple social accounts
- Implement account merging for same email

### Exercise 2.3: Remember Me & Session Management

**Objective**: Implement "Remember Me" functionality and session management

**Requirements**:
1. Add "Remember Me" checkbox to login
2. Extend session duration when checked
3. Show active sessions in user settings
4. Allow users to revoke other sessions

**Hints**:
- Use different session expiry times
- Store session metadata in database
- Track device/browser information

## Chapter 3 Exercises: TODO Features

### Exercise 3.1: Advanced Filtering and Sorting

**Objective**: Implement comprehensive filtering and sorting options

**Requirements**:
1. Add date range filtering
2. Implement multiple sort options (date, title, priority)
3. Create saved filter presets
4. Add full-text search

**Hints**:
- Use URL parameters for filter state
- Implement debounced search
- Store presets in localStorage or database

**Bonus**:
- Add export filtered results feature
- Implement smart filters (e.g., "Due this week")

### Exercise 3.2: Bulk Operations

**Objective**: Add ability to perform actions on multiple TODOs

**Requirements**:
1. Add checkbox selection for multiple items
2. Implement bulk complete/uncomplete
3. Add bulk delete with confirmation
4. Create "Select All" functionality

**Hints**:
- Manage selection state in parent component
- Show action bar when items selected
- Use optimistic updates for better UX

**Bonus**:
- Add bulk move to category
- Implement keyboard shortcuts for selection

### Exercise 3.3: Tags and Categories

**Objective**: Implement a tagging and categorization system

**Requirements**:
1. Create tags table and management UI
2. Allow multiple tags per TODO
3. Add category grouping
4. Implement tag-based filtering

**Hints**:
- Use many-to-many relationship for tags
- Create tag input with autocomplete
- Use color coding for visual distinction

**Database Schema**:
```sql
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#gray',
  UNIQUE(user_id, name)
);

CREATE TABLE todo_tags (
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);
```

## Chapter 4 Exercises: UI/UX Enhancement

### Exercise 4.1: Drag and Drop Reordering

**Objective**: Allow users to reorder TODOs via drag and drop

**Requirements**:
1. Implement drag and drop for TODO items
2. Save new order to database
3. Add smooth animations during drag
4. Support touch devices

**Hints**:
- Use `@dnd-kit/sortable` library
- Add `position` column to todos table
- Update positions in batch

**Bonus**:
- Add drag handle for better mobile UX
- Implement cross-category dragging

### Exercise 4.2: Custom Theme Builder

**Objective**: Let users customize the app's appearance

**Requirements**:
1. Create theme customization panel
2. Allow color scheme selection
3. Add font size options
4. Save preferences per user

**Hints**:
- Use CSS variables for theming
- Store preferences in user metadata
- Provide preset themes

**Bonus**:
- Add custom CSS input for power users
- Export/import theme configurations

### Exercise 4.3: Keyboard-First Navigation

**Objective**: Implement comprehensive keyboard shortcuts

**Requirements**:
1. Add global keyboard shortcuts
2. Create command palette (Cmd/Ctrl + K)
3. Implement vim-style navigation
4. Show shortcut hints in UI

**Hints**:
- Use `useKeyboardShortcuts` hook
- Prevent conflicts with browser shortcuts
- Add help modal with all shortcuts

**Shortcuts to implement**:
- `n` - New TODO
- `j/k` - Navigate up/down
- `x` - Toggle complete
- `e` - Edit selected
- `d` - Delete selected
- `/` - Focus search

## Chapter 5 Exercises: Testing & Deployment

### Exercise 5.1: Comprehensive Test Suite

**Objective**: Achieve 90%+ test coverage

**Requirements**:
1. Add missing unit tests
2. Create integration test suite
3. Implement visual regression tests
4. Add performance benchmarks

**Hints**:
- Use coverage reports to find gaps
- Mock external dependencies properly
- Test error boundaries

**Bonus**:
- Add mutation testing
- Implement contract testing

### Exercise 5.2: CI/CD Pipeline Enhancement

**Objective**: Create a robust deployment pipeline

**Requirements**:
1. Add staging environment
2. Implement blue-green deployments
3. Add automated rollback
4. Create deployment notifications

**Hints**:
- Use GitHub environments
- Implement health checks
- Add Slack/Discord webhooks

**Bonus**:
- Add feature flags
- Implement canary deployments

### Exercise 5.3: Monitoring and Analytics

**Objective**: Add comprehensive monitoring

**Requirements**:
1. Implement error tracking (Sentry)
2. Add performance monitoring
3. Create custom analytics events
4. Build admin dashboard

**Hints**:
- Track user actions and errors
- Monitor Core Web Vitals
- Use Supabase for analytics storage

## Advanced Exercises

### Exercise A.1: Mobile App

**Objective**: Create a React Native version

**Requirements**:
1. Set up React Native with Expo
2. Implement core TODO features
3. Add offline support
4. Enable push notifications

### Exercise A.2: AI Integration

**Objective**: Add AI-powered features

**Requirements**:
1. Implement smart task suggestions
2. Add natural language input
3. Create AI-based categorization
4. Build productivity insights

### Exercise A.3: Team Collaboration

**Objective**: Transform into a team TODO app

**Requirements**:
1. Add workspace/team support
2. Implement real-time collaboration
3. Add comments and mentions
4. Create activity feed

### Exercise A.4: API and Webhooks

**Objective**: Build a public API

**Requirements**:
1. Create RESTful API endpoints
2. Add API key authentication
3. Implement webhooks
4. Build API documentation

## Tips for Success

1. **Start Simple**: Get basic functionality working before adding complexity
2. **Test as You Go**: Write tests alongside your implementation
3. **Ask for Help**: Use the community forums if you get stuck
4. **Share Your Work**: Show off your implementations!
5. **Keep Learning**: Each exercise teaches different concepts

## Submission and Feedback

Want to share your solutions or get feedback?

1. Fork the tutorial repository
2. Create a branch for your exercises
3. Submit a pull request with your solutions
4. Join our Discord to discuss approaches

Happy coding! 🚀