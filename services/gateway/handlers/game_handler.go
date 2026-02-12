package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

var gameClient = clients.NewGameClient()

// ------------ BASIC GAME CRUD ------------

// GetAllGames retrieves a list of all games, optionally filtered by query parameters.
func GetAllGames(c *fiber.Ctx) error {
	// Extract query parameters as a string to pass to the Game Service
	// It can include filters like ?genre=action&platform=pc, etc.
	query := c.Context().QueryArgs().String()
	status, data, err := gameClient.GetAllGames(query)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func SearchGamesByName(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	status, data, err := gameClient.SearchGamesByName(query)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func GetPopularGames(c *fiber.Ctx) error {
	// Extract query parameters as a string to pass to the Game Service
	// It can include filters like ?genre=action&platform=pc, etc.
	query := c.Context().QueryArgs().String()
	status, data, err := gameClient.GetPopularGames(query)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	// The Game Service will return a list of popular games in the response body, which we send back to the client
	return c.Status(status).Send(data)
}

func GetTopGames(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	status, data, err := gameClient.GetTopGames(query)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func GetGameByID(c *fiber.Ctx) error {
	// Extract the game ID from the URL parameters
	// For example, if the route is defined as /games/:id, this will get the value of :id
	// This ID will be passed to the Game Service to retrieve the specific game details
	id := c.Params("id")
	status, data, err := gameClient.GetGameByID(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	// The Game Service will return the game details in the response body, which we send back to the client
	return c.Status(status).Send(data)
}

// CreateGame creates a new game using the data provided in the request body.
func CreateGame(c *fiber.Ctx) error {
	// The request body should contain the game details in JSON format, which we read and pass to the Game Service
	body := c.Body()
	// The Game Service will handle the creation logic and return a status code and response body, which we send back to the client
	status, data, err := gameClient.CreateGame(body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func UpdateGame(c *fiber.Ctx) error {
	// Extract the game ID from the URL parameters
	id := c.Params("id")
	// The request body should contain the updated game details in JSON format, which we read and pass to the Game Service along with the game ID
	body := c.Body()
	status, data, err := gameClient.UpdateGame(id, body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

// DeleteGame deletes a game based on the provided game ID in the URL parameters.
func DeleteGame(c *fiber.Ctx) error {
	// Extract the game ID from the URL parameters
	id := c.Params("id")
	// The Game Service will handle the deletion logic and return a status code and response body, which we send back to the client
	status, data, err := gameClient.DeleteGame(id)
	// If there is an error during the request to the Game Service, we return a 502 Bad Gateway status with the error message in JSON format
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	// If the request is successful, we return the status code and response body from the Game Service to the client
	return c.Status(status).Send(data)
}

// ------------ RELATIONS (EXAMPLE) ------------
// These handlers demonstrate how to manage relationships between games and other entities like platforms, keywords, companies, franchises, and series.
func GetGamePlatforms(c *fiber.Ctx) error {
	// Extract the game ID from the URL parameters
	id := c.Params("id")
	status, data, err := gameClient.GetGamePlatforms(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func AddGamePlatform(c *fiber.Ctx) error {
	// Extract the game ID from the URL parameters
	id := c.Params("id")
	// The request body should contain the platform details in JSON format, which we read and pass to the Game Service along with the game ID
	body := c.Body()
	status, data, err := gameClient.AddGamePlatform(id, body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func RemoveGamePlatform(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")
	status, data, err := gameClient.RemoveGamePlatform(id, platformID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func GetGameKeywords(c *fiber.Ctx) error {
	id := c.Params("id")
	status, data, err := gameClient.GetGameKeywords(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func AddGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")
	body := c.Body()
	status, data, err := gameClient.AddGameKeyword(id, body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func RemoveGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")
	status, data, err := gameClient.RemoveGameKeyword(id, keywordID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func GetGameCompanies(c *fiber.Ctx) error {
	id := c.Params("id")
	status, data, err := gameClient.GetGameCompanies(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func AddGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	body := c.Body()
	status, data, err := gameClient.AddGameCompany(id, body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func RemoveGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Params("companyId")
	status, data, err := gameClient.RemoveGameCompany(id, companyID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func GetGameFranchises(c *fiber.Ctx) error {
	// Extract the game ID from the URL parameters
	id := c.Params("id")
	status, data, err := gameClient.GetGameFranchises(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

func AddGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	body := c.Body()
	status, data, err := gameClient.AddGameFranchise(id, body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

// RemoveGameFranchise removes the association between a game and a franchise based on the provided game ID and franchise ID in the URL parameters.
func RemoveGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	franchiseID := c.Params("franchiseId")
	status, data, err := gameClient.RemoveGameFranchise(id, franchiseID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

// GetGameSeries retrieves the series associated with a game based on the provided game ID in the URL parameters.
func GetGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	status, data, err := gameClient.GetGameSeries(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

// AddGameSeries creates an association between a game and a series based on the provided game ID in the URL parameters and series details in the request body.
func AddGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	body := c.Body()
	status, data, err := gameClient.AddGameSeries(id, body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}

// RemoveGameSeries removes the association between a game and a series based on the provided game ID and series ID in the URL parameters.
func RemoveGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	seriesID := c.Params("seriesId")
	status, data, err := gameClient.RemoveGameSeries(id, seriesID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}
