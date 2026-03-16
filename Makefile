.PHONY: help retrain retrain-export retrain-from-db retrain-from-db-local recommender-balanced recommender-favorites-strong retrain-seeded-xl retrain-seeded-xl-local tensorboard

RETRAIN_SCRIPT := services/recommender/training/retrain.sh
TRAINING_DIR := services/recommender/training
COMPOSE_FILE := deploy/docker-compose.yml

ifeq ($(OS),Windows_NT)
SHELL := C:/Progra~1/Git/usr/bin/sh.exe
BASH := C:/Progra~1/Git/bin/bash.exe
else
SHELL := /bin/sh
BASH := bash
endif

help:
	@printf "%s\n" \
		"Available targets:" \
		"  make retrain" \
		"  make retrain-export" \
		"  make retrain-from-db" \
		"  make retrain-from-db-local" \
		"  make recommender-balanced" \
		"  make recommender-favorites-strong" \
		"  make retrain-seeded-xl" \
		"  make retrain-seeded-xl-local" \
		"  make tensorboard"

retrain:
	$(BASH) $(RETRAIN_SCRIPT) $(ARGS)

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
	$(BASH) $(RETRAIN_SCRIPT) $(ARGS)

retrain-from-db-local: retrain-export
	@$(BASH) $(RETRAIN_SCRIPT) $(ARGS) || { \
		echo "Retrain completed but offline gate thresholds failed (non-blocking local mode)."; \
	}

recommender-balanced:
	@docker compose -f $(COMPOSE_FILE) up -d --build recommender gateway
	@echo "Recommender profile: balanced"

recommender-favorites-strong:
	@RANK_WEIGHT_FAVORITE_KEYWORD="4.2" \
	RANK_WEIGHT_FAVORITE_PLATFORM="2.5" \
	RANK_WEIGHT_FAVORITE_GENRE="3.0" \
	RANK_WEIGHT_FAVORITE_TEXT_SIM="8.5" \
	RANK_WEIGHT_FAVORITE_SEED_BOOST="12.0" \
	docker compose -f $(COMPOSE_FILE) up -d --build recommender gateway
	@echo "Recommender profile: favorites-strong"

retrain-seeded-xl:
	@python -m services.recommender.training.retrain --source_mode seeded_plus_db --seed_users 10000 --seed_games 50000 --seed_history_per_user 50 --seed_holdout_per_user 5 --epochs 12 --batch_size 64 --thresholds_json services/recommender/training/offline_eval_thresholds_large_catalog.json --promote_current; \
	status=$$?; \
	if [ "$$status" -eq 3 ]; then \
		echo "Retrain completed, but offline evaluation gates failed so promotion was blocked."; \
		exit 3; \
	elif [ "$$status" -ne 0 ]; then \
		exit "$$status"; \
	fi
	@echo "Retrain profile: seeded-xl"

retrain-seeded-xl-local:
	@python -m services.recommender.training.retrain --source_mode seeded_plus_db --seed_users 10000 --seed_games 50000 --seed_history_per_user 50 --seed_holdout_per_user 5 --epochs 12 --batch_size 64 --thresholds_json services/recommender/training/offline_eval_thresholds_large_catalog.json --promote_current; \
	status=$$?; \
	if [ "$$status" -eq 3 ]; then \
		echo "Retrain completed, but offline evaluation gates failed so promotion was blocked (non-blocking local mode)."; \
		exit 0; \
	elif [ "$$status" -ne 0 ]; then \
		exit "$$status"; \
	fi
	@echo "Retrain profile: seeded-xl-local"

tensorboard:
	@tensorboard --logdir services/recommender/training/runs
