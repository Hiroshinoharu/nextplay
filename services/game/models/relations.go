package models

// GameKeyword stores a game-to-keyword relationship.
type GameKeyword struct {
	GameID    int64 `json:"game_id"`
	KeywordID int64 `json:"keyword_id"`
}

// GamePlatform stores a game-to-platform relationship.
type GamePlatform struct {
	GameID     int64 `json:"game_id"`
	PlatformID int64 `json:"platform_id"`
}

// GameCompany stores a game-to-company relationship and contribution roles.
type GameCompany struct {
	GameID                int64 `json:"game_id"`
	CompanyID             int64 `json:"company_id"`
	IsDeveloper           bool  `json:"is_developer"`
	IsPublisher           bool  `json:"is_publisher"`
	IsSupportingDeveloper bool  `json:"is_supporting_developer"`
	IsPortingDeveloper    bool  `json:"is_porting_developer"`
}

// GameSeries stores a game-to-series relationship.
type GameSeries struct {
	GameID   int64 `json:"game_id"`
	SeriesID int64 `json:"series_id"`
}

// GameFranchise stores a game-to-franchise relationship.
type GameFranchise struct {
	GameID      int64 `json:"game_id"`
	FranchiseID int64 `json:"franchise_id"`
}
