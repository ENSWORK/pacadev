#!/bin/bash
# Usage: ./tailscale-auth.sh [auth-key]
# Si pas d'auth key fourni, lance l'auth interactive (navigateur)
set -euo pipefail

AUTH_KEY="${1:-}"

if [ -n "$AUTH_KEY" ]; then
    echo "🔐 Authentification Tailscale avec auth key..."
    sudo tailscale up \
        --authkey="$AUTH_KEY" \
        --accept-routes \
        --hostname="pacadev-$(hostname)" \
        --advertise-tags=tag:dev
else
    echo "🌐 Authentification Tailscale interactive..."
    echo "   Un lien va s'afficher — ouvrez-le dans votre navigateur"
    sudo tailscale up \
        --accept-routes \
        --hostname="pacadev-$(hostname)" \
        --advertise-tags=tag:dev
fi

echo ""
tailscale status
echo ""
echo "✅ Tailscale connecté!"
echo "📌 IP Tailscale: $(tailscale ip -4 2>/dev/null || echo 'N/A')"
