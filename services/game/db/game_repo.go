package db

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/maxceban/nextplay/services/game/models"
)

const nonBaseContentRegex = `(\m(dlc|downloadable content|expansion|expansion pack|add[- ]?on|bonus( content)?|soundtrack|artbook|season pass|character pass|battle pass|event pass|starter pack|founder.?s pack|cosmetic pack|skin( pack| set)?|costume( pack)?|outfit( pack)?|upgrade pack|item pack|consumable( pack)?|bundle|edition upgrade|currency pack|booster pack|mission pack|title update|content update|seasonal update|mid[- ]?season|live service|ranked split|rotation update|patch( v?[0-9]+)?|hotfix|content drop|episode[[:space:]]*[0-9ivxlcdm]+|season[[:space:]]*[0-9ivxlcdm]+|chapter[[:space:]]*[0-9ivxlcdm]+)\M)`

type QuestionnaireFacetGenre struct {
	Slug  string `json:"slug"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

type QuestionnaireFacetPlatform struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type QuestionnaireFacets struct {
	Genres    []QuestionnaireFacetGenre    `json:"genres"`
	Platforms []QuestionnaireFacetPlatform `json:"platforms"`
}

func GetQuestionnaireFacets() (*QuestionnaireFacets, error) {
	genresRows, err := DB.Query(
		`
		SELECT
			LOWER(TRIM(SPLIT_PART(genre, ',', 1))) AS slug,
			TRIM(SPLIT_PART(genre, ',', 1)) AS label,
			COUNT(*) AS game_count
		FROM games
		WHERE genre IS NOT NULL
		  AND TRIM(SPLIT_PART(genre, ',', 1)) <> ''
		  AND NOT (CONCAT_WS(' ', COALESCE(game_name, ''), COALESCE(genre, ''), COALESCE(game_description, '')) ~* '` + nonBaseContentRegex + `')
		GROUP BY slug, label
		ORDER BY game_count DESC, label ASC
		LIMIT 24
		`,
	)
	if err != nil {
		return nil, err
	}
	defer genresRows.Close()

	facets := &QuestionnaireFacets{
		Genres:    make([]QuestionnaireFacetGenre, 0, 24),
		Platforms: make([]QuestionnaireFacetPlatform, 0, 16),
	}

	for genresRows.Next() {
		var item QuestionnaireFacetGenre
		if err := genresRows.Scan(&item.Slug, &item.Label, &item.Count); err != nil {
			return nil, err
		}
		item.Label = strings.TrimSpace(item.Label)
		item.Slug = strings.TrimSpace(item.Slug)
		if item.Label == "" || item.Slug == "" {
			continue
		}
		facets.Genres = append(facets.Genres, item)
	}
	if err := genresRows.Err(); err != nil {
		return nil, err
	}

	platformRows, err := DB.Query(
		`
		SELECT
			p.platform_id,
			p.platform_name,
			COUNT(DISTINCT gp.game_id) AS game_count
		FROM platform p
		INNER JOIN game_platform gp ON gp.platform_id = p.platform_id
		INNER JOIN games g ON g.game_id = gp.game_id
		WHERE p.platform_name IS NOT NULL
		  AND TRIM(p.platform_name) <> ''
		  AND NOT (CONCAT_WS(' ', COALESCE(g.game_name, ''), COALESCE(g.genre, ''), COALESCE(g.game_description, '')) ~* '` + nonBaseContentRegex + `')
		GROUP BY p.platform_id, p.platform_name
		ORDER BY game_count DESC, p.platform_name ASC
		LIMIT 24
		`,
	)
	if err != nil {
		return nil, err
	}
	defer platformRows.Close()

	for platformRows.Next() {
		var item QuestionnaireFacetPlatform
		if err := platformRows.Scan(&item.ID, &item.Name, &item.Count); err != nil {
			return nil, err
		}
		item.Name = strings.TrimSpace(item.Name)
		if item.Name == "" {
			continue
		}
		facets.Platforms = append(facets.Platforms, item)
	}
	if err := platformRows.Err(); err != nil {
		return nil, err
	}

	return facets, nil
}

// GetGames retrieves a page of games from the database.
// Use includeMedia for detail-heavy responses; it is off by default for speed.
func GetGames(limit, offset int, includeMedia bool, upcomingOnly bool, searchQuery string, randomOrder bool, excludeNonBaseContent bool) ([]models.Game, error) {
	baseQuery := `
		SELECT game_id, game_name, game_description, release_date, genre, publishers, story, cover_image_url, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, popularity
		FROM games
	`
	whereParts := make([]string, 0, 4)
	args := make([]interface{}, 0, 5)

	if upcomingOnly {
		whereParts = append(whereParts, "release_date IS NOT NULL AND release_date > CURRENT_DATE")
	}
	if excludeNonBaseContent {
		whereParts = append(whereParts, `NOT (CONCAT_WS(' ', COALESCE(game_name, ''), COALESCE(genre, ''), COALESCE(game_description, '')) ~* '`+nonBaseContentRegex+`')`)
	}
	if strings.TrimSpace(searchQuery) != "" {
		args = append(args, "%"+strings.TrimSpace(searchQuery)+"%")
		searchArgPos := len(args)
		whereParts = append(
			whereParts,
			fmt.Sprintf(
				`(
					game_name ILIKE $%d
					OR genre ILIKE $%d
					OR publishers ILIKE $%d
					OR game_description ILIKE $%d
				)`,
				searchArgPos,
				searchArgPos,
				searchArgPos,
				searchArgPos,
			),
		)
	}

	if len(whereParts) > 0 {
		baseQuery += "\nWHERE " + strings.Join(whereParts, "\n  AND ")
	}
	if randomOrder {
		baseQuery += "\nORDER BY RANDOM()"
	} else if upcomingOnly {
		baseQuery += `
		ORDER BY
			release_date ASC,
			game_id ASC
	`
	} else {
		baseQuery += `
		ORDER BY
			COALESCE(popularity, 0 ) DESC,
			COALESCE(aggregated_rating_count, total_rating_count, 0) DESC,
			COALESCE(aggregated_rating, total_rating, 0) DESC,
			game_id ASC
	`
	}

	args = append(args, limit, offset)
	limitArgPos := len(args) - 1
	offsetArgPos := len(args)
	query := baseQuery + "\nLIMIT $" + strconv.Itoa(limitArgPos) + " OFFSET $" + strconv.Itoa(offsetArgPos) + ";"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}

	// Ensure the rows are closed when the function returns to prevent resource leaks
	defer rows.Close()

	// Preallocate a slice to hold the games, using the limit as the capacity for efficiency
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

		// Handle nullable fields appropriately and assign to the Game struct only if valid
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
		g.PlatformNames = []string{}
		g.Keywords = []int64{}
		g.Franchises = []int64{}
		g.Companies = []int64{}
		g.Series = []int64{}
		games = append(games, g)
	}
	return games, nil
}

// SearchGamesByName retrieves games by name ordered by game_id.
func SearchGamesByName(query string, mode string, limit int, offset int, includeMedia bool, excludeNonBaseContent bool) ([]models.Game, error) {
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return []models.Game{}, nil
	}
	if limit < 0 {
		limit = 0
	}
	if limit > 1000 {
		limit = 1000
	}
	if offset < 0 {
		offset = 0
	}

	whereClause := "g.game_name ILIKE $1"
	argValue := "%" + trimmedQuery + "%"
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "starts_with":
		whereClause = "g.game_name ILIKE $1"
		argValue = trimmedQuery + "%"
	case "exact":
		whereClause = "LOWER(g.game_name) = LOWER($1)"
		argValue = trimmedQuery
	default:
		whereClause = "g.game_name ILIKE $1"
		argValue = "%" + trimmedQuery + "%"
	}

	querySQL := `
		SELECT game_id, game_name, game_description, release_date, genre, publishers, story, cover_image_url, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, popularity
		FROM games g
		WHERE ` + whereClause + `
	`
	args := []interface{}{argValue}
	if excludeNonBaseContent {
		querySQL += "\n  AND NOT (CONCAT_WS(' ', COALESCE(g.game_name, ''), COALESCE(g.genre, ''), COALESCE(g.game_description, '')) ~* '" + nonBaseContentRegex + "')"
	}
	querySQL += "\nORDER BY g.game_id"
	if limit > 0 {
		args = append(args, limit, offset)
		querySQL += " LIMIT $" + strconv.Itoa(len(args)-1) + " OFFSET $" + strconv.Itoa(len(args)) + ";"
	} else if offset > 0 {
		args = append(args, offset)
		querySQL += " OFFSET $" + strconv.Itoa(len(args)) + ";"
	} else {
		querySQL += ";"
	}

	rows, err := DB.Query(querySQL, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	initialCap := limit
	if initialCap <= 0 {
		initialCap = 256
	}
	games := make([]models.Game, 0, initialCap)
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
		g.PlatformNames = []string{}
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

// GetPopularGames returns most popular games for a given release year based on IGDB popularity.
func GetPopularGames(year, limit, offset, minRatingCount int, includeMedia bool) ([]models.Game, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
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
		LIMIT $2 OFFSET $4;
	`

	rows, err := DB.Query(query, year, limit, minRatingCount, offset)
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
		g.PlatformNames = []string{}
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

// GetTopGames returns all-time top games using a weighted rating formula.
func GetTopGames(limit, offset, minRatingCount, priorVotes int, popularityWeight float64, includeMedia bool) ([]models.Game, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}
	if minRatingCount < 0 {
		minRatingCount = 0
	}
	if priorVotes <= 0 {
		priorVotes = 200
	}

	query := `
		WITH rated AS (
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
				g.popularity,
				CASE
					WHEN COALESCE(g.total_rating_count, 0) > 0 THEN COALESCE(g.total_rating, 0)
					WHEN COALESCE(g.aggregated_rating_count, 0) > 0 THEN COALESCE(g.aggregated_rating, 0)
					ELSE COALESCE(g.total_rating, g.aggregated_rating, 0)
				END::float8 AS rating,
				CASE
					WHEN COALESCE(g.total_rating_count, 0) > 0 THEN COALESCE(g.total_rating_count, 0)
					WHEN COALESCE(g.aggregated_rating_count, 0) > 0 THEN COALESCE(g.aggregated_rating_count, 0)
					ELSE 0
				END::float8 AS votes
			FROM games g
			WHERE g.release_date IS NOT NULL
			  AND g.release_date <= CURRENT_DATE
		),
		stats AS (
			SELECT COALESCE(AVG(r.rating), 0)::float8 AS c
			FROM rated r
			WHERE r.votes > 0
		)
		SELECT
			r.game_id,
			r.game_name,
			r.game_description,
			r.release_date,
			r.genre,
			r.publishers,
			r.story,
			r.cover_image_url,
			r.aggregated_rating,
			r.aggregated_rating_count,
			r.total_rating,
			r.total_rating_count,
			r.popularity
		FROM rated r
		CROSS JOIN stats s
		WHERE r.votes >= $3
		ORDER BY
			(
				((r.votes / (r.votes + $4::float8)) * r.rating) +
				(($4::float8 / (r.votes + $4::float8)) * s.c) +
				($5::float8 * COALESCE(r.popularity, 0))
			) DESC,
			r.votes DESC,
			r.rating DESC,
			r.game_id ASC
		LIMIT $1 OFFSET $2;
	`

	rows, err := DB.Query(query, limit, offset, minRatingCount, priorVotes, popularityWeight)
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
		g.PlatformNames = []string{}
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
	return GetGames(50, 0, false, false, "", false, false)
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
	g.PlatformNames = []string{}
	g.Keywords = []int64{}
	g.Franchises = []int64{}
	g.Companies = []int64{}
	g.Series = []int64{}

	return &g, nil
}

