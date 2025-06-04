# データベース設計ドキュメント

このドキュメントでは、TODOアプリケーションのデータベースアーキテクチャ、設計決定、および最適化戦略について詳述します。

## 目次

1. [データベーススキーマ](#データベーススキーマ)
2. [設計原則](#設計原則)
3. [行レベルセキュリティ](#行レベルセキュリティ)
4. [パフォーマンス最適化](#パフォーマンス最適化)
5. [マイグレーション戦略](#マイグレーション戦略)
6. [バックアップとリカバリ](#バックアップとリカバリ)

## データベーススキーマ

### 現在のスキーマ概要

```sql
-- ユーザーテーブル（Supabase Authによって管理）
auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Supabaseによって管理される追加フィールド
)

-- TODOsテーブル
public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- インデックス
  INDEX idx_todos_user_id (user_id),
  INDEX idx_todos_created_at (created_at DESC)
)
```

### 高度な機能のための拡張スキーマ

```sql
-- カテゴリテーブル
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, name)
);

-- タグテーブル
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, name)
);

-- 拡張されたTODOsテーブル
ALTER TABLE todos ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 3);
ALTER TABLE todos ADD COLUMN due_date TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN reminder_date TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN notes TEXT;
ALTER TABLE todos ADD COLUMN position INTEGER DEFAULT 0;

-- タグの多対多関係
CREATE TABLE todo_tags (
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

-- 添付ファイルテーブル
CREATE TABLE todo_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- アクティビティログテーブル
CREATE TABLE todo_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'uncompleted', 'deleted')),
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- コラボレーションテーブル
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

## 設計原則

### 1. 正規化

データベースは第三正規形（3NF）の原則に従います：

- **重複データなし**: 各情報は一度だけ保存される
- **原子値**: 各列は分割不可能な値を含む
- **推移的従属なし**: 非キー属性は主キーのみに依存する

### 2. データ整合性

```sql
-- 制約でデータの一貫性を確保
ALTER TABLE todos ADD CONSTRAINT check_dates 
  CHECK (due_date IS NULL OR due_date > created_at);

ALTER TABLE todos ADD CONSTRAINT check_reminder 
  CHECK (reminder_date IS NULL OR due_date IS NULL OR reminder_date <= due_date);

-- 有効なメール形式を確保
ALTER TABLE auth.users ADD CONSTRAINT valid_email 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

### 3. 監査証跡

包括的な監査ログの実装：

```sql
-- 監査トリガー関数を作成
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

-- 監査トリガーを適用
CREATE TRIGGER audit_todos
  AFTER INSERT OR UPDATE OR DELETE ON todos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### 4. 論理削除

データリカバリのための論理削除の実装：

```sql
-- 論理削除用のカラムを追加
ALTER TABLE todos ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- アクティブなTODOのビューを作成
CREATE VIEW active_todos AS
  SELECT * FROM todos WHERE deleted_at IS NULL;

-- 論理削除関数
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

## 行レベルセキュリティ

### 基本的なRLSポリシー

```sql
-- RLSを有効化
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- TODOsの基本ポリシー
CREATE POLICY "Users can view own todos" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own todos" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos" ON todos
  FOR DELETE USING (auth.uid() = user_id);
```

### コラボレーションのための高度なRLS

```sql
-- ユーザーがTODOにアクセス権限があるかチェックする関数
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

-- コラボレーションポリシー
CREATE POLICY "Users can view shared todos" ON todos
  FOR SELECT USING (user_has_todo_access(id, 'view'));

CREATE POLICY "Users can update shared todos" ON todos
  FOR UPDATE USING (user_has_todo_access(id, 'edit'));
```

### RLSパフォーマンスの考慮事項

```sql
-- パフォーマンス向上のためのマテリアライズドビューを作成
CREATE MATERIALIZED VIEW user_todo_permissions AS
SELECT 
  t.id as todo_id,
  t.user_id as owner_id,
  c.user_id as collaborator_id,
  COALESCE(c.permission, 'owner') as permission
FROM todos t
LEFT JOIN todo_collaborators c ON t.id = c.todo_id
WHERE t.deleted_at IS NULL;

-- インデックスを作成
CREATE INDEX idx_user_todo_permissions ON user_todo_permissions(collaborator_id, todo_id);

-- 定期的にリフレッシュ
CREATE OR REPLACE FUNCTION refresh_permissions()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_todo_permissions;
END;
$$ LANGUAGE plpgsql;
```

## パフォーマンス最適化

### 1. インデックス戦略

```sql
-- 一般的なクエリのための複合インデックス
CREATE INDEX idx_todos_user_completed ON todos(user_id, completed);
CREATE INDEX idx_todos_user_created ON todos(user_id, created_at DESC);
CREATE INDEX idx_todos_user_due ON todos(user_id, due_date) WHERE due_date IS NOT NULL;

-- 特定の条件のための部分インデックス
CREATE INDEX idx_todos_active ON todos(user_id, created_at DESC) 
  WHERE completed = false AND deleted_at IS NULL;

CREATE INDEX idx_todos_overdue ON todos(user_id, due_date) 
  WHERE completed = false AND due_date < NOW() AND deleted_at IS NULL;

-- 全文検索インデックス
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

### 2. クエリ最適化

```sql
-- ダッシュボード用の最適化されたクエリ
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

### 3. キャッシュ戦略

```sql
-- 高コストな計算のためのキャッシュテーブルを作成
CREATE TABLE user_stats_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_todos INTEGER DEFAULT 0,
  completed_todos INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_activity TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TODO変更時にキャッシュを更新
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

### 4. スケールのためのパーティション化

```sql
-- 大規模データセットのために年でTODOsテーブルをパーティション化
CREATE TABLE todos_partitioned (
  LIKE todos INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- パーティションを作成
CREATE TABLE todos_2024 PARTITION OF todos_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE todos_2025 PARTITION OF todos_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 自動パーティション作成
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

## マイグレーション戦略

### 1. スキーマのバージョン管理

```sql
-- マイグレーションテーブルを作成
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- マイグレーション例
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1) THEN
    -- 優先度カラムを追加
    ALTER TABLE todos ADD COLUMN priority INTEGER DEFAULT 0;
    
    -- マイグレーションを記録
    INSERT INTO schema_migrations (version, name) 
    VALUES (1, 'add_priority_to_todos');
  END IF;
END $$;
```

### 2. ゼロダウンタイムマイグレーション

```sql
-- ステップ1: 新しいカラムを追加（ノンブロッキング）
ALTER TABLE todos ADD COLUMN new_title TEXT;

-- ステップ2: データをバックフィル
UPDATE todos SET new_title = title WHERE new_title IS NULL;

-- ステップ3: NOT NULL制約を追加
ALTER TABLE todos ALTER COLUMN new_title SET NOT NULL;

-- ステップ4: 新しいカラムに切り替え
BEGIN;
ALTER TABLE todos RENAME COLUMN title TO old_title;
ALTER TABLE todos RENAME COLUMN new_title TO title;
COMMIT;

-- ステップ5: 古いカラムを削除（検証後）
ALTER TABLE todos DROP COLUMN old_title;
```

### 3. データマイグレーションパターン

```sql
-- 大規模マイグレーションのためのバッチ処理
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
    
    -- 過負荷を防ぐために一時停止
    PERFORM pg_sleep(0.1);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## バックアップとリカバリ

### 1. 自動バックアップ戦略

```sql
-- バックアップメタデータテーブルを作成
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

-- バックアップ関数
CREATE OR REPLACE FUNCTION create_backup(p_backup_type TEXT)
RETURNS UUID AS $$
DECLARE
  backup_id UUID;
BEGIN
  INSERT INTO backup_history (backup_type) 
  VALUES (p_backup_type) 
  RETURNING id INTO backup_id;
  
  -- 実際のバックアップは外部プロセスで処理される
  -- これは追跡のためのみ
  
  RETURN backup_id;
END;
$$ LANGUAGE plpgsql;
```

### 2. ポイントインタイムリカバリ

```sql
-- PITRのために論理レプリケーションを有効化
ALTER SYSTEM SET wal_level = 'logical';
ALTER SYSTEM SET max_replication_slots = 10;

-- レプリケーションスロットを作成
SELECT pg_create_logical_replication_slot('todo_app_slot', 'pgoutput');
```

### 3. データ検証

```sql
-- データ整合性を検証
CREATE OR REPLACE FUNCTION validate_database_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- 外部キー整合性をチェック
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
  
  -- データ一貫性をチェック
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
  
  -- 必要に応じて追加のチェックを行う
END;
$$ LANGUAGE plpgsql;
```

## まとめ

このデータベース設計は以下を提供します：
- **スケーラビリティ**: 成長のためのパーティション化とインデックス戦略
- **セキュリティ**: 包括的なRLSポリシーと監査証跡
- **パフォーマンス**: 最適化されたクエリとキャッシュメカニズム
- **信頼性**: バックアップ戦略とデータ検証
- **柔軟性**: スキーマ進化のためのマイグレーションパターン

重要なポイント：
1. 常に成長を念頭に置いて設計する
2. セキュリティは後から追加するのではなく、組み込むべきもの
3. パフォーマンス最適化は継続的なプロセス
4. 定期的なバックアップと検証が重要
5. 将来の参考のためにすべての設計決定を文書化する

詳細については：
- [PostgreSQLドキュメント](https://www.postgresql.org/docs/)
- [Supabaseデータベースガイド](https://supabase.com/docs/guides/database)
- [データベース設計のベストプラクティス](https://www.postgresql.org/docs/current/ddl.html)