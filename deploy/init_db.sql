-- ============================================================
-- NEXTPLAY DATABASE SCHEMA (PostgreSQL Modernized Version)
-- Author: Max Ceban
-- Purpose: Core relational schema for game, user, and metadata
-- ============================================================

-- ============================================================
-- TABLE: company
-- Purpose: Stores developers, publishers, and supporting studios
-- ============================================================
CREATE TABLE company (
    company_id        SERIAL PRIMARY KEY,
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
    name         TEXT
);

-- ============================================================
-- TABLE: platform
-- Purpose: Holds gaming platforms (PC, Switch, PS5, etc.)
-- ============================================================
CREATE TABLE platform (
    platform_id   SERIAL PRIMARY KEY,
    platform_name TEXT,
    manufacturer  TEXT,
    icon_url      BYTEA,       -- optional icon
    description   TEXT,
    product_url   TEXT
);

-- ============================================================
-- TABLE: series
-- Purpose: Represents game series (e.g., The Witcher series)
-- ============================================================
CREATE TABLE series (
    series_id SERIAL PRIMARY KEY,
    name      TEXT
);

-- ============================================================
-- TABLE: game
-- Purpose: Main table containing game metadata
-- ============================================================
CREATE TABLE game (
    game_id          SERIAL PRIMARY KEY,
    game_name        TEXT,
    game_description TEXT,
    release_date     DATE,
    genre            TEXT,        -- JSON array recommended later
    publishers       TEXT,
    cover_image_url  BYTEA,       -- image bytes
    story            TEXT
);

-- ============================================================
-- TABLE: keyword
-- Purpose: IGDB-style gameplay tags / keywords (e.g., "open world")
-- ============================================================
CREATE TABLE keyword (
    keyword_id   SERIAL PRIMARY KEY,
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
    FOREIGN KEY (game_id) REFERENCES game(game_id)
);

-- ============================================================
-- TABLE: user_keyword_preferences
-- Purpose: Personalized keyword affinity scores
-- ============================================================
CREATE TABLE user_keyword_preferences (
    user_id          INT NOT NULL,
    keyword_id       INT NOT NULL,
    preference_score INT NOT NULL,   -- could be -10 → +10 or 0 → 100

    PRIMARY KEY (user_id, keyword_id),
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (keyword_id) REFERENCES keyword(keyword_id)
);

-- ============================================================
-- TABLE: user_platform_preferences
-- Purpose: User preference for certain platforms
-- ============================================================
CREATE TABLE user_platform_preferences (
    user_id          INT NOT NULL,
    platform_id      INT NOT NULL,
    preference_score INT NOT NULL,

    PRIMARY KEY (user_id, platform_id),
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (platform_id) REFERENCES platform(platform_id)
);

-- ============================================================
-- TABLE: game_companies
-- Purpose: Connects games to developers/publishers & roles
-- ============================================================
CREATE TABLE game_companies (
    game_id    INT NOT NULL,
    company_id INT NOT NULL,

    is_developer            BOOLEAN DEFAULT FALSE,
    is_publisher            BOOLEAN DEFAULT FALSE,
    is_supporting_developer BOOLEAN DEFAULT FALSE,
    is_porting_developer    BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (game_id, company_id),
    FOREIGN KEY (game_id) REFERENCES game(game_id),
    FOREIGN KEY (company_id) REFERENCES company(company_id)
);

-- ============================================================
-- TABLE: game_platform
-- Purpose: Many-to-many table linking games and platforms
-- ============================================================
CREATE TABLE game_platform (
    game_id     INT NOT NULL,
    platform_id INT NOT NULL,

    PRIMARY KEY (game_id, platform_id),
    FOREIGN KEY (game_id) REFERENCES game(game_id),
    FOREIGN KEY (platform_id) REFERENCES platform(platform_id)
);

-- ============================================================
-- TABLE: game_franchise
-- Purpose: Many-to-many table linking games to franchises
-- ============================================================
CREATE TABLE game_franchise (
    franchise_id INT NOT NULL,
    game_id      INT NOT NULL,

    PRIMARY KEY (franchise_id, game_id),
    FOREIGN KEY (franchise_id) REFERENCES franchise(franchise_id),
    FOREIGN KEY (game_id) REFERENCES game(game_id)
);

-- ============================================================
-- TABLE: game_keywords
-- Purpose: Many-to-many table between games and keywords
-- ============================================================
CREATE TABLE game_keywords (
    game_id    INT NOT NULL,
    keyword_id INT NOT NULL,

    PRIMARY KEY (game_id, keyword_id),
    FOREIGN KEY (game_id) REFERENCES game(game_id),
    FOREIGN KEY (keyword_id) REFERENCES keyword(keyword_id)
);

-- ============================================================
-- TABLE: game_series
-- Purpose: Many-to-many linking games to multi-title game series
-- ============================================================
CREATE TABLE game_series (
    series_id INT NOT NULL,
    game_id   INT NOT NULL,

    PRIMARY KEY (series_id, game_id),
    FOREIGN KEY (series_id) REFERENCES series(series_id),
    FOREIGN KEY (game_id) REFERENCES game(game_id)
);