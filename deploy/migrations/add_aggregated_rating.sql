ALTER TABLE games ADD COLUMN IF NOT EXISTS aggregated_rating FLOAT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS aggregated_rating_count INT;
