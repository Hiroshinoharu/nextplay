package handlers

import (
	"database/sql"

	"github.com/maxceban/nextplay/services/user/db"
)

var activeUserExists = func(id string) (bool, error) {
	if db.DB == nil {
		return false, sql.ErrConnDone
	}

	var exists bool
	err := db.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM app_user WHERE user_id = $1 AND deleted_at IS NULL)",
		id,
	).Scan(&exists)
	if err != nil {
		return false, err
	}

	return exists, nil
}

func requireActiveUser(id string) error {
	exists, err := activeUserExists(id)
	if err != nil {
		return err
	}
	if !exists {
		return sql.ErrNoRows
	}
	return nil
}
