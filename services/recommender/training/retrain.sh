#!/usr/bin/env bash
set -euo pipefail

python -m services.recommender.training.retrain "$@"