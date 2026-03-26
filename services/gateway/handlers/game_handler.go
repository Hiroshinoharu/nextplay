package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

// GetAllGames retrieves a page of games from the database.
// Use the query parameter to specify any additional filtering or sorting options.
// The query parameter is a string that can be used to specify any additional filtering or sorting options.
// For example, to sort by name in descending order, you can use "sort_by=name&order_by=desc".
// The response will contain a JSON array of game objects, which can be used to display information about the games.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetAllGames(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetAllGames(query)
	return sendProxyBytes(c, status, data, err)
}

// SearchGamesByName retrieves a page of games from the database that match the given query.
// The query parameter is a string that can be used to specify any additional filtering or sorting options.
// For example, to sort by name in descending order, you can use "sort_by=name&order_by=desc".
// The response will contain a JSON array of game objects, which can be used to display information about the games.
// The response will also contain a status code and any error messages if there are any issues with the request.
func SearchGamesByName(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.SearchGamesByName(query)
	return sendProxyBytes(c, status, data, err)
}

// GetPopularGames retrieves a page of games from the database that are the most popular.
// The query parameter is a string that can be used to specify any additional filtering or sorting options.
// For example, to sort by name in descending order, you can use "sort_by=name&order_by=desc".
// The response will contain a JSON array of game objects, which can be used to display information about the games.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetPopularGames(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetPopularGames(query)
	return sendProxyBytes(c, status, data, err)
}

// GetTopGames retrieves a page of top games from the database.
// The query parameter is a string that can be used to specify any additional filtering or sorting options.
// For example, to sort by name in descending order, you can use "sort_by=name&order_by=desc".
// The response will contain a JSON array of game objects, which can be used to display information about the games.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetTopGames(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetTopGames(query)
	return sendProxyBytes(c, status, data, err)
}

// GetQuestionnaireFacets retrieves a list of questionnaire facets from the database.
// The response will contain a JSON array of questionnaire facet objects, which can be used to display information about the questionnaire facets.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetQuestionnaireFacets(c *fiber.Ctx) error {
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetQuestionnaireFacets()
	return sendProxyBytes(c, status, data, err)
}

// GetGameByID retrieves a game by its ID.
// The response will contain a JSON object of the game, which can be used to display information about the game.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetGameByID(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameByID(id)
	return sendProxyBytes(c, status, data, err)
}

// GetRelatedAddOnContent retrieves a page of games from the database that are related to the given game id.
// The query parameter is a string that can be used to specify any additional filtering or sorting options.
// For example, to sort by name in descending order, you can use "sort_by=name&order_by=desc".
// The response will contain a JSON array of game objects, which can be used to display information about the games.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetRelatedAddOnContent(c *fiber.Ctx) error {
	id := c.Params("id")
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetRelatedAddOnContent(id, query)
	return sendProxyBytes(c, status, data, err)
}

// GetAdditionalContent retrieves explicit additional-content rows for the given game id.
func GetAdditionalContent(c *fiber.Ctx) error {
	id := c.Params("id")
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetAdditionalContent(id, query)
	return sendProxyBytes(c, status, data, err)
}

// CreateGame creates a new game in the database.
// The request body should contain a JSON object representing the game to be created.
// The response will contain a JSON object representing the created game, along with a status code and any error messages if there are any issues with the request.
func CreateGame(c *fiber.Ctx) error {
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.CreateGame(c.Body())
	return sendProxyBytes(c, status, data, err)
}

// UpdateGame updates an existing game in the database.
// The request body should contain a JSON object representing the updated game.
// The response will contain a JSON object representing the updated game, along with a status code and any error messages if there are any issues with the request.
func UpdateGame(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.UpdateGame(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

// DeleteGame deletes a game by its ID.
// The response will contain a JSON object representing the deleted game, along with a status code and any error messages if there are any issues with the request.
func DeleteGame(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.DeleteGame(id)
	return sendProxyBytes(c, status, data, err)
}

// GetGamePlatforms retrieves a page of game platforms from the database that are associated with the given game ID.
// The response will contain a JSON array of game platform objects, which can be used to display information about the game platforms.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetGamePlatforms(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGamePlatforms(id)
	return sendProxyBytes(c, status, data, err)
}

// AddGamePlatform adds a platform to a game by the given ID.
// The request body should contain the platform ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func AddGamePlatform(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGamePlatform(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

// RemoveGamePlatform removes a platform from a game by the given ID.
// The request body should contain the platform ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func RemoveGamePlatform(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGamePlatform(id, platformID)
	return sendProxyBytes(c, status, data, err)
}

// GetGameKeywords retrieves a list of keywords for a game by the given ID.
// The response will contain a JSON array of keyword objects, which can be used to display information about the keywords.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetGameKeywords(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameKeywords(id)
	return sendProxyBytes(c, status, data, err)
}

// AddGameKeyword adds a keyword to a game by the given ID.
// The request body should contain the keyword ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func AddGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameKeyword(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

// RemoveGameKeyword removes a keyword from a game by the given ID.
// The request body should contain the keyword ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func RemoveGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameKeyword(id, keywordID)
	return sendProxyBytes(c, status, data, err)
}

// GetGameCompanies retrieves a list of companies associated with a game by the given ID.
// The response will contain a JSON array of company objects, which can be used to display information about the companies.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetGameCompanies(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameCompanies(id)
	return sendProxyBytes(c, status, data, err)
}

// AddGameCompany adds a company to a game by the given ID.
// The request body should contain the company ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func AddGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameCompany(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

// RemoveGameCompany removes a company from a game by the given ID.
// The request body should contain the company ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func RemoveGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Params("companyId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameCompany(id, companyID)
	return sendProxyBytes(c, status, data, err)
}

// GetGameFranchises retrieves a list of franchises associated with a game by the given ID.
// The response will contain a JSON array of franchise objects, which can be used to display information about the franchises.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetGameFranchises(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameFranchises(id)
	return sendProxyBytes(c, status, data, err)
}

// AddGameFranchise adds a franchise to a game by the given ID.
// The request body should contain the franchise ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func AddGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameFranchise(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

// RemoveGameFranchise removes a franchise from a game by the given ID.
// The request body should contain the franchise ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func RemoveGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	franchiseID := c.Params("franchiseId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameFranchise(id, franchiseID)
	return sendProxyBytes(c, status, data, err)
}

// GetGameSeries retrieves a list of series associated with a game by the given ID.
// The response will contain a JSON array of series objects, which can be used to display information about the series.
// The response will also contain a status code and any error messages if there are any issues with the request.
func GetGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameSeries(id)
	return sendProxyBytes(c, status, data, err)
}

// AddGameSeries adds a series to a game by the given ID.
// The request body should contain the series ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func AddGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameSeries(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

// RemoveGameSeries removes a series from a game by the given ID.
// The request body should contain the series ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func RemoveGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	seriesID := c.Params("seriesId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameSeries(id, seriesID)
	return sendProxyBytes(c, status, data, err)
}
