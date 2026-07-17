#!/usr/bin/env bash
#
# Recrée tous les conteneurs pacadev (infra + clients) avec --force-recreate.
# Utile après une mise à jour de docker-compose.yml ou un changement réseau.
#
# Conserve les volumes/données.
#
set -euo pipefail

PACADEV_ROOT="${PACADEV_ROOT:-/home/pacadev/pacadev}"
INFRA_ROOT="$PACADEV_ROOT/core/infra"
LOG_DIR="${HOME}/.pacadev/logs"
LOG_FILE="${LOG_DIR}/recreate-containers-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "═══════════════════════════════════════════════════"
echo "🔁 PACADEV — Recréation des conteneurs"
echo "═══════════════════════════════════════════════════"
echo "Date  : $(date)"
echo "Root  : $PACADEV_ROOT"
echo "Log   : $LOG_FILE"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker introuvable" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: docker compose / docker-compose introuvable" >&2
  exit 1
fi

echo "Docker info (head):"
docker info | head -n 15

echo ""
echo "Networks :"
docker network ls

# Garantir pacadev-network
docker network inspect pacadev-network >/dev/null 2>&1 || docker network create pacadev-network

echo ""
echo "Containers (avant) :"
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

echo ""
echo "→ Recréation infra/postgres"
"${COMPOSE[@]}" -f "$INFRA_ROOT/postgres/docker-compose.yml" up -d --force-recreate

echo ""
echo "→ Recréation infra/traefik"
"${COMPOSE[@]}" -f "$INFRA_ROOT/traefik/docker-compose.yml" up -d --force-recreate

echo ""
echo "→ Recréation des clients v14/v17/v19"
find "$PACADEV_ROOT/v14/clients" "$PACADEV_ROOT/v17/clients" "$PACADEV_ROOT/v19/clients" \
  -maxdepth 2 -name docker-compose.yml -print 2>/dev/null | while IFS= read -r f; do
  echo "--- $f"
  "${COMPOSE[@]}" -f "$f" up -d --force-recreate
done

echo ""
echo "Containers (après) :"
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

echo ""
echo "✅ Recréation terminée. Log : $LOG_FILE"
