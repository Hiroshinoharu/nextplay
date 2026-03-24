CREATE TABLE IF NOT EXISTS game_platform (
    game_id INT NOT NULL,
    platform_id INT NOT NULL,
    PRIMARY KEY (game_id, platform_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (platform_id) REFERENCES platform(platform_id)
);

CREATE TABLE IF NOT EXISTS game_keywords (
    game_id INT NOT NULL,
    keyword_id INT NOT NULL,
    PRIMARY KEY (game_id, keyword_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (keyword_id) REFERENCES keyword(keyword_id)
);

CREATE TABLE IF NOT EXISTS game_franchise (
    game_id INT NOT NULL,
    franchise_id INT NOT NULL,
    PRIMARY KEY (game_id, franchise_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (franchise_id) REFERENCES franchise(franchise_id)
);

CREATE TABLE IF NOT EXISTS game_series (
    game_id INT NOT NULL,
    series_id INT NOT NULL,
    PRIMARY KEY (game_id, series_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (series_id) REFERENCES series(series_id)
);

CREATE TABLE IF NOT EXISTS game_companies (
    game_id INT NOT NULL,
    company_id INT NOT NULL,
    is_developer BOOLEAN NOT NULL DEFAULT FALSE,
    is_publisher BOOLEAN NOT NULL DEFAULT FALSE,
    is_supporting_developer BOOLEAN NOT NULL DEFAULT FALSE,
    is_porting_developer BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (game_id, company_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (company_id) REFERENCES company(company_id)
);
