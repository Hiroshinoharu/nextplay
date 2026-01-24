BEGIN;

-- Add IGDB identifiers (nullable for backfill)
ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_id INT;
ALTER TABLE platform ADD COLUMN IF NOT EXISTS igdb_id INT;
ALTER TABLE keyword ADD COLUMN IF NOT EXISTS igdb_id INT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS igdb_id INT;
ALTER TABLE series ADD COLUMN IF NOT EXISTS igdb_id INT;
ALTER TABLE franchise ADD COLUMN IF NOT EXISTS igdb_id INT;

-- Company name (required for IGDB mapping; keep nullable for existing rows)
ALTER TABLE company ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Convert games.cover_image_url BYTEA -> TEXT when needed (preserve original as cover_image_blob)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'games'
      AND column_name = 'cover_image_url'
      AND data_type = 'bytea'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'games'
        AND column_name = 'cover_image_url_text'
    ) THEN
      ALTER TABLE games ADD COLUMN cover_image_url_text TEXT;
    END IF;

    UPDATE games
    SET cover_image_url_text = convert_from(cover_image_url, 'UTF8')
    WHERE cover_image_url IS NOT NULL
      AND cover_image_url_text IS NULL;

    ALTER TABLE games RENAME COLUMN cover_image_url TO cover_image_blob;
    ALTER TABLE games RENAME COLUMN cover_image_url_text TO cover_image_url;
  END IF;
END$$;

-- Convert platform.icon_url BYTEA -> TEXT when needed (preserve original as icon_blob)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'platform'
      AND column_name = 'icon_url'
      AND data_type = 'bytea'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'platform'
        AND column_name = 'icon_url_text'
    ) THEN
      ALTER TABLE platform ADD COLUMN icon_url_text TEXT;
    END IF;

    UPDATE platform
    SET icon_url_text = convert_from(icon_url, 'UTF8')
    WHERE icon_url IS NOT NULL
      AND icon_url_text IS NULL;

    ALTER TABLE platform RENAME COLUMN icon_url TO icon_blob;
    ALTER TABLE platform RENAME COLUMN icon_url_text TO icon_url;
  END IF;
END$$;

-- New genre table + join table
CREATE TABLE IF NOT EXISTS genre (
    genre_id   SERIAL PRIMARY KEY,
    igdb_id    INT,
    genre_name TEXT
);

CREATE TABLE IF NOT EXISTS game_genre (
    game_id  INT NOT NULL,
    genre_id INT NOT NULL,
    PRIMARY KEY (game_id, genre_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (genre_id) REFERENCES genre(genre_id)
);

-- Media table for screenshots/artworks/trailers
CREATE TABLE IF NOT EXISTS game_media (
    media_id   SERIAL PRIMARY KEY,
    game_id    INT NOT NULL,
    igdb_id    INT,
    media_type TEXT NOT NULL,
    url        TEXT NOT NULL,
    sort_order INT,
    FOREIGN KEY (game_id) REFERENCES games(game_id)
);

-- Unique indexes for IGDB IDs (will fail if duplicates exist)
CREATE UNIQUE INDEX IF NOT EXISTS games_igdb_id_uq ON games(igdb_id);
CREATE UNIQUE INDEX IF NOT EXISTS platform_igdb_id_uq ON platform(igdb_id);
CREATE UNIQUE INDEX IF NOT EXISTS keyword_igdb_id_uq ON keyword(igdb_id);
CREATE UNIQUE INDEX IF NOT EXISTS company_igdb_id_uq ON company(igdb_id);
CREATE UNIQUE INDEX IF NOT EXISTS series_igdb_id_uq ON series(igdb_id);
CREATE UNIQUE INDEX IF NOT EXISTS franchise_igdb_id_uq ON franchise(igdb_id);
CREATE UNIQUE INDEX IF NOT EXISTS genre_igdb_id_uq ON genre(igdb_id);

COMMIT;
