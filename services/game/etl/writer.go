package main

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/etl/igdb"
)

func ensureNamedRows(table, column string, source map[int]string) (map[int]int, error) {
	out := make(map[int]int, len(source))
	for igdbID, name := range source {
		clean := strings.TrimSpace(sanitizeText(name))
		if clean == "" {
			continue
		}
		dbID, err := getOrCreateID(table, column, clean)
		if err != nil {
			return nil, err
		}
		out[igdbID] = dbID
	}
	return out, nil
}

func getOrCreateID(table, column, value string) (int, error) {
	query := fmt.Sprintf("SELECT %s_id FROM %s WHERE %s = $1 LIMIT 1", table, table, column)
	var existing int
	if err := db.DB.QueryRow(query, value).Scan(&existing); err == nil {
		return existing, nil
	} else if err != sql.ErrNoRows {
		return 0, err
	}

	insert := fmt.Sprintf("INSERT INTO %s (%s) VALUES ($1) RETURNING %s_id", table, column, table)
	var inserted int
	if err := db.DB.QueryRow(insert, value).Scan(&inserted); err != nil {
		return 0, err
	}
	return inserted, nil
}

func upsertGame(game igdb.Game, genreNames map[int]string) (int, error) {
	gameName := strings.TrimSpace(sanitizeText(game.Name))
	if gameName == "" {
		return 0, fmt.Errorf("game name empty after sanitize")
	}
	var releaseDate *time.Time
	if game.FirstReleaseDate > 0 {
		timestamp := time.Unix(game.FirstReleaseDate, 0).UTC()
		releaseDate = &timestamp
	}

	var existing int
	selectQuery := `
		SELECT game_id
		FROM games
		WHERE game_name = $1
		  AND (
			  ($2::date IS NULL AND release_date IS NULL)
			  OR release_date = $2::date
		  )
		LIMIT 1;
	`
	if err := db.DB.QueryRow(selectQuery, gameName, releaseDate).Scan(&existing); err == nil {
		return existing, nil
	} else if err != sql.ErrNoRows {
		return 0, err
	}

	insert := `
		INSERT INTO games (game_name, game_description, release_date, genre, publishers, story)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING game_id;
	`

	var inserted int
	if err := db.DB.QueryRow(
		insert,
		gameName,
		emptyToNull(game.Summary),
		releaseDate,
		nullableNames(game.Genres, genreNames),
		nil,
		emptyToNull(game.Storyline),
	).Scan(&inserted); err != nil {
		return 0, err
	}
	return inserted, nil
}

func ensureJoinRow(table, leftCol, rightCol string, leftID, rightID int) error {
	query := fmt.Sprintf(
		"SELECT 1 FROM %s WHERE %s = $1 AND %s = $2 LIMIT 1",
		table,
		leftCol,
		rightCol,
	)
	var exists int
	if err := db.DB.QueryRow(query, leftID, rightID).Scan(&exists); err == nil {
		return nil
	} else if err != sql.ErrNoRows {
		return err
	}

	insert := fmt.Sprintf("INSERT INTO %s (%s, %s) VALUES ($1, $2)", table, leftCol, rightCol)
	_, err := db.DB.Exec(insert, leftID, rightID)
	return err
}

func nullableNames(ids []int, names map[int]string) interface{} {
	if len(ids) == 0 || len(names) == 0 {
		return nil
	}
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		if name := strings.TrimSpace(sanitizeText(names[id])); name != "" {
			parts = append(parts, name)
		}
	}
	if len(parts) == 0 {
		return nil
	}
	return strings.Join(parts, ",")
}

func emptyToNull(value string) interface{} {
	value = strings.TrimSpace(sanitizeText(value))
	if value == "" {
		return nil
	}
	return value
}

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

func gameExists(gameID int) (bool, error) {
	var exists int
	if err := db.DB.QueryRow("SELECT 1 FROM games WHERE game_id = $1", gameID).Scan(&exists); err == nil {
		return true, nil
	} else if err == sql.ErrNoRows {
		return false, nil
	} else {
		return false, err
	}
}