// GetRelatedAddOnContent returns related games from the same franchise (with series overlap as a tiebreaker).
func GetRelatedAddOnContent(gameID int, limit int, includeMedia bool) ([]models.Game, error) {
	if limit <= 0 {
		limit = 60
	}
	if limit > 200 {
		limit = 200
	}

	query := `
		WITH target_franchises AS (
			SELECT franchise_id
			FROM game_franchise
			WHERE game_id = $1
		),
		target_series AS (
			SELECT series_id
			FROM game_series
			WHERE game_id = $1
		),
		franchise_games AS (
			SELECT gf.game_id, COUNT(*) AS shared_franchise_count
			FROM game_franchise gf
			INNER JOIN target_franchises tf ON tf.franchise_id = gf.franchise_id
			WHERE gf.game_id <> $1
			GROUP BY gf.game_id
		),
		series_scores AS (
			SELECT gs.game_id, COUNT(*) AS shared_series_count
			FROM game_series gs
			INNER JOIN target_series ts ON ts.series_id = gs.series_id
			WHERE gs.game_id <> $1
			GROUP BY gs.game_id
		),
		scored AS (
			SELECT
				fg.game_id,
				fg.shared_franchise_count,
				COALESCE(ss.shared_series_count, 0) AS shared_series_count
			FROM franchise_games fg
			LEFT JOIN series_scores ss ON ss.game_id = fg.game_id
		)
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
		FROM scored s
		INNER JOIN games g ON g.game_id = s.game_id
		ORDER BY
			s.shared_franchise_count DESC,
			s.shared_series_count DESC,
			COALESCE(g.popularity, 0) DESC,
			COALESCE(g.aggregated_rating_count, g.total_rating_count, 0) DESC,
			g.game_id ASC
		LIMIT $2;
	`

	rows, err := DB.Query(query, gameID, limit)
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
		g.PlatformNames = []string{}
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

// CreateGame inserts a new game into the database
func CreateGame(g *models.Game) (int, error) {
	// Insert the new game record and return the generated game_id
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
	// Update the game record with the provided fields
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
func GetGameRelations(gameID int) ([]int64, []string, []int64, []int64, []int64, []int64, error) {
	// Fetch related entity IDs for platforms, keywords, franchises, companies, and series using a helper function to avoid code duplication
	platforms, err := fetchRelationIDs(`SELECT platform_id FROM game_platform WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	platformNames, err := fetchPlatformNames(gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	// Fetch keywords, franchises, companies, and series in a similar way
	keywords, err := fetchRelationIDs(`SELECT keyword_id FROM game_keywords WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	// Fetch franchises, companies, and series in a similar way
	franchises, err := fetchRelationIDs(`SELECT franchise_id FROM game_franchise WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	// Fetch
	companies, err := fetchRelationIDs(`SELECT company_id FROM game_companies WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}
	series, err := fetchRelationIDs(`SELECT series_id FROM game_series WHERE game_id=$1`, gameID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}
	return platforms, platformNames, keywords, franchises, companies, series, nil
}

func fetchPlatformNames(gameID int) ([]string, error) {
	rows, err := DB.Query(`
			SELECT p.platform_name FROM platform p
			INNER JOIN game_platform gp ON gp.platform_id = p.platform_id
			WHERE gp.game_id = $1
			ORDER BY p.platform_name
	`, gameID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	names := make([]string, 0)
	for rows.Next() {
		var name sql.NullString
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		if name.Valid {
			names = append(names, name.String)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return names, nil
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
