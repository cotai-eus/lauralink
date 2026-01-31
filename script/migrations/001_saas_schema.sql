-- Lauralink SaaS Migration v1
-- Multi-tenant support with user management and file status tracking

-- Users table for SaaS multi-tenancy
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  plan_tier TEXT DEFAULT 'free' CHECK(plan_tier IN ('free', 'pro', 'enterprise')),
  storage_used_bytes INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Enhanced files table with SaaS fields
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with constraints well
-- So we create a new table if starting fresh, or use the migration approach below

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'deleted')),
  is_public INTEGER DEFAULT 1,
  expires_at INTEGER,
  downloads_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Access logs for analytics
CREATE TABLE IF NOT EXISTS access_logs (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id),
  ip_address TEXT,
  user_agent TEXT,
  country_code TEXT,
  accessed_at INTEGER DEFAULT (unixepoch())
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_file_id ON access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
