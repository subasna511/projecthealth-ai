CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS login_codes (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS login_codes_user_idx ON login_codes(user_id,created_at DESC);

-- Run this migration once for existing Phase 1 databases.
CREATE TABLE IF NOT EXISTS projects (
 id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name VARCHAR(150) NOT NULL, description TEXT NOT NULL DEFAULT '',
 due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_members (
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('owner','member')),
 PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS tasks (
 id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 title VARCHAR(200) NOT NULL, description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
 priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
 assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
 due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members(user_id);
