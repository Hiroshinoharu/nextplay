package db

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

var DB *sql.DB

type schemaExecutor interface {
	Exec(query string, args ...any) (sql.Result, error)
}

var userSchemaStatements = []string{
	`ALTER TABLE app_user
	    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`,
	`CREATE TABLE IF NOT EXISTS user_deletion_audit (
	    audit_id    SERIAL PRIMARY KEY,
	    user_id     INT NOT NULL,
	    username    TEXT NOT NULL,
	    email       TEXT NOT NULL,
	    deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);`,
}

// Connect initializes the database connection.
func Connect(dsn string) error {
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

// EnsureUserSchema applies idempotent user-service schema migrations needed at runtime.
func EnsureUserSchema() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}
	return ensureUserSchema(DB)
}

func ensureUserSchema(exec schemaExecutor) error {
	for _, statement := range userSchemaStatements {
		if _, err := exec.Exec(statement); err != nil {
			return err
		}
	}
	return nil
}
