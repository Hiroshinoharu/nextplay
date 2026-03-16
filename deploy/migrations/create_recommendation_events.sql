CREATE TABLE IF NOT EXISTS recommendation_events (
    event_id             SERIAL PRIMARY KEY,
    user_id              INT NOT NULL,
    game_id              INT NOT NULL,
    request_id           TEXT NOT NULL DEFAULT '',
    event_type           TEXT NOT NULL,
    model_version        TEXT,
    ranking_profile      TEXT,
    strategy             TEXT,
    outcome              TEXT,
    recommendation_rank  INT,
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id)
);

CREATE INDEX IF NOT EXISTS recommendation_events_user_created_idx
    ON recommendation_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recommendation_events_request_idx
    ON recommendation_events (request_id);
