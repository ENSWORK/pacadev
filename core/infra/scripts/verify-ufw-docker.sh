#!/bin/bash
#
# Script de vérification de la configuration UFW + Docker
# Diagnostique les problèmes de connectivité entre conteneurs
#
# Usage: sudo ./verify-ufw-docker.sh
#

echo "=================================================="
echo "🔍 Vérification Configuration UFW + Docker"
echo "=================================================="
echo ""

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher un résultat
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        return 0
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "ℹ️  $1"
}

# Compteurs
PASS=0
FAIL=0

echo "1️⃣  Vérification du statut UFW"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if systemctl is-active --quiet ufw; then
    check_result 0 "UFW est actif"
    PASS=$((PASS + 1))

    # Vérifier la politique de forwarding
    FORWARD_POLICY=$(grep DEFAULT_FORWARD_POLICY /etc/default/ufw | cut -d'"' -f2)
    if [ "$FORWARD_POLICY" = "ACCEPT" ]; then
        check_result 0 "DEFAULT_FORWARD_POLICY est sur ACCEPT"
        PASS=$((PASS + 1))
    else
        check_result 1 "DEFAULT_FORWARD_POLICY est sur $FORWARD_POLICY (devrait être ACCEPT)"
        FAIL=$((FAIL + 1))
        warning "Exécutez: sudo sed -i 's/DEFAULT_FORWARD_POLICY=\"DROP\"/DEFAULT_FORWARD_POLICY=\"ACCEPT\"/' /etc/default/ufw"
    fi
else
    warning "UFW est inactif"
    info "Si UFW est désactivé, Docker fonctionne normalement"
fi
echo ""

echo "2️⃣  Vérification des règles Docker dans UFW"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "BEGIN UFW AND DOCKER" /etc/ufw/after.rules 2>/dev/null; then
    check_result 0 "Règles Docker présentes dans /etc/ufw/after.rules"
    PASS=$((PASS + 1))

    # Compter les règles
    RULE_COUNT=$(grep -c "DOCKER-USER" /etc/ufw/after.rules 2>/dev/null || echo "0")
    info "Nombre de règles DOCKER-USER: $RULE_COUNT"
else
    check_result 1 "Règles Docker ABSENTES de /etc/ufw/after.rules"
    FAIL=$((FAIL + 1))
    warning "Exécutez: sudo ~/pacadev/core/infra/scripts/configure-ufw-docker.sh"
fi
echo ""

echo "3️⃣  Vérification du service Docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if systemctl is-active --quiet docker; then
    check_result 0 "Docker est actif"
    PASS=$((PASS + 1))

    # Vérifier depuis combien de temps Docker tourne
    DOCKER_UPTIME=$(systemctl show docker --property=ActiveEnterTimestamp | cut -d'=' -f2)
    info "Docker démarré: $DOCKER_UPTIME"
else
    check_result 1 "Docker est inactif"
    FAIL=$((FAIL + 1))
    warning "Exécutez: sudo systemctl start docker"
fi
echo ""

