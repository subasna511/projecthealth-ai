-- Store push subscriptions for individual users and devices
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
ON push_subscriptions(user_id);

-- Track reminder delivery attempts and prevent duplicate reminders
CREATE TABLE IF NOT EXISTS push_notification_log (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_key TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    task_id UUID NULL,
    project_id UUID NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_push_notification_log_user
ON push_notification_log(user_id);