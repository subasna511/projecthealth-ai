
CREATE TABLE IF NOT EXISTS asana_project_links (
  id BIGSERIAL PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  asana_project_gid TEXT NOT NULL,

  project_id UUID NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,

  last_synced_at TIMESTAMPTZ,

  UNIQUE(user_id, asana_project_gid),
  UNIQUE(project_id)
);

CREATE TABLE IF NOT EXISTS asana_task_links (
  id BIGSERIAL PRIMARY KEY,

  project_link_id BIGINT NOT NULL
    REFERENCES asana_project_links(id) ON DELETE CASCADE,

  asana_task_gid TEXT NOT NULL,

  task_id UUID NOT NULL
    REFERENCES tasks(id) ON DELETE CASCADE,

  UNIQUE(project_link_id, asana_task_gid),
  UNIQUE(task_id)
);
