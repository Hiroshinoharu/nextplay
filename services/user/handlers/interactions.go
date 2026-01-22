package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
)

// GetInteractions handles GET /users/:id/interactions requests
func GetInteractions(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	rows, err := db.DB.Query(
		"SELECT user_id, game_id, rating, review, liked, favorited, timestamp FROM user_interactions WHERE user_id = $1",
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch interactions"})
	}
	defer rows.Close()

	type interactionResponse struct {
		UserID    int        `json:"user_id"`
		GameID    int        `json:"game_id"`
		Rating    *float64   `json:"rating,omitempty"`
		Review    *string    `json:"review,omitempty"`
		Liked     *bool      `json:"liked,omitempty"`
		Favorited *bool      `json:"favorited,omitempty"`
		Timestamp *time.Time `json:"timestamp,omitempty"`
	}

	interactions := make([]interactionResponse, 0)
	for rows.Next() {
		var (
			item                   interactionResponse
			ratingVal              sql.NullFloat64
			reviewVal              sql.NullString
			likedVal, favoritedVal sql.NullBool
			timestampVal           sql.NullTime
		)
		if err := rows.Scan(
			&item.UserID,
			&item.GameID,
			&ratingVal,
			&reviewVal,
			&likedVal,
			&favoritedVal,
			&timestampVal,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read interactions"})
		}
		if ratingVal.Valid {
			item.Rating = &ratingVal.Float64
		}
		if reviewVal.Valid {
			item.Review = &reviewVal.String
		}
		if likedVal.Valid {
			item.Liked = &likedVal.Bool
		}
		if favoritedVal.Valid {
			item.Favorited = &favoritedVal.Bool
		}
		if timestampVal.Valid {
			item.Timestamp = &timestampVal.Time
		}

		interactions = append(interactions, item)
	}
	if err := rows.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch interactions"})
	}

	return c.JSON(interactions)
}

// AddOrUpdateInteraction handles POST /users/:id/interactions requests
func AddOrUpdateInteraction(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	type interactionRequest struct {
		GameID    int      `json:"game_id"`
		Rating    *float64 `json:"rating"`
		Review    *string  `json:"review"`
		Liked     *bool    `json:"liked"`
		Favorited *bool    `json:"favorited"`
	}

	var req interactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.GameID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "game_id is required"})
	}

	_, err := db.DB.Exec(
		`INSERT INTO user_interactions (user_id, game_id, rating, review, liked, favorited, timestamp)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())
		 ON CONFLICT (user_id, game_id) DO UPDATE
		 SET rating = EXCLUDED.rating,
		     review = EXCLUDED.review,
		     liked = EXCLUDED.liked,
		     favorited = EXCLUDED.favorited,
		     timestamp = EXCLUDED.timestamp`,
		userID,
		req.GameID,
		req.Rating,
		req.Review,
		req.Liked,
		req.Favorited,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save interaction"})
	}

	return c.JSON(fiber.Map{
		"message": "Add/Update interaction",
		"user_id": userID,
		"game_id": req.GameID,
	})
}

// DeleteInteraction handles DELETE /users/:id/interactions/:gameId requests
func DeleteInteraction(c *fiber.Ctx) error {
	userID := c.Params("id")
	gameID := c.Params("gameId")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	_, err := db.DB.Exec(
		"DELETE FROM user_interactions WHERE user_id=$1 AND game_id=$2",
		userID,
		gameID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete interaction"})
	}

	return c.JSON(fiber.Map{
		"message": "Delete interaction",
		"user_id": userID,
		"game_id": gameID,
	})
}
