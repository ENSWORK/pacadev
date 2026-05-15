#!/usr/bin/env bash
# Arrête l'infrastructure partagée pacadev (PG + Traefik).
# Conserve les données (volumes/bind mounts).
set -euo pipefail

INFRA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ Arrêt pacadev_traefik"
docker compose -f "$INFRA_ROOT/traefik/docker-compose.yml" down

echo "→ Arrêt pacadev_postgres_shared"
docker compose -f "$INFRA_ROOT/postgres/docker-compose.yml" down

echo "✅ Infra pacadev arrêtée (données préservées)."
