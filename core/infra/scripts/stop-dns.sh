#!/usr/bin/env bash
# PACADEV — Arrête le DNS wildcard (dnsmasq)
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose -f dns/docker-compose.yml down
echo "✅ DNS wildcard arrêté"
