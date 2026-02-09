package db

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

var DB *sql.DB

// Connect initializes the database connection
func Connect(dsn string) error {
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL not provided")
	}

	// Open a new database connection using the provided DSN (Data Source Name)
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}

	// Verify the connection to the database by pinging it
	if err := conn.Ping(); err != nil {
		return err
	}

	// Assign the established connection to the global DB variable for use throughout the application
	DB = conn
	return nil
}
