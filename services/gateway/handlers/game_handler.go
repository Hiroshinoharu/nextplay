package handlers

import (
    "github.com/gofiber/fiber/v2"
    "github.com/maxceban/nextplay/services/gateway/clients"
)

var gameClient = clients.NewGameClient()

// ------------ BASIC GAME CRUD ------------

func GetAllGames(c *fiber.Ctx) error {
    data, err := gameClient.GetAllGames()
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func GetGameByID(c *fiber.Ctx) error {
    id := c.Params("id")
    data, err := gameClient.GetGameByID(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func CreateGame(c *fiber.Ctx) error {
    body := c.Body()
    data, err := gameClient.CreateGame(body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func UpdateGame(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    data, err := gameClient.UpdateGame(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func DeleteGame(c *fiber.Ctx) error {
    id := c.Params("id")
    data, err := gameClient.DeleteGame(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

// ------------ RELATIONS (EXAMPLE) ------------

func GetGamePlatforms(c *fiber.Ctx) error {
    id := c.Params("id")
    data, err := gameClient.GetGamePlatforms(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func AddGamePlatform(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    data, err := gameClient.AddGamePlatform(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func RemoveGamePlatform(c *fiber.Ctx) error {
    id := c.Params("id")
    platformID := c.Params("platformId")
    data, err := gameClient.RemoveGamePlatform(id, platformID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func GetGameKeywords(c *fiber.Ctx) error {
    id := c.Params("id")
    data, err := gameClient.GetGameKeywords(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func AddGameKeyword(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    data, err := gameClient.AddGameKeyword(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func RemoveGameKeyword(c *fiber.Ctx) error {
    id := c.Params("id")
    keywordID := c.Params("keywordId")
    data, err := gameClient.RemoveGameKeyword(id, keywordID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func GetGameCompanies(c *fiber.Ctx) error {
    id := c.Params("id")
    data, err := gameClient.GetGameCompanies(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func AddGameCompany(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    data, err := gameClient.AddGameCompany(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func RemoveGameCompany(c *fiber.Ctx) error {
    id := c.Params("id")
    companyID := c.Params("companyId")
    data, err := gameClient.RemoveGameCompany(id, companyID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func GetGameFranchises(c *fiber.Ctx) error {
    id := c.Params("id")
    data, err := gameClient.GetGameFranchises(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func AddGameFranchise(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    data, err := gameClient.AddGameFranchise(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func RemoveGameFranchise(c *fiber.Ctx) error {
    id := c.Params("id")
    franchiseID := c.Params("franchiseId")
    data, err := gameClient.RemoveGameFranchise(id, franchiseID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func GetGameSeries(c *fiber.Ctx) error {
    id := c.Params("id")
    data, err := gameClient.GetGameSeries(id)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func AddGameSeries(c *fiber.Ctx) error {
    id := c.Params("id")
    body := c.Body()
    data, err := gameClient.AddGameSeries(id, body)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}

func RemoveGameSeries(c *fiber.Ctx) error {
    id := c.Params("id")
    seriesID := c.Params("seriesId")
    data, err := gameClient.RemoveGameSeries(id, seriesID)
    if err != nil { return c.Status(502).JSON(fiber.Map{"error": err.Error()}) }
    return c.Send(data)
}
