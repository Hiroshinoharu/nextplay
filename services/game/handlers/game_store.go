package handlers

import gamedb "github.com/maxceban/nextplay/services/game/db"

// Stubs for database functions, which can be overridden in tests to use mock implementations. This allows us to test the handlers without needing a real database connection, and to simulate different scenarios such as errors or specific data conditions.
var (
	getGamesFromStore               = gamedb.GetGames
	searchGamesByNameFromStore      = gamedb.SearchGamesByName
	getPopularGamesFromStore        = gamedb.GetPopularGames
	getTopGamesFromStore            = gamedb.GetTopGames
	getQuestionnaireFacetsFromStore = gamedb.GetQuestionnaireFacets
	getGameByIDFromStore            = gamedb.GetGameByID
	getGameRelationsFromStore       = gamedb.GetGameRelations
	getGameMediaFromStore           = gamedb.GetGameMedia
	getRelatedAddOnContentFromStore = gamedb.GetRelatedAddOnContent
	getAdditionalContentFromStore   = gamedb.GetAdditionalContent
	createGameInStore               = gamedb.CreateGame
	updateGameInStore               = gamedb.UpdateGame
	deleteGameFromStore             = gamedb.DeleteGame
)
