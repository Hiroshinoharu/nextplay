package handlers

import (
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
)

type interactionResponse struct {
	UserID    int        `json:"user_id"`
	GameID    int        `json:"game_id"`
	Rating    *float64   `json:"rating,omitempty"`
	Review    *string    `json:"review,omitempty"`
	Liked     *bool      `json:"liked,omitempty"`
	Favorited *bool      `json:"favorited,omitempty"`
	Timestamp *time.Time `json:"timestamp,omitempty"`
}

type interactionRequest struct {
	GameID    int      `json:"game_id"`
	Rating    *float64 `json:"rating"`
	Review    *string  `json:"review"`
	Liked     *bool    `json:"liked"`
	Favorited *bool    `json:"favorited"`
}

type recommendationEventRequest struct {
	GameID             int                    `json:"game_id"`
	RequestID          string                 `json:"request_id"`
	EventType          string                 `json:"event_type"`
	ModelVersion       string                 `json:"model_version"`
	RankingProfile     string                 `json:"ranking_profile"`
	Strategy           string                 `json:"strategy"`
	Outcome            string                 `json:"outcome"`
	RecommendationRank *int                   `json:"recommendation_rank"`
	Metadata           map[string]interface{} `json:"metadata"`
}

type recommendationEventResponse struct {
	EventID            int                    `json:"event_id"`
	UserID             int                    `json:"user_id"`
	GameID             int                    `json:"game_id"`
	RequestID          string                 `json:"request_id"`
	EventType          string                 `json:"event_type"`
	ModelVersion       string                 `json:"model_version,omitempty"`
	RankingProfile     string                 `json:"ranking_profile,omitempty"`
	Strategy           string                 `json:"strategy,omitempty"`
	Outcome            string                 `json:"outcome,omitempty"`
	RecommendationRank *int                   `json:"recommendation_rank,omitempty"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt          *time.Time             `json:"created_at,omitempty"`
}

var allowedRecommendationEventTypes = map[string]struct{}{
	"recommendation_exposure": {},
	"recommendation_open":     {},
	"recommendation_favorite": {},
	"recommendation_dismiss":  {},
}

// parseLimit parses a string into an integer, returning the fallback value if the string is empty or contains an invalid integer.
// If the fallback value is less than or equal to 0, it is set to 50.
// The parsed value is capped at 200 and will return 200 if the parsed value is greater than 200.
func parseLimit(raw string, fallback int) int {
	if fallback <= 0 {
		fallback = 50
	}
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	if parsed > 200 {
		return 200
	}
	return parsed
}

// upsertInteractionFromRecommendationEvent updates or inserts a user's interaction with a game based on a recommendation event.
// If the event type is "recommendation_favorite", it sets the game as favorited and sets the timestamp to now.
// If the event type is "recommendation_dismiss", it sets the game as not liked and sets the favorited state to the current value of the favorited column.
// If the event type is not recognized, it returns nil.
func upsertInteractionFromRecommendationEvent(userID string, req recommendationEventRequest) error {
	if db.DB == nil {
		return nil
	}

	switch req.EventType {
	case "recommendation_favorite":
		_, err := db.DB.Exec(
			`INSERT INTO user_interactions (user_id, game_id, rating, review, liked, favorited, timestamp)
             VALUES ($1, $2, NULL, NULL, NULL, TRUE, NOW())
             ON CONFLICT (user_id, game_id) DO UPDATE
             SET favorited = TRUE,
                 timestamp = NOW()`,
			userID,
			req.GameID,
		)
		return err
	case "recommendation_dismiss":
		_, err := db.DB.Exec(
			`INSERT INTO user_interactions (user_id, game_id, rating, review, liked, favorited, timestamp)
             VALUES ($1, $2, NULL, NULL, FALSE, FALSE, NOW())
             ON CONFLICT (user_id, game_id) DO UPDATE
             SET liked = FALSE,
                 favorited = CASE
                     WHEN user_interactions.favorited = TRUE THEN user_interactions.favorited
                     ELSE FALSE
                 END,
                 timestamp = NOW()`,
			userID,
			req.GameID,
		)
		return err
	default:
		return nil
	}
}

// GetInteractions handles GET /users/:id/interactions requests
func GetInteractions(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}
	if err := requireActiveUser(userID); err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify user"})
	}

	rows, err := db.DB.Query(
		"SELECT user_id, game_id, rating, review, liked, favorited, timestamp FROM user_interactions WHERE user_id = $1 ORDER BY timestamp DESC NULLS LAST, game_id DESC",
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch interactions"})
	}
	defer rows.Close()

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
	if err := requireActiveUser(userID); err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify user"})
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
	if err := requireActiveUser(userID); err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify user"})
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

// GetInteractionEvents handles GET /users/:id/interactions/events requests
func GetInteractionEvents(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}
	if err := requireActiveUser(userID); err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify user"})
	}

	limit := parseLimit(c.Query("limit"), 50)
	eventType := strings.TrimSpace(strings.ToLower(c.Query("event_type")))

	query := `SELECT event_id, user_id, game_id, request_id, event_type, model_version, ranking_profile, strategy, outcome, recommendation_rank, metadata, created_at
        FROM recommendation_events
        WHERE user_id = $1`
	args := []interface{}{userID}
	if eventType != "" {
		query += " AND event_type = $2"
		args = append(args, eventType)
		query += " ORDER BY created_at DESC LIMIT $3"
		args = append(args, limit)
	} else {
		query += " ORDER BY created_at DESC LIMIT $2"
		args = append(args, limit)
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch interaction events"})
	}
	defer rows.Close()

	events := make([]recommendationEventResponse, 0)
	for rows.Next() {
		var (
			item               recommendationEventResponse
			modelVersionVal    sql.NullString
			rankingProfileVal  sql.NullString
			strategyVal        sql.NullString
			outcomeVal         sql.NullString
			recommendationRank sql.NullInt64
			metadataRaw        []byte
			createdAtVal       sql.NullTime
		)
		if err := rows.Scan(
			&item.EventID,
			&item.UserID,
			&item.GameID,
			&item.RequestID,
			&item.EventType,
			&modelVersionVal,
			&rankingProfileVal,
			&strategyVal,
			&outcomeVal,
			&recommendationRank,
			&metadataRaw,
			&createdAtVal,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read interaction events"})
		}
		if modelVersionVal.Valid {
			item.ModelVersion = modelVersionVal.String
		}
		if rankingProfileVal.Valid {
			item.RankingProfile = rankingProfileVal.String
		}
		if strategyVal.Valid {
			item.Strategy = strategyVal.String
		}
		if outcomeVal.Valid {
			item.Outcome = outcomeVal.String
		}
		if recommendationRank.Valid {
			rank := int(recommendationRank.Int64)
			item.RecommendationRank = &rank
		}
		if len(metadataRaw) > 0 {
			metadata := map[string]interface{}{}
			if err := json.Unmarshal(metadataRaw, &metadata); err == nil {
				item.Metadata = metadata
			}
		}
		if createdAtVal.Valid {
			item.CreatedAt = &createdAtVal.Time
		}
		events = append(events, item)
	}
	if err := rows.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch interaction events"})
	}

	return c.JSON(events)
}

// AddInteractionEvent handles POST /users/:id/interactions/events requests
func AddInteractionEvent(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}
	if err := requireActiveUser(userID); err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify user"})
	}

	var req recommendationEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.GameID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "game_id is required"})
	}
	req.EventType = strings.TrimSpace(strings.ToLower(req.EventType))
	if _, ok := allowedRecommendationEventTypes[req.EventType]; !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unsupported event_type"})
	}
	metadataJSON, err := json.Marshal(req.Metadata)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid metadata"})
	}

	var eventID int
	var createdAt time.Time
	err = db.DB.QueryRow(
		`INSERT INTO recommendation_events (
            user_id,
            game_id,
            request_id,
            event_type,
            model_version,
            ranking_profile,
            strategy,
            outcome,
            recommendation_rank,
            metadata,
            created_at
        ) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), $9, $10::jsonb, NOW())
        RETURNING event_id, created_at`,
		userID,
		req.GameID,
		req.RequestID,
		req.EventType,
		req.ModelVersion,
		req.RankingProfile,
		req.Strategy,
		req.Outcome,
		req.RecommendationRank,
		string(metadataJSON),
	).Scan(&eventID, &createdAt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save interaction event"})
	}

	if err := upsertInteractionFromRecommendationEvent(userID, req); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update interaction summary"})
	}

	userIDInt, _ := strconv.Atoi(userID)

	return c.Status(fiber.StatusCreated).JSON(recommendationEventResponse{
		EventID:            eventID,
		UserID:             userIDInt,
		GameID:             req.GameID,
		RequestID:          req.RequestID,
		EventType:          req.EventType,
		ModelVersion:       req.ModelVersion,
		RankingProfile:     req.RankingProfile,
		Strategy:           req.Strategy,
		Outcome:            req.Outcome,
		RecommendationRank: req.RecommendationRank,
		Metadata:           req.Metadata,
		CreatedAt:          &createdAt,
	})
}
