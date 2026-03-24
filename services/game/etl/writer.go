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
func upsertNamedRows(tx DBTX, table, column string, source map[int]string, batchSize int) (map[int]int, error) {
	out := make(map[int]int, len(source))
	if len(source) == 0 {
		return out, nil
	}

	resolvedColumn, err := resolveEntityNameColumn(tx, table, column)
	if err != nil {
		return nil, err
	}

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

	idColumn := fmt.Sprintf("%s_id", table)
	query := fmt.Sprintf(
		`INSERT INTO %s (igdb_id, %s)
		 SELECT * FROM UNNEST($1::int[], $2::text[])
		 ON CONFLICT (igdb_id) DO UPDATE
		 SET %s = EXCLUDED.%s
		 RETURNING igdb_id, %s`,
		table,
		resolvedColumn,
		resolvedColumn,
		resolvedColumn,
		idColumn,
	)

	batchSize = normalizeBatchSize(batchSize, len(ids))
	for start := 0; start < len(ids); start += batchSize {
		end := batchEnd(start, batchSize, len(ids))
		rows, err := tx.Query(query, pq.Array(ids[start:end]), pq.Array(names[start:end]))
		if err != nil {
			return nil, err
		}

		for rows.Next() {
			var igdbID, dbID int
			if err := rows.Scan(&igdbID, &dbID); err != nil {
				_ = rows.Close()
				return nil, err
			}
			out[igdbID] = dbID
		}
		if err := rows.Err(); err != nil {
			_ = rows.Close()
			return nil, err
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}

	return out, nil
}

// resolveEntityNameColumn checks if the preferred name column exists in the specified table, and falls back to "name" if it doesn't.
// This allows the ETL to work with schema variants that may have different naming conventions for entity names (e.g. "franchise_name" vs "name" in the "game_franchise" table).
func resolveEntityNameColumn(tx DBTX, table, preferred string) (string, error) {
	if hasColumn(tx, table, preferred) {
		return preferred, nil
	}
	if preferred != "name" && hasColumn(tx, table, "name") {
		return "name", nil
	}
	return "", fmt.Errorf("table %q has neither %q nor fallback %q column", table, preferred, "name")
}

// hasColumn checks if the specified column exists in the given table within the current database schema.
// It queries the information_schema.columns view to determine if the column is present, returning true if found and false otherwise.
func hasColumn(tx DBTX, table, column string) bool {
	rows, err := tx.Query(
		`SELECT 1
		 FROM information_schema.columns
		 WHERE table_schema = current_schema()
		   AND table_name = $1
		   AND column_name = $2
		 LIMIT 1`,
		table,
		column,
	)
	if err != nil {
		return false
	}
	defer rows.Close()
	return rows.Next()
}

// gameUpsertRow represents a single row for upserting a game.
// It includes all the fields needed for the upsert operation, with pointers for nullable fields. This struct is serialized to JSON and used as input for the batchUpsertGames function.
type gameUpsertRow struct {
	IGDBID                int      `json:"igdb_id"`
	Name                  string   `json:"game_name"`
	Description           *string  `json:"game_description"`
	ReleaseDate           *string  `json:"release_date"`
	Genre                 *string  `json:"genre"`
	Publishers            *string  `json:"publishers"`
	Story                 *string  `json:"story"`
	CoverImageURL         *string  `json:"cover_image_url"`
	AggregatedRating      *float64 `json:"aggregated_rating"`
	AggregatedRatingCount *int     `json:"aggregated_rating_count"`
	TotalRating           *float64 `json:"total_rating"`
	TotalRatingCount      *int     `json:"total_rating_count"`
	Popularity            *float64 `json:"popularity"`
}

// batchUpsertGames upserts games in batches and returns igdb_id -> game_id.
func batchUpsertGames(tx DBTX, rows []gameUpsertRow, batchSize int) (map[int]int, error) {
	out := make(map[int]int, len(rows))
	if len(rows) == 0 {
		return out, nil
	}

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

	batchSize = normalizeBatchSize(batchSize, len(rows))
	for start := 0; start < len(rows); start += batchSize {
		end := batchEnd(start, batchSize, len(rows))
		payload, err := json.Marshal(rows[start:end])
		if err != nil {
			return nil, err
		}

		rowsResult, err := tx.Query(query, payload)
		if err != nil {
			return nil, err
		}

		for rowsResult.Next() {
			var igdbID, gameID int
			if err := rowsResult.Scan(&igdbID, &gameID); err != nil {
				_ = rowsResult.Close()
				return nil, err
			}
			out[igdbID] = gameID
		}
		if err := rowsResult.Err(); err != nil {
			_ = rowsResult.Close()
			return nil, err
		}
		if err := rowsResult.Close(); err != nil {
			return nil, err
		}
	}

	return out, nil
}

// bulkInsertJoinPairs inserts many join rows in batches.
func bulkInsertJoinPairs(tx DBTX, table, leftCol, rightCol string, leftIDs, rightIDs []int, batchSize int) error {
	if len(leftIDs) == 0 || len(rightIDs) == 0 || len(leftIDs) != len(rightIDs) {
		return nil
	}

	query := fmt.Sprintf(
		`INSERT INTO %s (%s, %s)
		 SELECT * FROM UNNEST($1::int[], $2::int[])
		 ON CONFLICT DO NOTHING`,
		table,
		leftCol,
		rightCol,
	)

	batchSize = normalizeBatchSize(batchSize, len(leftIDs))
	for start := 0; start < len(leftIDs); start += batchSize {
		end := batchEnd(start, batchSize, len(leftIDs))
		if _, err := tx.Exec(query, pq.Array(leftIDs[start:end]), pq.Array(rightIDs[start:end])); err != nil {
			return err
		}
	}

	return nil
}

// bulkInsertGameMedia inserts media rows in batches, skipping existing rows.
func bulkInsertGameMedia(tx DBTX, gameIDs, igdbIDs []int, mediaTypes, urls []string, sortOrders []int, batchSize int) error {
	if len(gameIDs) == 0 {
		return nil
	}
	if len(gameIDs) != len(igdbIDs) || len(gameIDs) != len(mediaTypes) || len(gameIDs) != len(urls) || len(gameIDs) != len(sortOrders) {
		return fmt.Errorf("media slice length mismatch")
	}

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

	batchSize = normalizeBatchSize(batchSize, len(gameIDs))
	for start := 0; start < len(gameIDs); start += batchSize {
		end := batchEnd(start, batchSize, len(gameIDs))
		if _, err := tx.Exec(
			query,
			pq.Array(gameIDs[start:end]),
			pq.Array(igdbIDs[start:end]),
			pq.Array(mediaTypes[start:end]),
			pq.Array(urls[start:end]),
			pq.Array(sortOrders[start:end]),
		); err != nil {
			return err
		}
	}

	return nil
}

// bulkInsertGameCompaniesPairs inserts company roles for many games at once.
func bulkInsertGameCompaniesPairs(tx DBTX, gameIDs, companyIDs []int, isDevelopers, isPublishers []bool, batchSize int) error {
	if len(gameIDs) == 0 || len(companyIDs) == 0 {
		return nil
	}
	if len(gameIDs) != len(companyIDs) || len(gameIDs) != len(isDevelopers) || len(gameIDs) != len(isPublishers) {
		return fmt.Errorf("company join slice length mismatch")
	}

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

	batchSize = normalizeBatchSize(batchSize, len(gameIDs))
	for start := 0; start < len(gameIDs); start += batchSize {
		end := batchEnd(start, batchSize, len(gameIDs))
		falses := make([]bool, end-start)
		if _, err := tx.Exec(
			query,
			pq.Array(gameIDs[start:end]),
			pq.Array(companyIDs[start:end]),
			pq.Array(isDevelopers[start:end]),
			pq.Array(isPublishers[start:end]),
			pq.Array(falses),
			pq.Array(falses),
		); err != nil {
			return err
		}
	}

	return nil
}

func normalizeBatchSize(batchSize, total int) int {
	if total <= 0 {
		return 0
	}
	if batchSize <= 0 || batchSize > total {
		return total
	}
	return batchSize
}

func batchEnd(start, batchSize, total int) int {
	end := start + batchSize
	if end > total {
		return total
	}
	return end
}

// joinNames joins names from a map based on a slice of IDs into a comma-separated string.
func joinNames(ids []int, names map[int]string) string {
	if len(ids) == 0 || len(names) == 0 {
		return ""
	}
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
