package handlers

import (
    "github.com/gofiber/fiber/v2"
    "github.com/maxceban/nextplay/services/gateway/clients"
)

var gameClient = clients.NewGameClient()

// ------------ BASIC GAME CRUD ------------

func GetAllGames(c *fiber.Ctx) error {
    status, data, err := gameClient.GetAllGames()
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func GetGameByID(c *fiber.Ctx) error {
    id := c.Params("id")
    status, data, err := gameClient.GetGameByID(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func CreateGame(c *fiber.Ctx) error {
    body := c.Body()
    status, data, err := gameClient.CreateGame(body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func UpdateGame(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    status, data, err := gameClient.UpdateGame(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func DeleteGame(c *fiber.Ctx) error {
    id := c.Params("id")
    status, data, err := gameClient.DeleteGame(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

// ------------ RELATIONS (EXAMPLE) ------------

func GetGamePlatforms(c *fiber.Ctx) error {
    id := c.Params("id")
    status, data, err := gameClient.GetGamePlatforms(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func AddGamePlatform(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    status, data, err := gameClient.AddGamePlatform(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func RemoveGamePlatform(c *fiber.Ctx) error {
    id := c.Params("id")
    platformID := c.Params("platformId")
    status, data, err := gameClient.RemoveGamePlatform(id, platformID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func GetGameKeywords(c *fiber.Ctx) error {
    id := c.Params("id")
    status, data, err := gameClient.GetGameKeywords(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func AddGameKeyword(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    status, data, err := gameClient.AddGameKeyword(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func RemoveGameKeyword(c *fiber.Ctx) error {
    id := c.Params("id")
    keywordID := c.Params("keywordId")
    status, data, err := gameClient.RemoveGameKeyword(id, keywordID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func GetGameCompanies(c *fiber.Ctx) error {
    id := c.Params("id")
    status, data, err := gameClient.GetGameCompanies(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func AddGameCompany(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    status, data, err := gameClient.AddGameCompany(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func RemoveGameCompany(c *fiber.Ctx) error {
    id := c.Params("id")
    companyID := c.Params("companyId")
    status, data, err := gameClient.RemoveGameCompany(id, companyID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func GetGameFranchises(c *fiber.Ctx) error {
    id := c.Params("id")
    status, data, err := gameClient.GetGameFranchises(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func AddGameFranchise(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    status, data, err := gameClient.AddGameFranchise(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func RemoveGameFranchise(c *fiber.Ctx) error {
    id := c.Params("id")
    franchiseID := c.Params("franchiseId")
    status, data, err := gameClient.RemoveGameFranchise(id, franchiseID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func GetGameSeries(c *fiber.Ctx) error {
    id := c.Params("id")
    status, data, err := gameClient.GetGameSeries(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func AddGameSeries(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    status, data, err := gameClient.AddGameSeries(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}

func RemoveGameSeries(c *fiber.Ctx) error {
    id := c.Params("id")
    seriesID := c.Params("seriesId")
    status, data, err := gameClient.RemoveGameSeries(id, seriesID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Status(status).Send(data)
}
