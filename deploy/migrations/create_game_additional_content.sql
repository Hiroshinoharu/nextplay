CREATE TABLE IF NOT EXISTS game_additional_content (
    game_id INT NOT NULL,
    content_game_id INT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'additional_content',
    PRIMARY KEY (game_id, content_game_id, relation_type),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (content_game_id) REFERENCES games(game_id)
);

CREATE INDEX IF NOT EXISTS game_additional_content_content_idx
    ON game_additional_content (content_game_id);
