package db

import (
	"database/sql"

	"github.com/maxceban/nextplay/services/game/models"
)

// GetGames retrieves a page of games from the database.
// Use includeMedia for detail-heavy responses; it is off by default for speed.
func GetGames(limit, offset int, includeMedia bool) ([]models.Game, error) {
	query := `
		SELECT game_id, game_name, game_description, release_date, genre, publishers, story, cover_image_url, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, popularity
		FROM games
		ORDER BY game_id
		LIMIT $1 OFFSET $2;
	`

	rows, err := DB.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	games := make([]models.Game, 0, limit)

	// Iterate over the rows and scan into Game structs
	for rows.Next() {
		var g models.Game
		var description sql.NullString
		var releaseDate sql.NullString
		var genre sql.NullString
		var publishers sql.NullString
		var story sql.NullString
		var coverImage sql.NullString
		var aggregatedRating sql.NullFloat64
		var aggregatedRatingCount sql.NullInt64
		var totalRating sql.NullFloat64
		var totalRatingCount sql.NullInt64
		var popularity sql.NullFloat64
		err := rows.Scan(
			&g.ID,
			&g.Name,
			&description,
			&releaseDate,
			&genre,
			&publishers,
			&story,
			&coverImage,
			&aggregatedRating,
			&aggregatedRatingCount,
			&totalRating,
			&totalRatingCount,
			&popularity,
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
		if coverImage.Valid {
			g.CoverImageURL = coverImage.String
		}
		if aggregatedRating.Valid {
			g.AggregatedRating = aggregatedRating.Float64
		}
		if aggregatedRatingCount.Valid {
			g.AggregatedRatingCount = int(aggregatedRatingCount.Int64)
		}
		if totalRating.Valid {
			g.TotalRating = totalRating.Float64
		}
		if totalRatingCount.Valid {
			g.TotalRatingCount = int(totalRatingCount.Int64)
		}
		if popularity.Valid {
			g.Popularity = popularity.Float64
		}
		if includeMedia {
			media, err := GetGameMedia(int(g.ID))
			if err != nil {
				return nil, err
			}
			g.Media = media
		} else {
			g.Media = []models.GameMedia{}
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

// GetPopularGames returns most popular games for a given release year based on IGDB popularity.
func GetPopularGames(year, limit, minRatingCount int) ([]models.Game, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}
	if minRatingCount < 0 {
		minRatingCount = 0
	}
	query := `
		SELECT
			g.game_id,
			g.game_name,
			g.game_description,
			g.release_date,
			g.genre,
			g.publishers,
			g.story,
			g.cover_image_url,
			g.aggregated_rating,
			g.aggregated_rating_count,
			g.total_rating,
			g.total_rating_count,
			g.popularity
		FROM games g
		WHERE ($1 = 0 OR EXTRACT(YEAR FROM g.release_date) = $1)
		  AND COALESCE(g.aggregated_rating_count, g.total_rating_count, 0) >= $3
		GROUP BY g.game_id
		ORDER BY
			COALESCE(g.popularity, 0) DESC,
			COALESCE(g.aggregated_rating_count, g.total_rating_count, 0) DESC,
			COALESCE(g.aggregated_rating, g.total_rating, 0) DESC,
			g.game_id
		LIMIT $2;
	`

	rows, err := DB.Query(query, year, limit, minRatingCount)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	games := make([]models.Game, 0, limit)
	for rows.Next() {
		var g models.Game
		var description sql.NullString
		var releaseDate sql.NullString
		var genre sql.NullString
		var publishers sql.NullString
		var story sql.NullString
		var coverImage sql.NullString
		var aggregatedRating sql.NullFloat64
		var aggregatedRatingCount sql.NullInt64
		var totalRating sql.NullFloat64
		var totalRatingCount sql.NullInt64
		var popularity sql.NullFloat64
		err := rows.Scan(
			&g.ID,
			&g.Name,
			&description,
			&releaseDate,
			&genre,
			&publishers,
			&story,
			&coverImage,
			&aggregatedRating,
			&aggregatedRatingCount,
			&totalRating,
			&totalRatingCount,
			&popularity,
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
		if coverImage.Valid {
			g.CoverImageURL = coverImage.String
		}
		if aggregatedRating.Valid {
			g.AggregatedRating = aggregatedRating.Float64
		}
		if aggregatedRatingCount.Valid {
			g.AggregatedRatingCount = int(aggregatedRatingCount.Int64)
		}
		if totalRating.Valid {
			g.TotalRating = totalRating.Float64
		}
		if totalRatingCount.Valid {
			g.TotalRatingCount = int(totalRatingCount.Int64)
		}
		if popularity.Valid {
			g.Popularity = popularity.Float64
		}
		g.Media = []models.GameMedia{}
		g.Platforms = []int64{}
		g.Keywords = []int64{}
		g.Franchises = []int64{}
		g.Companies = []int64{}
		g.Series = []int64{}
		games = append(games, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return games, nil
}

// GetAllGames returns a default-sized page for backward compatibility.
func GetAllGames() ([]models.Game, error) {
	return GetGames(50, 0, false)
}

// GetGameByID retrieves a game by its ID
func GetGameByID(id int) (*models.Game, error) {
	query := `
		SELECT game_id, game_name, game_description, release_date, genre, publishers, story, cover_image_url, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, popularity
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
	var coverImage sql.NullString
	var aggregatedRating sql.NullFloat64
	var aggregatedRatingCount sql.NullInt64
	var totalRating sql.NullFloat64
	var totalRatingCount sql.NullInt64
	var popularity sql.NullFloat64
	err := row.Scan(
		&g.ID,
		&g.Name,
		&description,
		&releaseDate,
		&genre,
		&publishers,
		&story,
		&coverImage,
		&aggregatedRating,
		&aggregatedRatingCount,
		&totalRating,
		&totalRatingCount,
		&popularity,
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
	if coverImage.Valid {
		g.CoverImageURL = coverImage.String
	}
	if aggregatedRating.Valid {
		g.AggregatedRating = aggregatedRating.Float64
	}
	if aggregatedRatingCount.Valid {
		g.AggregatedRatingCount = int(aggregatedRatingCount.Int64)
	}
	if totalRating.Valid {
		g.TotalRating = totalRating.Float64
	}
	if totalRatingCount.Valid {
		g.TotalRatingCount = int(totalRatingCount.Int64)
	}
	if popularity.Valid {
		g.Popularity = popularity.Float64
	}
	g.Media = []models.GameMedia{}
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

// GetGameMedia retrieves media rows for a given game.
func GetGameMedia(gameID int) ([]models.GameMedia, error) {
	rows, err := DB.Query(
		`SELECT igdb_id, media_type, url, sort_order
		 FROM game_media
		 WHERE game_id = $1
		 ORDER BY media_type, sort_order, igdb_id`,
		gameID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	media := make([]models.GameMedia, 0)
	for rows.Next() {
		var item models.GameMedia
		var igdbID sql.NullInt64
		var sortOrder sql.NullInt64
		if err := rows.Scan(&igdbID, &item.MediaType, &item.URL, &sortOrder); err != nil {
			return nil, err
		}
		if igdbID.Valid {
			item.IGDBID = igdbID.Int64
		}
		if sortOrder.Valid {
			item.SortOrder = int(sortOrder.Int64)
		}
		media = append(media, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return media, nil
}

// GetGameRelations retrieves all related entity IDs for a given game
func GetGameRelations(gameID int) ([]int64, []int64, []int64, []int64, []int64, error) {
	platforms, err := fetchRelationIDs(`SELECT platform_id FROM game_platform WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	keywords, err := fetchRelationIDs(`SELECT keyword_id FROM game_keywords WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	franchises, err := fetchRelationIDs(`SELECT franchise_id FROM game_franchise WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	companies, err := fetchRelationIDs(`SELECT company_id FROM game_companies WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	series, err := fetchRelationIDs(`SELECT series_id FROM game_series WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	return platforms, keywords, franchises, companies, series, nil
}

// Helper function to fetch relation IDs
func fetchRelationIDs(query string, args ...interface{}) ([]int64, error) {
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}
