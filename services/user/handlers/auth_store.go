package handlers

import (
	"database/sql"

	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/models"
)

var (
	authStoreReady = func() bool {
		return db.DB != nil
	}
	lookupAuthIdentity = lookupExistingAuthIdentity
	createAuthUser     = func(username, hashedPassword, email string) (models.User, error) {
		if db.DB == nil {
			return models.User{}, sql.ErrConnDone
		}

		user := models.User{
			Username: username,
			Email:    email,
		}
		err := db.DB.QueryRow(
			"INSERT INTO app_user (username, password, email) VALUES ($1, $2, $3) RETURNING user_id, steam_linked",
			username,
			hashedPassword,
			email,
		).Scan(&user.ID, &user.SteamLinked)
		if err != nil {
			return models.User{}, err
		}
		return user, nil
	}
	getAuthUserByUsername = func(username string) (models.User, string, error) {
		if db.DB == nil {
			return models.User{}, "", sql.ErrConnDone
		}

		var user models.User
		var storedPassword string
		err := db.DB.QueryRow(
			"SELECT user_id, username, email, password, steam_linked FROM app_user WHERE username = $1 AND deleted_at IS NULL",
			username,
		).Scan(&user.ID, &user.Username, &user.Email, &storedPassword, &user.SteamLinked)
		return user, storedPassword, err
	}
	getAuthUserByEmail = func(email string) (models.User, string, error) {
		if db.DB == nil {
			return models.User{}, "", sql.ErrConnDone
		}

		var user models.User
		var storedPassword string
		err := db.DB.QueryRow(
			"SELECT user_id, username, email, password, steam_linked FROM app_user WHERE email = $1 AND deleted_at IS NULL",
			email,
		).Scan(&user.ID, &user.Username, &user.Email, &storedPassword, &user.SteamLinked)
		return user, storedPassword, err
	}
	upgradeAuthPasswordHash = func(userID int64, hashedPassword string) error {
		if db.DB == nil {
			return sql.ErrConnDone
		}
		_, err := db.DB.Exec("UPDATE app_user SET password = $1 WHERE user_id = $2 AND deleted_at IS NULL", hashedPassword, userID)
		return err
	}
	getAuthPasswordHashByUserID = func(id string) (string, error) {
		if db.DB == nil {
			return "", sql.ErrConnDone
		}

		var storedPassword string
		err := db.DB.QueryRow(
			"SELECT password FROM app_user WHERE user_id = $1 AND deleted_at IS NULL",
			id,
		).Scan(&storedPassword)
		return storedPassword, err
	}
	saveAuthPasswordHash = func(id string, hashedPassword string) (int64, error) {
		if db.DB == nil {
			return 0, sql.ErrConnDone
		}

		result, err := db.DB.Exec(
			"UPDATE app_user SET password = $1 WHERE user_id = $2 AND deleted_at IS NULL",
			hashedPassword,
			id,
		)
		if err != nil {
			return 0, err
		}
		return result.RowsAffected()
	}
)
