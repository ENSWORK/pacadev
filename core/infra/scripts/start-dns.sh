#!/usr/bin/env bash
# PACADEV — Démarre le DNS wildcard (dnsmasq)
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose -f dns/docker-compose.yml up -d
echo "✅ DNS wildcard démarré — *.pacadev.local → 192.168.11.20"
