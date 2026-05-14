#!/bin/bash
#
# Script de configuration UFW pour Docker
# Permet la communication entre conteneurs tout en maintenant la sécurité
#
# Usage: sudo ./configure-ufw-docker.sh
#

set -e

echo "=================================================="
echo "Configuration UFW pour Docker"
echo "=================================================="
echo ""

# Vérifier si on est root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Erreur: Ce script doit être exécuté avec sudo"
    exit 1
fi

# Sauvegarder la configuration actuelle
echo "📦 Sauvegarde de la configuration UFW actuelle..."
BACKUP_DIR="/etc/ufw/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp /etc/ufw/after.rules "$BACKUP_DIR/after.rules.backup.$TIMESTAMP"
echo "   ✅ Sauvegarde créée: $BACKUP_DIR/after.rules.backup.$TIMESTAMP"
echo ""

# Vérifier si la configuration Docker existe déjà
if grep -q "BEGIN UFW AND DOCKER" /etc/ufw/after.rules; then
    echo "⚠️  Configuration Docker déjà présente dans after.rules"
    echo "   Nettoyage de l'ancienne configuration..."
    sed -i '/# BEGIN UFW AND DOCKER/,/# END UFW AND DOCKER/d' /etc/ufw/after.rules
    echo "   ✅ Ancienne configuration supprimée"
    echo ""
fi

# Ajouter les règles Docker à UFW
echo "🔧 Ajout des règles Docker à UFW..."
cat >> /etc/ufw/after.rules << 'EOF'

# BEGIN UFW AND DOCKER
# =====================
# Règles pour permettre la communication entre conteneurs Docker
# tout en maintenant la sécurité du pare-feu UFW
#
# Ces règles permettent:
# - Communication entre conteneurs sur les réseaux privés Docker
# - Isolation des conteneurs depuis l'extérieur (sauf ports exposés)
# - Protection contre les connexions non autorisées
#
*filter
:ufw-user-forward - [0:0]
:DOCKER-USER - [0:0]

# Permettre le trafic entre conteneurs sur les réseaux privés Docker
-A DOCKER-USER -j RETURN -s 10.0.0.0/8
-A DOCKER-USER -j RETURN -s 172.16.0.0/12
-A DOCKER-USER -j RETURN -s 192.168.0.0/16

# Bloquer les nouvelles connexions SYN vers les réseaux privés Docker depuis l'extérieur
-A DOCKER-USER -j DROP -p tcp -m tcp --tcp-flags FIN,SYN,RST,ACK SYN -d 192.168.0.0/16
-A DOCKER-USER -j DROP -p tcp -m tcp --tcp-flags FIN,SYN,RST,ACK SYN -d 10.0.0.0/8
-A DOCKER-USER -j DROP -p tcp -m tcp --tcp-flags FIN,SYN,RST,ACK SYN -d 172.16.0.0/12

# Bloquer les paquets UDP non privilégiés vers les réseaux privés Docker
-A DOCKER-USER -j DROP -p udp -m udp --dport 0:32767 -d 192.168.0.0/16
-A DOCKER-USER -j DROP -p udp -m udp --dport 0:32767 -d 10.0.0.0/8
-A DOCKER-USER -j DROP -p udp -m udp --dport 0:32767 -d 172.16.0.0/12

# Passer le reste du trafic au traitement UFW normal
-A DOCKER-USER -j ufw-user-forward

# Accepter le reste du trafic
-A DOCKER-USER -j RETURN

COMMIT
# END UFW AND DOCKER
EOF

echo "   ✅ Règles ajoutées avec succès"
echo ""

# Configuration supplémentaire pour Docker dans /etc/default/ufw
echo "🔧 Configuration de /etc/default/ufw..."
if ! grep -q "DEFAULT_FORWARD_POLICY=\"ACCEPT\"" /etc/default/ufw; then
    cp /etc/default/ufw "$BACKUP_DIR/ufw.backup.$TIMESTAMP"
    sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw
    echo "   ✅ DEFAULT_FORWARD_POLICY configurée sur ACCEPT"
else
    echo "   ℹ️  DEFAULT_FORWARD_POLICY déjà configurée"
fi
echo ""

# Recharger UFW
echo "🔄 Rechargement d'UFW..."
ufw reload
echo "   ✅ UFW rechargé"
echo ""

# Redémarrer Docker
echo "🔄 Redémarrage de Docker..."
systemctl restart docker
echo "   ✅ Docker redémarré"
echo ""

# Afficher le statut
echo "=================================================="
echo "✅ Configuration terminée avec succès!"
echo "=================================================="
echo ""
echo "📋 Résumé de la configuration:"
echo "   - Sauvegardes créées dans: $BACKUP_DIR"
echo "   - Communication Docker: ✅ Activée"
echo "   - Pare-feu UFW: ✅ Actif et protecteur"
echo ""
echo "🔍 Vérification du statut:"
ufw status verbose | head -20
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Redémarrez vos conteneurs: docker restart odoo_postgres_shared mecafric_odoo"
echo "   2. Testez l'accès: curl http://localhost:8071"
echo "   3. Vérifiez les logs: docker logs mecafric_odoo"
echo ""
echo "💡 Pour restaurer l'ancienne configuration:"
echo "   sudo cp $BACKUP_DIR/after.rules.backup.$TIMESTAMP /etc/ufw/after.rules"
echo "   sudo ufw reload"
echo ""
