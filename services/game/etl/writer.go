package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/lib/pq"
)

// DBTX exposes the query methods needed by the ETL writers.
// *sql.DB and *sql.Tx both satisfy this interface.
type DBTX interface {
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
}

// bulk upserts named entities (like genres, platforms, keywords) into the specified table
// upsertNamedRows bulk upserts rows with igdb_id and returns a map of igdb_id -> db_id.
func upsertNamedRows(tx DBTX, table, column string, source map[int]string) (map[int]int, error) {
	// Prepare output map of igdb_id to db_id (hashmap)
	out := make(map[int]int, len(source))
	if len(source) == 0 {
		return out, nil
	}

	// Prepare slices for IDs and names
	ids := make([]int, 0, len(source))
	names := make([]string, 0, len(source))
	for igdbID, name := range source {
		clean := strings.TrimSpace(sanitizeText(name))
		if clean == "" {
			continue
		}
		ids = append(ids, igdbID)
		names = append(names, clean)
	}
	if len(ids) == 0 {
		return out, nil
	}

	// Construct the SQL query for bulk upsert operation
	// UNNEST is used to handle arrays of IDs and names
	// ON CONFLICT ensures existing records are updated
	idColumn := fmt.Sprintf("%s_id", table)
	query := fmt.Sprintf(
		`INSERT INTO %s (igdb_id, %s)
		 SELECT * FROM UNNEST($1::int[], $2::text[])
		 ON CONFLICT (igdb_id) DO UPDATE
		 SET %s = EXCLUDED.%s
		 RETURNING igdb_id, %s`,
		table,
		column,
		column,
		column,
		idColumn,
	)

	// Execute the query and process the results
	rows, err := tx.Query(query, pq.Array(ids), pq.Array(names))
	if err != nil {
		return nil, err
	}
	// Lets all the rows close to prevent memory leaks
	defer rows.Close()

	// Scan the returned rows to build the output map
	for rows.Next() {
		// Temporary variables to hold scanned values
		var igdbID, dbID int
		// Scan the current row into igdbID and dbID
		if err := rows.Scan(&igdbID, &dbID); err != nil {
			return nil, err
		}
		// Map the igdbID to the corresponding dbID
		out[igdbID] = dbID
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// gameUpsertRow represents a single row for upserting a game.
type gameUpsertRow struct {
	IGDBID        int     `json:"igdb_id"`
	Name          string  `json:"game_name"`
	Description   *string `json:"game_description"`
	ReleaseDate   *string `json:"release_date"`
	Genre         *string `json:"genre"`
	Publishers    *string `json:"publishers"`
	Story         *string `json:"story"`
	CoverImageURL *string `json:"cover_image_url"`
	AggregatedRating *float64 `json:"aggregated_rating"`
	AggregatedRatingCount *int `json:"aggregated_rating_count"`
	TotalRating *float64 `json:"total_rating"`
	TotalRatingCount *int `json:"total_rating_count"`
	Popularity *float64 `json:"popularity"`
}

// batchUpsertGames upserts games in a single statement and returns igdb_id -> game_id.
func batchUpsertGames(tx DBTX, rows []gameUpsertRow) (map[int]int, error) {
	out := make(map[int]int, len(rows))
	if len(rows) == 0 {
		return out, nil
	}

	payload, err := json.Marshal(rows)
	if err != nil {
		return nil, err
	}

	// SQL query for bulk upsert of games using JSONB recordset
	// ON CONFLICT ensures existing records are updated with COALESCE to retain existing data when new data is NULL
	// RETURNING clause retrieves the igdb_id and game_id of affected rows
	// The query uses a CTE (Common Table Expression) to parse the JSONB input
	// and perform the insert/update in one operation
	query := `
		WITH data AS (
			SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
				igdb_id int,
				game_name text,
				game_description text,
				release_date date,
				genre text,
				publishers text,
				story text,
				cover_image_url text,
				aggregated_rating float8,
				aggregated_rating_count int,
				total_rating float8,
				total_rating_count int,
				popularity float8
			)
		)
		INSERT INTO games (
			igdb_id,
			game_name,
			game_description,
			release_date,
			genre,
			publishers,
			story,
			cover_image_url,
			aggregated_rating,
			aggregated_rating_count,
			total_rating,
			total_rating_count,
			popularity
		)
		SELECT
			igdb_id,
			game_name,
			game_description,
			release_date,
			genre,
			publishers,
			story,
			cover_image_url,
			aggregated_rating,
			aggregated_rating_count,
			total_rating,
			total_rating_count,
			popularity
		FROM data
		ON CONFLICT (igdb_id) DO UPDATE
		SET game_name = EXCLUDED.game_name,
		    game_description = COALESCE(EXCLUDED.game_description, games.game_description),
		    release_date = COALESCE(EXCLUDED.release_date, games.release_date),
		    genre = COALESCE(EXCLUDED.genre, games.genre),
		    publishers = COALESCE(EXCLUDED.publishers, games.publishers),
		    story = COALESCE(EXCLUDED.story, games.story),
		    cover_image_url = COALESCE(EXCLUDED.cover_image_url, games.cover_image_url),
		    aggregated_rating = COALESCE(EXCLUDED.aggregated_rating, games.aggregated_rating),
		    aggregated_rating_count = COALESCE(EXCLUDED.aggregated_rating_count, games.aggregated_rating_count),
		    total_rating = COALESCE(EXCLUDED.total_rating, games.total_rating),
		    total_rating_count = COALESCE(EXCLUDED.total_rating_count, games.total_rating_count),
		    popularity = COALESCE(EXCLUDED.popularity, games.popularity)
		RETURNING igdb_id, game_id;
	`

	// Execute the query with the JSONB payload
	rowsResult, err := tx.Query(query, payload)
	if err != nil {
		return nil, err
	}
	// Ensure rows are closed after processing
	defer rowsResult.Close()

	// Process the returned rows to build the output map
	for rowsResult.Next() {
		// Temporary variables to hold scanned values
		var igdbID, gameID int
		// Scan the current row into igdbID and gameID
		if err := rowsResult.Scan(&igdbID, &gameID); err != nil {
			return nil, err
		}
		// Map the igdbID to the corresponding gameID
		out[igdbID] = gameID
	}
	// Check for any errors encountered during row iteration
	if err := rowsResult.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// bulkInsertJoinPairs inserts many join rows in a single statement.
func bulkInsertJoinPairs(tx DBTX, table, leftCol, rightCol string, leftIDs, rightIDs []int) error {
	// Validate input lengths
	if len(leftIDs) == 0 || len(rightIDs) == 0 || len(leftIDs) != len(rightIDs) {
		return nil
	}
	// Construct the SQL query for bulk insert operation
	// UNNEST is used to handle arrays of left and right IDs
	// ON CONFLICT DO NOTHING ensures existing records are skipped
	query := fmt.Sprintf(
		`INSERT INTO %s (%s, %s)
		 SELECT * FROM UNNEST($1::int[], $2::int[])
		 ON CONFLICT DO NOTHING`,
		table,
		leftCol,
		rightCol,
	)
	// Execute the query with the provided ID arrays
	_, err := tx.Exec(query, pq.Array(leftIDs), pq.Array(rightIDs))
	return err
}

// bulkInsertGameMedia inserts media rows in a single statement, skipping existing rows.
func bulkInsertGameMedia(tx DBTX, gameIDs, igdbIDs []int, mediaTypes, urls []string, sortOrders []int) error {
	// Validate input lengths
	if len(gameIDs) == 0 {
		return nil
	}
	// Ensure all slices have the same length
	if len(gameIDs) != len(igdbIDs) || len(gameIDs) != len(mediaTypes) || len(gameIDs) != len(urls) || len(gameIDs) != len(sortOrders) {
		return fmt.Errorf("media slice length mismatch")
	}

	// SQL query for bulk insert of game media
	// Uses CTEs to first deduplicate input data and then insert only new records
	// LEFT JOIN with game_media table ensures existing records are skipped
	query := `
		WITH input AS (
			SELECT *
			FROM UNNEST($1::int[], $2::int[], $3::text[], $4::text[], $5::int[])
				AS u(game_id, igdb_id, media_type, url, sort_order)
		),
		dedup AS (
			SELECT DISTINCT ON (game_id, media_type, igdb_id)
				game_id, igdb_id, media_type, url, sort_order
			FROM input
			ORDER BY game_id, media_type, igdb_id, sort_order
		)
		INSERT INTO game_media (game_id, igdb_id, media_type, url, sort_order)
		SELECT d.game_id, d.igdb_id, d.media_type, d.url, d.sort_order
		FROM dedup d
		LEFT JOIN game_media gm
			ON gm.game_id = d.game_id
		   AND gm.media_type = d.media_type
		   AND gm.igdb_id = d.igdb_id
		WHERE gm.media_id IS NULL
	`

	// Execute the query with the provided arrays
	_, err := tx.Exec(query, pq.Array(gameIDs), pq.Array(igdbIDs), pq.Array(mediaTypes), pq.Array(urls), pq.Array(sortOrders))
	return err
}

// bulkInsertGameCompaniesPairs inserts company roles for many games at once.
func bulkInsertGameCompaniesPairs(tx DBTX, gameIDs, companyIDs []int, isDevelopers, isPublishers []bool) error {
	if len(gameIDs) == 0 || len(companyIDs) == 0 {
		return nil
	}
	if len(gameIDs) != len(companyIDs) || len(gameIDs) != len(isDevelopers) || len(gameIDs) != len(isPublishers) {
		return fmt.Errorf("company join slice length mismatch")
	}

	// SQL query for bulk insert of game-company relationships
	// UNNEST is used to handle arrays of game IDs, company IDs, and role flags
	// ON CONFLICT ensures existing records are updated with new role information
	query := `
		INSERT INTO game_companies (
			game_id,
			company_id,
			is_developer,
			is_publisher,
			is_supporting_developer,
			is_porting_developer
		)
		SELECT * FROM UNNEST($1::int[], $2::int[], $3::bool[], $4::bool[], $5::bool[], $6::bool[])
		ON CONFLICT (game_id, company_id) DO UPDATE
		SET is_developer = EXCLUDED.is_developer,
		    is_publisher = EXCLUDED.is_publisher,
		    is_supporting_developer = EXCLUDED.is_supporting_developer,
		    is_porting_developer = EXCLUDED.is_porting_developer
	`

	// Using slices of false for supporting and porting developer roles
	falses := make([]bool, len(gameIDs))
	_, err := tx.Exec(query, pq.Array(gameIDs), pq.Array(companyIDs), pq.Array(isDevelopers), pq.Array(isPublishers), pq.Array(falses), pq.Array(falses))
	return err
}

// joinNames joins names from a map based on a slice of IDs into a comma-separated string.
func joinNames(ids []int, names map[int]string) string {
	// Return an empty string if input slices or maps are empty
	if len(ids) == 0 || len(names) == 0 {
		return ""
	}
	// Collect sanitized names corresponding to the provided IDs
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		if name := strings.TrimSpace(sanitizeText(names[id])); name != "" {
			parts = append(parts, name)
		}
	}
	return strings.Join(parts, ",")
}

// nullableString returns a pointer to the sanitized string or nil if empty.
func nullableString(value string) *string {
	clean := strings.TrimSpace(sanitizeText(value))
	if clean == "" {
		return nil
	}
	return &clean
}

// sanitizeText removes control characters from the input string
func sanitizeText(value string) string {
	if value == "" {
		return ""
	}
	return strings.Map(func(r rune) rune {
		if r == 0 {
			return -1
		}
		if r < 0x20 && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		if r == 0x7f {
			return -1
		}
		return r
	}, value)
}
