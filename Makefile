.PHONY: retrain retrain-export retrain-from-db retrain-from-db-local

RETRAIN_SCRIPT := services/recommender/training/retrain.sh
TRAINING_DIR := services/recommender/training
COMPOSE_FILE := deploy/docker-compose.yml

retrain:
	bash $(RETRAIN_SCRIPT) $(ARGS)

retrain-export:
	@set -eu; \
	ts=$$(date -u +%Y%m%d%H%M%S); \
	out="$(TRAINING_DIR)/user_interactions_$${ts}.csv"; \
	tmp="$${out}.tmp"; \
	rm -f "$${tmp}"; \
	docker compose -f $(COMPOSE_FILE) exec -T postgres psql -U nextplay -d nextplay -c "\copy (SELECT user_id::text AS user_id, game_id::text AS game_id, COALESCE(rating::text, '') AS rating, COALESCE(review, '') AS review, CASE WHEN liked IS NULL THEN '' WHEN liked THEN 'true' ELSE 'false' END AS liked, CASE WHEN favorited IS NULL THEN '' WHEN favorited THEN 'true' ELSE 'false' END AS favorited, to_char(COALESCE(\"timestamp\", now()) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS +0000') AS timestamp FROM user_interactions ORDER BY COALESCE(\"timestamp\", now())) TO STDOUT WITH (FORMAT CSV, HEADER true)" > "$${tmp}"; \
	test -s "$${tmp}"; \
	mv "$${tmp}" "$${out}"; \
	echo "Exported $${out}"

retrain-from-db: retrain-export
	bash $(RETRAIN_SCRIPT) $(ARGS)

retrain-from-db-local: retrain-export
	@bash $(RETRAIN_SCRIPT) $(ARGS) || { \
		echo "Retrain completed but offline gate thresholds failed (non-blocking local mode)."; \
	}
