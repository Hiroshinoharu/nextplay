package db

import (
	"database/sql"

	"github.com/maxceban/nextplay/services/game/models"
)

// GetAllGames retrieves all games from the database
func GetAllGames() ([]models.Game, error) {
	query := `
		SELECT game_id, game_name, game_description, release_date, genre, publishers, story, cover_image_url
		FROM games;
	`

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var games []models.Game

	// Iterate over the rows and scan into Game structs
	for rows.Next() {
		var g models.Game
		var description sql.NullString
		var releaseDate sql.NullString
		var genre sql.NullString
		var publishers sql.NullString
		var story sql.NullString
		var coverImage []byte
		err := rows.Scan(
			&g.ID,
			&g.Name,
			&description,
			&releaseDate,
			&genre,
			&publishers,
			&story,
			&coverImage,
		)
		if err != nil {
			return nil, err
		}
		if description.Valid {
			g.Description = description.String
		}
		if releaseDate.Valid {
			g.ReleaseDate = releaseDate.String
		}
		if genre.Valid {
			g.Genre = genre.String
		}
		if publishers.Valid {
			g.Publishers = publishers.String
		}
		if story.Valid {
			g.Story = story.String
		}
		if len(coverImage) > 0 {
			g.CoverImageURL = string(coverImage)
		}
		g.Platforms = []int64{}
		g.Keywords = []int64{}
		g.Franchises = []int64{}
		g.Companies = []int64{}
		g.Series = []int64{}
		games = append(games, g)
	}
	return games, nil
}

// GetGameByID retrieves a game by its ID
func GetGameByID(id int) (*models.Game, error) {
	query := `
		SELECT game_id, game_name, game_description, release_date, genre, publishers, story, cover_image_url
		FROM games
		WHERE game_id = $1;
	`
	row := DB.QueryRow(query, id)

	var g models.Game
	var description sql.NullString
	var releaseDate sql.NullString
	var genre sql.NullString
	var publishers sql.NullString
	var story sql.NullString
	var coverImage []byte
	err := row.Scan(
		&g.ID,
		&g.Name,
		&description,
		&releaseDate,
		&genre,
		&publishers,
		&story,
		&coverImage,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if description.Valid {
		g.Description = description.String
	}
	if releaseDate.Valid {
		g.ReleaseDate = releaseDate.String
	}
	if genre.Valid {
		g.Genre = genre.String
	}
	if publishers.Valid {
		g.Publishers = publishers.String
	}
	if story.Valid {
		g.Story = story.String
	}
	if len(coverImage) > 0 {
		g.CoverImageURL = string(coverImage)
	}
	g.Platforms = []int64{}
	g.Keywords = []int64{}
	g.Franchises = []int64{}
	g.Companies = []int64{}
	g.Series = []int64{}

	return &g, nil
}

// CreateGame inserts a new game into the database
func CreateGame(g *models.Game) (int, error) {
	query := `
		INSERT INTO games (game_name, game_description, release_date, genre, publishers, story, cover_image_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING game_id;
	`

	var insertedID int
	err := DB.QueryRow(
		query,
		g.Name,
		g.Description,
		g.ReleaseDate,
		g.Genre,
		g.Publishers,
		g.Story,
		g.CoverImageURL,
	).Scan(&insertedID)
	if err != nil {
		return 0, err
	}

	return insertedID, nil
}

// UpdateGame updates an existing game in the database
func UpdateGame(id int, g *models.Game) error {
	query := `
		UPDATE games
		SET game_name = $1,
			game_description = $2,
			release_date = $3,
			genre = $4,
			publishers = $5,
			story = $6,
			cover_image_url = $7
		WHERE game_id = $8;
	`
	result, err := DB.Exec(
		query,
		g.Name,
		g.Description,
		g.ReleaseDate,
		g.Genre,
		g.Publishers,
		g.Story,
		g.CoverImageURL,
		id,
	)

	// Return any error encountered during execution
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// DeleteGame removes a game from the database
func DeleteGame(id int) error {
	query := `
		DELETE FROM games
		WHERE game_id = $1;
	`
	result, err := DB.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
