-- ============================================================
-- NEXTPLAY DATABASE SCHEMA (PostgreSQL Modernized Version)
-- Author: Max Ceban
-- Purpose: Core relational schema for game, user, and metadata
-- ============================================================

DROP TABLE IF EXISTS game_series CASCADE;
DROP TABLE IF EXISTS game_media CASCADE;
DROP TABLE IF EXISTS game_genre CASCADE;
DROP TABLE IF EXISTS game_keywords CASCADE;
DROP TABLE IF EXISTS game_franchise CASCADE;
DROP TABLE IF EXISTS game_platform CASCADE;
DROP TABLE IF EXISTS game_companies CASCADE;
DROP TABLE IF EXISTS user_interactions CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;
DROP TABLE IF EXISTS keyword CASCADE;
DROP TABLE IF EXISTS genre CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS series CASCADE;
DROP TABLE IF EXISTS platform CASCADE;
DROP TABLE IF EXISTS franchise CASCADE;
DROP TABLE IF EXISTS company CASCADE;


-- ============================================================
-- TABLE: company
-- Purpose: Stores developers, publishers, and supporting studios
-- ============================================================
CREATE TABLE company (
    company_id        SERIAL PRIMARY KEY,
    igdb_id           INT UNIQUE,
    company_name      TEXT NOT NULL,
    company_logo      BYTEA,          -- image bytes for logo
    company_description TEXT,          -- overview of company
    country           TEXT,            -- studio origin
    date_started      DATE,            -- founding year
    games_contributed TEXT,            -- optional: list of titles (or remove)
    website           TEXT             -- official website URL
);

-- ============================================================
-- TABLE: franchise
-- Purpose: Represents large IPs (e.g., Zelda, Final Fantasy)
-- ============================================================
CREATE TABLE franchise (
    franchise_id SERIAL PRIMARY KEY,
    igdb_id      INT UNIQUE,
    name         TEXT
);

-- ============================================================
-- TABLE: platform
-- Purpose: Holds gaming platforms (PC, Switch, PS5, etc.)
-- ============================================================
CREATE TABLE platform (
    platform_id   SERIAL PRIMARY KEY,
    igdb_id       INT UNIQUE,
    platform_name TEXT,
    manufacturer  TEXT,
    icon_url      TEXT,       -- optional icon URL
    description   TEXT,
    product_url   TEXT
);

-- Legacy compatibility view for older queries that reference "platforms".
CREATE VIEW platforms AS
    SELECT * FROM platform;

-- ============================================================
-- TABLE: series
-- Purpose: Represents game series (e.g., The Witcher series)
-- ============================================================
CREATE TABLE series (
    series_id SERIAL PRIMARY KEY,
    igdb_id   INT UNIQUE,
    name      TEXT
);

-- ============================================================
-- TABLE: genre
-- Purpose: IGDB genres
-- ============================================================
CREATE TABLE genre (
    genre_id   SERIAL PRIMARY KEY,
    igdb_id    INT UNIQUE,
    genre_name TEXT
);

-- ============================================================
-- TABLE: game
-- Purpose: Main table containing game metadata
-- ============================================================
CREATE TABLE games (
    game_id          SERIAL PRIMARY KEY,
    igdb_id          INT UNIQUE,
    game_name        TEXT,
    game_description TEXT,
    release_date     DATE,
    genre            TEXT,        -- JSON array recommended later
    publishers       TEXT,
    cover_image_url  TEXT,       -- image URL
    aggregated_rating FLOAT,
    aggregated_rating_count INT,
    story            TEXT
);

-- ============================================================
-- TABLE: keyword
-- Purpose: IGDB-style gameplay tags / keywords (e.g., "open world")
-- ============================================================
CREATE TABLE keyword (
    keyword_id   SERIAL PRIMARY KEY,
    igdb_id      INT UNIQUE,
    keyword_name TEXT
);

-- ============================================================
-- TABLE: app_user
-- Purpose: Users of NextPlay platform
-- ============================================================
CREATE TABLE app_user (
    user_id    SERIAL PRIMARY KEY,
    username   TEXT NOT NULL,
    password   TEXT NOT NULL,        -- hashed password
    email      TEXT NOT NULL,
    steam_linked BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- TABLE: user_interactions
-- Purpose: Links users to games with ratings, likes, reviews
-- Composite Primary Key: (user_id, game_id)
-- ============================================================
CREATE TABLE user_interactions (
    user_id   INT NOT NULL,
    game_id   INT NOT NULL,
    rating    FLOAT,
    review    TEXT,
    liked     BOOLEAN,
    favorited BOOLEAN,
    timestamp TIMESTAMPTZ,       -- Timezone aware

    PRIMARY KEY (user_id, game_id),
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id)
);


-- ============================================================
-- TABLE: recommendation_events
-- Purpose: Stores recommendation exposures and feedback events for tuning
-- ============================================================
CREATE TABLE recommendation_events (
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

CREATE INDEX recommendation_events_user_created_idx
    ON recommendation_events (user_id, created_at DESC);

CREATE INDEX recommendation_events_request_idx
    ON recommendation_events (request_id);

-- ============================================================
