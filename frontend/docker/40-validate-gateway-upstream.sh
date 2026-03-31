#!/bin/sh
set -eu

if [ -z "${GATEWAY_UPSTREAM_URL:-}" ]; then
  echo "GATEWAY_UPSTREAM_URL must be set for the frontend container." >&2
  exit 1
fi