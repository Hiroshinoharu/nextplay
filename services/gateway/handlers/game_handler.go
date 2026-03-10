package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

func GetAllGames(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetAllGames(query)
	return sendProxyBytes(c, status, data, err)
}

func SearchGamesByName(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.SearchGamesByName(query)
	return sendProxyBytes(c, status, data, err)
}

func GetPopularGames(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetPopularGames(query)
	return sendProxyBytes(c, status, data, err)
}

func GetTopGames(c *fiber.Ctx) error {
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetTopGames(query)
	return sendProxyBytes(c, status, data, err)
}

func GetGameByID(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameByID(id)
	return sendProxyBytes(c, status, data, err)
}

func GetRelatedAddOnContent(c *fiber.Ctx) error {
	id := c.Params("id")
	query := c.Context().QueryArgs().String()
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetRelatedAddOnContent(id, query)
	return sendProxyBytes(c, status, data, err)
}

func CreateGame(c *fiber.Ctx) error {
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.CreateGame(c.Body())
	return sendProxyBytes(c, status, data, err)
}

func UpdateGame(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.UpdateGame(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

func DeleteGame(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.DeleteGame(id)
	return sendProxyBytes(c, status, data, err)
}

func GetGamePlatforms(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGamePlatforms(id)
	return sendProxyBytes(c, status, data, err)
}

func AddGamePlatform(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGamePlatform(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

func RemoveGamePlatform(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGamePlatform(id, platformID)
	return sendProxyBytes(c, status, data, err)
}

func GetGameKeywords(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameKeywords(id)
	return sendProxyBytes(c, status, data, err)
}

func AddGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameKeyword(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

func RemoveGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameKeyword(id, keywordID)
	return sendProxyBytes(c, status, data, err)
}

func GetGameCompanies(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameCompanies(id)
	return sendProxyBytes(c, status, data, err)
}

func AddGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameCompany(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

func RemoveGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Params("companyId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameCompany(id, companyID)
	return sendProxyBytes(c, status, data, err)
}

func GetGameFranchises(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameFranchises(id)
	return sendProxyBytes(c, status, data, err)
}

func AddGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameFranchise(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

func RemoveGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	franchiseID := c.Params("franchiseId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameFranchise(id, franchiseID)
	return sendProxyBytes(c, status, data, err)
}

func GetGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.GetGameSeries(id)
	return sendProxyBytes(c, status, data, err)
}

func AddGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.AddGameSeries(id, c.Body())
	return sendProxyBytes(c, status, data, err)
}

func RemoveGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	seriesID := c.Params("seriesId")
	gameClient := clients.NewGameClientWithHeaders(forwardingHeaders(c))
	status, data, err := gameClient.RemoveGameSeries(id, seriesID)
	return sendProxyBytes(c, status, data, err)
}
