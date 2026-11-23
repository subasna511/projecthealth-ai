
CREATE TABLE IF NOT EXISTS asana_connections (
  user_id UUID PRIMARY KEY
    REFERENCES users(id) ON DELETE CASCADE,

  asana_user_gid TEXT NOT NULL,
  asana_user_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,

  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asana_oauth_states (
  state_hash TEXT PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  code_verifier_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asana_oauth_states_expires_idx
ON asana_oauth_states(expires_at);
