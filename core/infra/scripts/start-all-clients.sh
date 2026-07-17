#!/usr/bin/env bash
#
# Démarre tous les clients pacadev découverts dans v14/, v17/, v19/.
# Vérifie l'état de chaque conteneur après démarrage.
#
# Variables :
#   PACADEV_ROOT (def: /home/pacadev/pacadev)
#   PACADEV_SKIP_INFRA (def: 0) — si 1, ne démarre pas l'infra partagée
#

set -euo pipefail

PACADEV_ROOT="${PACADEV_ROOT:-/home/pacadev/pacadev}"
LOG_DIR="${HOME}/.pacadev/logs"
LOG_FILE="${LOG_DIR}/start-all-clients-$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo "═══════════════════════════════════════════════════"
echo "🚀 PACADEV — Démarrage de tous les clients"
echo "═══════════════════════════════════════════════════"
echo "Workspace : $PACADEV_ROOT"
echo "Log       : $LOG_FILE"
echo ""

# 0. Infra (sauf si --skip-infra)
if [ "${PACADEV_SKIP_INFRA:-0}" != "1" ]; then
  echo -e "${BLUE}→ Vérification infra pacadev-network${NC}"
  if ! docker network inspect pacadev-network >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  pacadev-network absent. Lance 'pacadev infra start' d'abord.${NC}"
  fi
fi

start_client() {
  local client_path="$1"
  local client_name="$(basename "$client_path")"
  local version="$2"
  local compose="$client_path/docker-compose.yml"

  echo "───────────────────────────────────────────────────"
  echo -e "${BLUE}📦 $client_name (v$version)${NC}"
  echo "───────────────────────────────────────────────────"

  if [ ! -f "$compose" ]; then
    echo -e "${RED}❌ Pas de docker-compose.yml${NC}"
    return 1
  fi

  if docker compose -f "$compose" up -d 2>&1; then
    echo -e "${GREEN}✅ docker compose up exécuté${NC}"
    sleep 3

    # Container Odoo principal : <client>_odoo_1 ou <client>_odoo
    container=$(docker ps --filter "name=${client_name}_odoo" --format '{{.Names}}' | head -1)
    if [ -n "$container" ]; then
      status=$(docker inspect -f '{{.State.Status}}' "$container")
      [ "$status" = "running" ] && \
        echo -e "${GREEN}✅ $container : running${NC}" || \
        echo -e "${RED}❌ $container : $status${NC}"

      # Détection erreurs récentes dans logs
      if docker logs "$container" --tail 30 2>&1 | grep -qiE 'CRITICAL|Traceback|FATAL'; then
        echo -e "${YELLOW}⚠️  Erreurs détectées (voir docker logs $container)${NC}"
      fi
    else
      echo -e "${YELLOW}⚠️  Aucun container *_odoo* détecté pour $client_name${NC}"
    fi
  else
    echo -e "${RED}❌ Échec docker compose up${NC}"
  fi
  echo ""
}

# Découverte dynamique des clients (au lieu de hardcoder)
for version_dir in "$PACADEV_ROOT"/v14 "$PACADEV_ROOT"/v17 "$PACADEV_ROOT"/v19; do
  [ -d "$version_dir/clients" ] || continue
  version=$(basename "$version_dir" | sed 's/^v//')
  echo "═══════════════════════════════════════════════════"
  echo "🟦 CLIENTS v${version}"
  echo "═══════════════════════════════════════════════════"
  for client_dir in "$version_dir/clients"/*/; do
    [ -d "$client_dir" ] || continue
    start_client "$client_dir" "$version" || true
  done
done

echo "═══════════════════════════════════════════════════"
echo "📊 Résumé final"
echo "═══════════════════════════════════════════════════"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'odoo|postgres|redis|traefik' || true
echo ""
echo "✅ Terminé. Log : $LOG_FILE"
