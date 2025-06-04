# Database Design Documentation

This document details the database architecture, design decisions, and optimization strategies for our TODO application.

## Table of Contents

1. [Database Schema](#database-schema)
2. [Design Principles](#design-principles)
3. [Row Level Security](#row-level-security)
4. [Performance Optimization](#performance-optimization)
5. [Migration Strategies](#migration-strategies)
6. [Backup and Recovery](#backup-and-recovery)

## Database Schema

### Current Schema Overview

```sql
-- Users table (managed by Supabase Auth)
auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Additional fields managed by Supabase
)

-- TODOs table
public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Indexes
  INDEX idx_todos_user_id (user_id),
  INDEX idx_todos_created_at (created_at DESC)
)
```

### Extended Schema for Advanced Features

```sql
-- Categories table
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, name)
);

-- Tags table
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, name)
);

-- Extended TODOs table
ALTER TABLE todos ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 3);
ALTER TABLE todos ADD COLUMN due_date TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN reminder_date TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN notes TEXT;
ALTER TABLE todos ADD COLUMN position INTEGER DEFAULT 0;

-- Many-to-many relationship for tags
CREATE TABLE todo_tags (
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

-- Attachments table
CREATE TABLE todo_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Activity log table
CREATE TABLE todo_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'uncompleted', 'deleted')),
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Collaboration table
CREATE TABLE todo_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  
  UNIQUE(todo_id, user_id)
);
```

## Design Principles

### 1. Normalization

Our database follows Third Normal Form (3NF) principles:

- **No duplicate data**: Each piece of information is stored once
- **Atomic values**: Each column contains indivisible values
- **No transitive dependencies**: Non-key attributes depend only on the primary key

### 2. Data Integrity

```sql
-- Ensure data consistency with constraints
ALTER TABLE todos ADD CONSTRAINT check_dates 
  CHECK (due_date IS NULL OR due_date > created_at);

ALTER TABLE todos ADD CONSTRAINT check_reminder 
  CHECK (reminder_date IS NULL OR due_date IS NULL OR reminder_date <= due_date);

-- Ensure valid email format
ALTER TABLE auth.users ADD CONSTRAINT valid_email 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

### 3. Audit Trail

Implement comprehensive audit logging:

```sql
-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO todo_activities (todo_id, user_id, action, changes)
    VALUES (NEW.id, NEW.user_id, 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO todo_activities (todo_id, user_id, action, changes)
    VALUES (NEW.id, NEW.user_id, 'updated', 
      jsonb_build_object(
        'before', to_jsonb(OLD),
        'after', to_jsonb(NEW),
        'changed_fields', (
          SELECT jsonb_object_agg(key, value)
          FROM jsonb_each(to_jsonb(NEW))
          WHERE value != to_jsonb(OLD) -> key
        )
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO todo_activities (todo_id, user_id, action, changes)
    VALUES (OLD.id, OLD.user_id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger
CREATE TRIGGER audit_todos
  AFTER INSERT OR UPDATE OR DELETE ON todos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### 4. Soft Deletes

Implement soft deletes for data recovery:

```sql
-- Add soft delete columns
ALTER TABLE todos ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- Create view for active todos
CREATE VIEW active_todos AS
  SELECT * FROM todos WHERE deleted_at IS NULL;

-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete_todo(todo_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE todos 
  SET deleted_at = NOW(), 
      deleted_by = auth.uid()
  WHERE id = todo_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Row Level Security

### Basic RLS Policies

```sql
-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Basic policies for todos
CREATE POLICY "Users can view own todos" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own todos" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos" ON todos
  FOR DELETE USING (auth.uid() = user_id);
```

### Advanced RLS for Collaboration

```sql
-- Function to check if user has access to todo
CREATE OR REPLACE FUNCTION user_has_todo_access(todo_id UUID, required_permission TEXT DEFAULT 'view')
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM todos WHERE id = todo_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM todo_collaborators 
    WHERE todo_collaborators.todo_id = $1 
      AND user_id = auth.uid() 
      AND accepted_at IS NOT NULL
      AND (
        required_permission = 'view' OR
        (required_permission = 'edit' AND permission IN ('edit', 'admin')) OR
        (required_permission = 'admin' AND permission = 'admin')
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Collaboration policies
CREATE POLICY "Users can view shared todos" ON todos
  FOR SELECT USING (user_has_todo_access(id, 'view'));

CREATE POLICY "Users can update shared todos" ON todos
  FOR UPDATE USING (user_has_todo_access(id, 'edit'));
```

### RLS Performance Considerations

```sql
-- Create materialized view for better performance
CREATE MATERIALIZED VIEW user_todo_permissions AS
SELECT 
  t.id as todo_id,
  t.user_id as owner_id,
  c.user_id as collaborator_id,
  COALESCE(c.permission, 'owner') as permission
FROM todos t
LEFT JOIN todo_collaborators c ON t.id = c.todo_id
WHERE t.deleted_at IS NULL;

-- Create index
CREATE INDEX idx_user_todo_permissions ON user_todo_permissions(collaborator_id, todo_id);

-- Refresh periodically
CREATE OR REPLACE FUNCTION refresh_permissions()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_todo_permissions;
END;
$$ LANGUAGE plpgsql;
```

## Performance Optimization

### 1. Indexing Strategy

```sql
-- Composite indexes for common queries
CREATE INDEX idx_todos_user_completed ON todos(user_id, completed);
CREATE INDEX idx_todos_user_created ON todos(user_id, created_at DESC);
CREATE INDEX idx_todos_user_due ON todos(user_id, due_date) WHERE due_date IS NOT NULL;

-- Partial indexes for specific conditions
CREATE INDEX idx_todos_active ON todos(user_id, created_at DESC) 
  WHERE completed = false AND deleted_at IS NULL;

CREATE INDEX idx_todos_overdue ON todos(user_id, due_date) 
  WHERE completed = false AND due_date < NOW() AND deleted_at IS NULL;

-- Full-text search index
ALTER TABLE todos ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_todos_search_vector
  BEFORE INSERT OR UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE INDEX idx_todos_search ON todos USING gin(search_vector);
```

### 2. Query Optimization

```sql
-- Optimized query for dashboard
CREATE OR REPLACE FUNCTION get_user_dashboard_data(user_uuid UUID)
RETURNS TABLE (
  total_todos INTEGER,
  completed_todos INTEGER,
  overdue_todos INTEGER,
  due_today INTEGER,
  recent_todos JSON
) AS $$
BEGIN
  RETURN QUERY
  WITH todo_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE completed = true) as completed,
      COUNT(*) FILTER (WHERE completed = false AND due_date < NOW()) as overdue,
      COUNT(*) FILTER (WHERE completed = false AND due_date::date = CURRENT_DATE) as due_today
    FROM todos
    WHERE user_id = user_uuid AND deleted_at IS NULL
  ),
  recent AS (
    SELECT json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'completed', completed,
        'due_date', due_date
      ) ORDER BY created_at DESC
    ) as recent_todos
    FROM (
      SELECT id, title, completed, due_date, created_at
      FROM todos
      WHERE user_id = user_uuid AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    ) t
  )
  SELECT 
    s.total::INTEGER,
    s.completed::INTEGER,
    s.overdue::INTEGER,
    s.due_today::INTEGER,
    r.recent_todos
  FROM todo_stats s, recent r;
END;
$$ LANGUAGE plpgsql;
```

### 3. Caching Strategy

```sql
-- Create cache table for expensive calculations
CREATE TABLE user_stats_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_todos INTEGER DEFAULT 0,
  completed_todos INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_activity TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update cache on todo changes
CREATE OR REPLACE FUNCTION update_user_stats_cache()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats_cache (user_id, total_todos, completed_todos, completion_rate, last_activity)
  SELECT 
    COALESCE(NEW.user_id, OLD.user_id),
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true),
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE completed = true))::DECIMAL / COUNT(*) * 100, 2)
      ELSE 0
    END,
    NOW()
  FROM todos
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND deleted_at IS NULL
  ON CONFLICT (user_id) DO UPDATE SET
    total_todos = EXCLUDED.total_todos,
    completed_todos = EXCLUDED.completed_todos,
    completion_rate = EXCLUDED.completion_rate,
    last_activity = EXCLUDED.last_activity,
    updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stats_on_todo_change
  AFTER INSERT OR UPDATE OR DELETE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_user_stats_cache();
```

### 4. Partitioning for Scale

```sql
-- Partition todos table by year for large datasets
CREATE TABLE todos_partitioned (
  LIKE todos INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE todos_2024 PARTITION OF todos_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE todos_2025 PARTITION OF todos_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Automatic partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  start_date date;
  end_date date;
  partition_name text;
BEGIN
  start_date := date_trunc('month', CURRENT_DATE);
  end_date := start_date + interval '1 month';
  partition_name := 'todos_' || to_char(start_date, 'YYYY_MM');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF todos_partitioned
     FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;
```

## Migration Strategies

### 1. Version Control for Schema

```sql
-- Create migrations table
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Example migration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1) THEN
    -- Add priority column
    ALTER TABLE todos ADD COLUMN priority INTEGER DEFAULT 0;
    
    -- Record migration
    INSERT INTO schema_migrations (version, name) 
    VALUES (1, 'add_priority_to_todos');
  END IF;
END $$;
```

### 2. Zero-Downtime Migrations

```sql
-- Step 1: Add new column (non-blocking)
ALTER TABLE todos ADD COLUMN new_title TEXT;

-- Step 2: Backfill data
UPDATE todos SET new_title = title WHERE new_title IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE todos ALTER COLUMN new_title SET NOT NULL;

-- Step 4: Switch to new column
BEGIN;
ALTER TABLE todos RENAME COLUMN title TO old_title;
ALTER TABLE todos RENAME COLUMN new_title TO title;
COMMIT;

-- Step 5: Drop old column (after verifying)
ALTER TABLE todos DROP COLUMN old_title;
```

### 3. Data Migration Patterns

```sql
-- Batch processing for large migrations
CREATE OR REPLACE FUNCTION migrate_data_in_batches()
RETURNS void AS $$
DECLARE
  batch_size INTEGER := 1000;
  offset_val INTEGER := 0;
  total_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM todos WHERE needs_migration = true;
  
  WHILE offset_val < total_rows LOOP
    UPDATE todos 
    SET migrated_field = some_transformation(old_field),
        needs_migration = false
    WHERE id IN (
      SELECT id FROM todos 
      WHERE needs_migration = true 
      LIMIT batch_size
    );
    
    offset_val := offset_val + batch_size;
    
    -- Pause to prevent overload
    PERFORM pg_sleep(0.1);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## Backup and Recovery

### 1. Automated Backup Strategy

```sql
-- Create backup metadata table
CREATE TABLE backup_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type TEXT CHECK (backup_type IN ('full', 'incremental', 'point_in_time')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  size_bytes BIGINT,
  location TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

-- Backup function
CREATE OR REPLACE FUNCTION create_backup(p_backup_type TEXT)
RETURNS UUID AS $$
DECLARE
  backup_id UUID;
BEGIN
  INSERT INTO backup_history (backup_type) 
  VALUES (p_backup_type) 
  RETURNING id INTO backup_id;
  
  -- Actual backup would be handled by external process
  -- This is just for tracking
  
  RETURN backup_id;
END;
$$ LANGUAGE plpgsql;
```

### 2. Point-in-Time Recovery

```sql
-- Enable logical replication for PITR
ALTER SYSTEM SET wal_level = 'logical';
ALTER SYSTEM SET max_replication_slots = 10;

-- Create replication slot
SELECT pg_create_logical_replication_slot('todo_app_slot', 'pgoutput');
```

### 3. Data Validation

```sql
-- Validate data integrity
CREATE OR REPLACE FUNCTION validate_database_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check foreign key integrity
  RETURN QUERY
  SELECT 
    'Foreign Key Check'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'::TEXT
      ELSE 'FAIL'::TEXT
    END,
    CASE 
      WHEN COUNT(*) = 0 THEN 'All foreign keys valid'::TEXT
      ELSE format('%s orphaned records found', COUNT(*))::TEXT
    END
  FROM todos t
  LEFT JOIN auth.users u ON t.user_id = u.id
  WHERE u.id IS NULL;
  
  -- Check data consistency
  RETURN QUERY
  SELECT 
    'Date Consistency Check'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'::TEXT
      ELSE 'FAIL'::TEXT
    END,
    CASE 
      WHEN COUNT(*) = 0 THEN 'All dates consistent'::TEXT
      ELSE format('%s records with invalid dates', COUNT(*))::TEXT
    END
  FROM todos
  WHERE (due_date IS NOT NULL AND due_date < created_at)
     OR (reminder_date IS NOT NULL AND reminder_date > due_date);
  
  -- Add more checks as needed
END;
$$ LANGUAGE plpgsql;
```

## Summary

This database design provides:
- **Scalability**: Partitioning and indexing strategies for growth
- **Security**: Comprehensive RLS policies and audit trails
- **Performance**: Optimized queries and caching mechanisms
- **Reliability**: Backup strategies and data validation
- **Flexibility**: Migration patterns for schema evolution

Key takeaways:
1. Always design with growth in mind
2. Security should be built-in, not added later
3. Performance optimization is an ongoing process
4. Regular backups and validation are critical
5. Document all design decisions for future reference

For more information:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase Database Guide](https://supabase.com/docs/guides/database)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)