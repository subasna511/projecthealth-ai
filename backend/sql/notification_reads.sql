
CREATE TABLE IF NOT EXISTS notification_reads (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_key TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_key)
);
