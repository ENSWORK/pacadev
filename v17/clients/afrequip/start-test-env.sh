#!/bin/bash

set -e

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║           🚀 AFREQUIP TEST ENVIRONMENT - STARTING DOCKER STACK               ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"

AFREQUIP_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "📍 Working directory: $AFREQUIP_PATH"
echo ""

# Check if docker-compose exists
if [ ! -f "$AFREQUIP_PATH/docker-compose.dev.yml" ]; then
    echo "❌ Error: docker-compose.dev.yml not found!"
    exit 1
fi

echo "📦 Starting Docker services..."
echo "   - PostgreSQL (port 5433)"
echo "   - Odoo 17 (port 8070)"
echo "   - Redis (port 6380)"
echo ""

# Start services
cd "$AFREQUIP_PATH"
docker-compose -f docker-compose.dev.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 30

echo ""
echo "📋 Service status:"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "✅ DOCKER STACK STARTED"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 ODOO ACCESS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "URL: http://localhost:8070/web/"
echo ""
echo "First login:"
echo "  - Email: admin@example.com"
echo "  - Password: (leave empty on first login)"
echo ""
echo "After first login:"
echo "  - Admin user: admin"
echo "  - Database: afrequip_dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTING THE MODULE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Login to Odoo"
echo "2. Go to Apps menu"
echo "3. Search for 'Partner Statement Report'"
echo "4. Click 'Install'"
echo ""
echo "Then test the 5 modifications:"
echo "  MOD 1: Check French labels (Déclaration d'Activité)"
echo "  MOD 2: Verify custom header/footer"
echo "  MOD 3: Check currency on lines vs totals"
echo "  MOD 4: Verify Date Échéance column"
echo "  MOD 5: Check ICE field in partner address"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 USEFUL COMMANDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "View logs:"
echo "  docker-compose -f docker-compose.dev.yml logs -f odoo"
echo ""
echo "Install module via CLI:"
echo "  docker exec afrequip_odoo odoo -c /odoo.conf -u partner_statement_report --stop-after-init"
echo ""
echo "Stop services:"
echo "  docker-compose -f docker-compose.dev.yml down"
echo ""
echo "Stop and remove data:"
echo "  docker-compose -f docker-compose.dev.yml down -v"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Ready for testing! Check http://localhost:8070"
echo ""
