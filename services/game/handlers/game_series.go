package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
)

// GetGameSeries handles GET /games/:id/series requests
func GetGameSeries(c *fiber.Ctx) error {
	idParam := c.Params("id")

	// Validate and convert idParam to integer
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	// Query the database for series associated with the game ID
	rows, err := db.DB.Query(`SELECT series_id FROM game_series WHERE game_id=$1`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Close the rows iterator when the function returns
	defer rows.Close()

	// Collect series IDs
	seriesIDs := make([]int64, 0)
	for rows.Next() {
		var seriesID int64
		if err := rows.Scan(&seriesID); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		// Append the series ID to the slice
		seriesIDs = append(seriesIDs, seriesID)
	}
	// Check for errors from iterating over rows
	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	// Return the list of series IDs as JSON
	return c.JSON(fiber.Map{
		"game_id":    id,
		"series":     seriesIDs,
	})
}

// AddGameSeries handles POST /games/:id/series requests
func AddGameSeries(c *fiber.Ctx) error {
	// Get the game ID from the URL parameters
	idParam := c.Params("id")

	// Validate and convert idParam to integer
	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	// Parse the request body to get the series ID
	var payload struct {
		SeriesID int64 `json:"series_id"`
	}
	// Parse the request body to get the series ID
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}
	// Validate the series ID
	if payload.SeriesID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid series ID"})
	}

	// Insert the game-series association into the database
	_, err = db.DB.Exec(`INSERT INTO game_series (game_id, series_id) VALUES ($1, $2)`, gameID, payload.SeriesID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Return a success response
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":   "Add game to series",
		"game_id":   gameID,
		"series_id": payload.SeriesID,
	})
}

func RemoveGameSeries(c *fiber.Ctx) error {
	idParam := c.Params("id")
	seriesParam := c.Params("seriesId")

	// Validate and convert idParam to integer
	gameID, err := strconv.Atoi(idParam)
	// Validate and convert idParam to integer
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	// Validate and convert seriesParam to integer
	seriesID, err := strconv.ParseInt(seriesParam, 10, 64)
	// Validate and convert seriesParam to integer
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid series ID"})
	}

	// Execute the delete query
	_, err = db.DB.Exec(`DELETE FROM game_series WHERE game_id=$1 AND series_id=$2`, gameID, seriesID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Return a success response
	return c.JSON(fiber.Map{
		"message":   "Remove game from series",
		"game_id":   gameID,
		"series_id": seriesID,
	})
}
