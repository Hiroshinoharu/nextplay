package db

import (
	"database/sql"

	"github.com/maxceban/nextplay/services/game/models"
)

// GetAllGames retrieves all games from the database
func GetAllGames() ([]models.Game, error) {
	query := `
		SELECT game_id, game_name, game_description, release_date, publishers, story
		FROM games;
	`

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var games []models.Game

	for rows.Next() {
		var g models.Game
		err := rows.Scan(
			&g.ID,
			&g.Name,
			&g.Description,
			&g.ReleaseDate,
			&g.Publishers,
			&g.Story,
		)
		if err != nil {
			return nil, err
		}
		games = append(games, g)
	}
	return games, nil
}

// GetGameByID retrieves a game by its ID
func GetGameByID(id int) (*models.Game, error) {
	query := `
		SELECT game_id, game_name, game_description, release_date, publishers, story
		FROM games
		WHERE game_id = $1;
	`
	row := DB.QueryRow(query, id)

	var g models.Game
	err := row.Scan(
		&g.ID,
		&g.Name,
		&g.Description,
		&g.ReleaseDate,
		&g.Publishers,
		&g.Story,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &g, nil
}

// CreateGame inserts a new game into the database
func CreateGame(g *models.Game) (int, error) {
	query := `
		INSERT INTO games (game_name, game_description, release_date, genre, publishers, story, cover_image)
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
