ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_deletion_audit (
    audit_id    SERIAL PRIMARY KEY,
    user_id     INT NOT NULL,
    username    TEXT NOT NULL,
    email       TEXT NOT NULL,
    deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
