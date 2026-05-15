#!/usr/bin/env bash
#
# Démarre l'infrastructure partagée pacadev :
#   - réseau pacadev-network (créé s'il n'existe pas)
#   - pacadev_postgres_shared (PG 14)
#   - pacadev_traefik (v2.11)
#
# Variables d'environnement supportées :
#   POSTGRES_USER (def: odoo)
#   POSTGRES_PASSWORD (def: odoo)
#   PACADEV_PG_HOST_PORT (def: 5434)
#   PACADEV_TRAEFIK_WEB_PORT (def: 8090)
#   PACADEV_TRAEFIK_DASHBOARD_PORT (def: 8091)
#
set -euo pipefail

INFRA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${HOME}/.pacadev/logs"
LOG_FILE="${LOG_DIR}/start-infra-$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo "═══════════════════════════════════════════════════"
echo "🚀 PACADEV — Démarrage infra partagée"
echo "═══════════════════════════════════════════════════"
echo "Log : $LOG_FILE"
echo ""

# 1. Network
if docker network inspect pacadev-network >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Network pacadev-network existe${NC}"
else
  echo -e "${BLUE}→ Création network pacadev-network${NC}"
  docker network create pacadev-network
fi
echo ""

# 2. PostgreSQL
echo -e "${BLUE}→ Démarrage pacadev_postgres_shared${NC}"
docker compose -f "$INFRA_ROOT/postgres/docker-compose.yml" up -d
echo ""

# 3. Traefik
echo -e "${BLUE}→ Démarrage pacadev_traefik${NC}"
docker compose -f "$INFRA_ROOT/traefik/docker-compose.yml" up -d
echo ""

# 4. Healthchecks
echo "Healthcheck attente (10s)..."
sleep 10

for svc in pacadev_postgres_shared pacadev_traefik; do
  status=$(docker inspect -f '{{.State.Status}}' "$svc" 2>/dev/null || echo "absent")
  if [ "$status" = "running" ]; then
    echo -e "${GREEN}✅ $svc : running${NC}"
  else
    echo -e "${RED}❌ $svc : $status${NC}"
  fi
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Infra pacadev démarrée"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Accès :"
echo "  PG host      : localhost:${PACADEV_PG_HOST_PORT:-5434}  (user=${POSTGRES_USER:-odoo})"
echo "  Traefik web  : http://localhost:${PACADEV_TRAEFIK_WEB_PORT:-8090}"
echo "  Traefik dash : http://localhost:${PACADEV_TRAEFIK_DASHBOARD_PORT:-8091}"
echo ""
echo "Pour ajouter une entrée /etc/hosts (résolution Traefik) :"
echo "  echo '127.0.0.1 dashboard.pacadev.local grafana.pacadev.local' | sudo tee -a /etc/hosts"
echo ""
