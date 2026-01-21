package db

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func Failed to load game.htmlConnect(dsn string) error {
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL not provided")
	}

	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}

	if err := conn.Ping(); err != nil {
		return err
	}

	DB = conn
	return nil
}