echo "4️⃣  Vérification du réseau Docker odoo-network"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if docker network inspect odoo-network >/dev/null 2>&1; then
    check_result 0 "Réseau odoo-network existe"
    PASS=$((PASS + 1))

    # Lister les conteneurs sur ce réseau
    CONTAINERS=$(docker network inspect odoo-network --format '{{range .Containers}}{{.Name}} {{end}}')
    info "Conteneurs: $CONTAINERS"

    # Vérifier le subnet
    SUBNET=$(docker network inspect odoo-network --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
    info "Subnet: $SUBNET"
else
    check_result 1 "Réseau odoo-network n'existe pas"
    FAIL=$((FAIL + 1))
    warning "Créez le réseau: docker network create odoo-network"
fi
echo ""

echo "5️⃣  Vérification des conteneurs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# PostgreSQL
if docker ps --filter "name=odoo_postgres_shared" --format "{{.Names}}" | grep -q odoo_postgres_shared; then
    check_result 0 "Conteneur odoo_postgres_shared est en cours d'exécution"
    PASS=$((PASS + 1))

    # Vérifier l'IP
    PG_IP=$(docker inspect odoo_postgres_shared --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    info "IP PostgreSQL: $PG_IP"

    # Vérifier si PostgreSQL est prêt
    if docker exec odoo_postgres_shared pg_isready -U odoo >/dev/null 2>&1; then
        check_result 0 "PostgreSQL est prêt à accepter les connexions"
        PASS=$((PASS + 1))
    else
        check_result 1 "PostgreSQL n'est pas prêt"
        FAIL=$((FAIL + 1))
    fi
else
    check_result 1 "Conteneur odoo_postgres_shared n'est pas en cours d'exécution"
    FAIL=$((FAIL + 1))
    warning "Démarrez le conteneur: docker start odoo_postgres_shared"
fi

# Mecafric
if docker ps --filter "name=mecafric_odoo" --format "{{.Names}}" | grep -q mecafric_odoo; then
    check_result 0 "Conteneur mecafric_odoo est en cours d'exécution"
    PASS=$((PASS + 1))

    # Vérifier l'IP
    MECAFRIC_IP=$(docker inspect mecafric_odoo --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    info "IP Mecafric: $MECAFRIC_IP"
else
    check_result 1 "Conteneur mecafric_odoo n'est pas en cours d'exécution"
    FAIL=$((FAIL + 1))
    warning "Démarrez le conteneur: docker start mecafric_odoo"
fi
echo ""

echo "6️⃣  Test de connectivité réseau"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test de résolution DNS
if docker exec mecafric_odoo getent hosts odoo_postgres_shared >/dev/null 2>&1; then
    DNS_RESULT=$(docker exec mecafric_odoo getent hosts odoo_postgres_shared)
    check_result 0 "Résolution DNS fonctionne: $DNS_RESULT"
    PASS=$((PASS + 1))
else
    check_result 1 "Résolution DNS ne fonctionne pas"
    FAIL=$((FAIL + 1))
fi

# Test de connexion TCP au port 5432
echo "   Test de connexion TCP au port 5432 (peut prendre quelques secondes)..."
if timeout 5 docker run --rm --network odoo-network busybox nc -zv odoo_postgres_shared 5432 >/dev/null 2>&1; then
    check_result 0 "Connexion TCP au port 5432 réussie"
    PASS=$((PASS + 1))
else
    check_result 1 "Connexion TCP au port 5432 ÉCHEC (TIMEOUT)"
    FAIL=$((FAIL + 1))
    warning "C'est le problème principal! UFW bloque probablement la connexion."
    warning "Solution: Exécutez sudo ~/pacadev/core/infra/scripts/configure-ufw-docker.sh"
fi
echo ""

echo "7️⃣  Vérification des logs Odoo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if docker logs mecafric_odoo --tail 50 2>&1 | grep -q "Connection timed out"; then
    check_result 1 "Erreurs de timeout détectées dans les logs"
    FAIL=$((FAIL + 1))
    warning "Les logs contiennent des erreurs de connexion à PostgreSQL"
else
    check_result 0 "Pas d'erreurs de timeout récentes dans les logs"
    PASS=$((PASS + 1))
fi

if docker logs mecafric_odoo --tail 20 2>&1 | grep -q "HTTP service.*running"; then
    check_result 0 "Service HTTP Odoo est démarré"
    PASS=$((PASS + 1))
else
    warning "Service HTTP Odoo pourrait ne pas être démarré"
fi
echo ""

echo "8️⃣  Test d'accès au service web"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HTTP_CODE=$(timeout 5 curl -s -o /dev/null -w "%{http_code}" http://localhost:8071 2>/dev/null || echo "TIMEOUT")
if [ "$HTTP_CODE" = "303" ] || [ "$HTTP_CODE" = "200" ]; then
    check_result 0 "Service web accessible (HTTP $HTTP_CODE)"
    PASS=$((PASS + 1))
elif [ "$HTTP_CODE" = "TIMEOUT" ]; then
    check_result 1 "Service web TIMEOUT"
    FAIL=$((FAIL + 1))
    warning "Le service web ne répond pas - vérifiez les logs Odoo"
else
    check_result 1 "Service web retourne HTTP $HTTP_CODE"
    FAIL=$((FAIL + 1))
fi
echo ""

echo "9️⃣  Vérification des règles iptables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$EUID" -eq 0 ]; then
    if iptables -L DOCKER-USER >/dev/null 2>&1; then
        DOCKER_USER_RULES=$(iptables -L DOCKER-USER -n | grep -c "RETURN.*172.16.0.0/12" || echo "0")
        if [ "$DOCKER_USER_RULES" -gt 0 ]; then
            check_result 0 "Chaîne DOCKER-USER contient les règles Docker"
            PASS=$((PASS + 1))
        else
            check_result 1 "Chaîne DOCKER-USER existe mais sans règles Docker"
            FAIL=$((FAIL + 1))
        fi
    else
        warning "Chaîne DOCKER-USER n'existe pas (normal si Docker vient de démarrer)"
    fi
else
    warning "Exécutez avec sudo pour vérifier les règles iptables"
fi
echo ""

# Résumé
echo "=================================================="
echo "📊 Résumé"
echo "=================================================="
echo ""
echo -e "${GREEN}✅ Tests réussis: $PASS${NC}"
echo -e "${RED}❌ Tests échoués: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 Tout fonctionne correctement!${NC}"
    echo ""
    echo "Vous pouvez accéder à votre client Odoo:"
    echo "  → http://localhost:8071"
    echo "  → http://mecafric.odoo.localhost:8090"
    exit 0
else
    echo -e "${RED}⚠️  Des problèmes ont été détectés${NC}"
    echo ""
    echo "Actions recommandées:"
    echo ""
    echo "1. Configurer UFW pour Docker:"
    echo "   sudo ~/pacadev/core/infra/scripts/configure-ufw-docker.sh"
    echo ""
    echo "2. Redémarrer les services:"
    echo "   sudo systemctl restart docker"
    echo "   docker restart odoo_postgres_shared mecafric_odoo"
    echo ""
    echo "3. Vérifier à nouveau:"
    echo "   sudo ./verify-ufw-docker.sh"
    echo ""
    echo "Pour plus d'informations, consultez:"
    echo "   ~/pacadev/core/infra/README.md"
    exit 1
fi
