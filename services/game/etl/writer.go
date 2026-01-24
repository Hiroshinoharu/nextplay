package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/lib/pq"
	"github.com/maxceban/nextplay/services/game/db"
)

// upsertNamedRows bulk upserts rows with igdb_id and returns a map of igdb_id -> db_id.
func upsertNamedRows(table, column string, source map[int]string) (map[int]int, error) {
	out := make(map[int]int, len(source))
	if len(source) == 0 {
		return out, nil
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
		column,
		column,
		column,
		idColumn,
	)

	rows, err := db.DB.Query(query, pq.Array(ids), pq.Array(names))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var igdbID, dbID int
		if err := rows.Scan(&igdbID, &dbID); err != nil {
			return nil, err
		}
		out[igdbID] = dbID
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

type gameUpsertRow struct {
	IGDBID        int     `json:"igdb_id"`
	Name          string  `json:"game_name"`
	Description   *string `json:"game_description"`
	ReleaseDate   *string `json:"release_date"`
	Genre         *string `json:"genre"`
	Publishers    *string `json:"publishers"`
	Story         *string `json:"story"`
	CoverImageURL *string `json:"cover_image_url"`
}

// batchUpsertGames upserts games in a single statement and returns igdb_id -> game_id.
func batchUpsertGames(rows []gameUpsertRow) (map[int]int, error) {
	out := make(map[int]int, len(rows))
	if len(rows) == 0 {
		return out, nil
	}

	payload, err := json.Marshal(rows)
	if err != nil {
		return nil, err
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
				cover_image_url text
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
			cover_image_url
		)
		SELECT
			igdb_id,
			game_name,
			game_description,
			release_date,
			genre,
			publishers,
			story,
			cover_image_url
		FROM data
		ON CONFLICT (igdb_id) DO UPDATE
		SET game_name = EXCLUDED.game_name,
		    game_description = COALESCE(EXCLUDED.game_description, games.game_description),
		    release_date = COALESCE(EXCLUDED.release_date, games.release_date),
		    genre = COALESCE(EXCLUDED.genre, games.genre),
		    publishers = COALESCE(EXCLUDED.publishers, games.publishers),
		    story = COALESCE(EXCLUDED.story, games.story),
		    cover_image_url = COALESCE(EXCLUDED.cover_image_url, games.cover_image_url)
		RETURNING igdb_id, game_id;
	`

	rowsResult, err := db.DB.Query(query, payload)
	if err != nil {
		return nil, err
	}
	defer rowsResult.Close()

	for rowsResult.Next() {
		var igdbID, gameID int
		if err := rowsResult.Scan(&igdbID, &gameID); err != nil {
			return nil, err
		}
		out[igdbID] = gameID
	}
	if err := rowsResult.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// bulkInsertJoinPairs inserts many join rows in a single statement.
func bulkInsertJoinPairs(table, leftCol, rightCol string, leftIDs, rightIDs []int) error {
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
	_, err := db.DB.Exec(query, pq.Array(leftIDs), pq.Array(rightIDs))
	return err
}

// bulkInsertGameMedia inserts media rows in a single statement, skipping existing rows.
func bulkInsertGameMedia(gameIDs, igdbIDs []int, mediaTypes, urls []string, sortOrders []int) error {
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

	_, err := db.DB.Exec(query, pq.Array(gameIDs), pq.Array(igdbIDs), pq.Array(mediaTypes), pq.Array(urls), pq.Array(sortOrders))
	return err
}

// bulkInsertGameCompaniesPairs inserts company roles for many games at once.
func bulkInsertGameCompaniesPairs(gameIDs, companyIDs []int, isDevelopers, isPublishers []bool) error {
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

	falses := make([]bool, len(gameIDs))
	_, err := db.DB.Exec(query, pq.Array(gameIDs), pq.Array(companyIDs), pq.Array(isDevelopers), pq.Array(isPublishers), pq.Array(falses), pq.Array(falses))
	return err
}



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
