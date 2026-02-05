package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
)

// GetGameCompanies retrieves companies associated with a specific game
func GetGameCompanies(c *fiber.Ctx) error {
	idParam := c.Params("id")

	// Convert game ID from string to integer
	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	// Query the database for companies associated with the game
	rows, err := db.DB.Query(`SELECT * FROM game_companies WHERE game_id=$1`, gameID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	// Define a struct to hold company data
	type gameCompany struct {
		GameID                int  `json:"game_id"`
		CompanyID             int  `json:"company_id"`
		IsDeveloper           bool `json:"is_developer"`
		IsPublisher           bool `json:"is_publisher"`
		IsSupportingDeveloper bool `json:"is_supporting_developer"`
		IsPortingDeveloper    bool `json:"is_porting_developer"`
	}

	// Collect companies
	companies := make([]gameCompany, 0)
	for rows.Next() {
		var company gameCompany
		if err := rows.Scan(
			&company.GameID,
			&company.CompanyID,
			&company.IsDeveloper,
			&company.IsPublisher,
			&company.IsSupportingDeveloper,
			&company.IsPortingDeveloper,
		); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		companies = append(companies, company)
	}
	// Check for errors from iterating over rows
	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Return the list of companies as JSON
	return c.JSON(fiber.Map{
		"game_id":   gameID,
		"companies": companies,
	})
}

// AddGameCompany associates a company with a specific game
func AddGameCompany(c *fiber.Ctx) error {
	
	// Get game ID from URL parameters
	idParam := c.Params("id")

	// Convert game ID from string to integer
	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	var payload struct {
		CompanyID             int64 `json:"company_id"`
		IsDeveloper           bool  `json:"is_developer"`
		IsPublisher           bool  `json:"is_publisher"`
		IsSupportingDeveloper bool  `json:"is_supporting_developer"`
		IsPortingDeveloper    bool  `json:"is_porting_developer"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}
	if payload.CompanyID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid company ID"})
	}

	_, err = db.DB.Exec(
		`INSERT INTO game_companies (game_id, company_id, is_developer, is_publisher, is_supporting_developer, is_porting_developer)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		gameID,
		payload.CompanyID,
		payload.IsDeveloper,
		payload.IsPublisher,
		payload.IsSupportingDeveloper,
		payload.IsPortingDeveloper,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":                 "Add company to game",
		"game_id":                 gameID,
		"company_id":              payload.CompanyID,
		"is_developer":            payload.IsDeveloper,
		"is_publisher":            payload.IsPublisher,
		"is_supporting_developer": payload.IsSupportingDeveloper,
		"is_porting_developer":    payload.IsPortingDeveloper,
	})
}

// RemoveGameCompany disassociates a company from a specific game
func RemoveGameCompany(c *fiber.Ctx) error {
	idParam := c.Params("id")
	companyParam := c.Params("companyId")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	companyID, err := strconv.ParseInt(companyParam, 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid company ID"})
	}

	_, err = db.DB.Exec(`DELETE FROM game_companies WHERE game_id=$1 AND company_id=$2`, gameID, companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":     "Remove company from game",
		"game_id":     gameID,
		"company_id":  companyID,
	})
}
