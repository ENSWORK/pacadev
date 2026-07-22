# Configuration DNS PACADEV

## Résumé

Le conteneur `pacadev_dns` (dnsmasq) sur le port `53` résout automatiquement
tout `*.pacadev.local` vers l'IP du serveur (`192.168.11.20`).

## Architecture

```
Client Windows ──→ pacadev_dns (dnsmasq) ──→ pacadev_traefik ──→ <client>_odoo
   nslookup           :53 UDP/TCP              :80                   :8069
   *.pacadev.local    192.168.11.20         Host routing           Container
```

## Configuration Windows

1. Panneau de configuration → Centre réseau et partage → Modifier les paramètres de la carte
2. Clic droit sur votre carte réseau → Propriétés
3. Sélectionner **Protocole Internet version 4 (TCP/IPv4)** → Propriétés
4. Cocher **Utiliser l'adresse de serveur DNS suivante** :
   - Serveur DNS préféré : `192.168.11.20`
5. OK → Fermer

### Vérification

```cmd
nslookup afrequip.pacadev.local
→ Nom    : afrequip.pacadev.local
→ Adresse: 192.168.11.20

nslookup maxelec.pacadev.local
→ Adresse: 192.168.11.20
```

### Accès aux clients Odoo

```cmd
start http://afrequip.pacadev.local
start http://maxelec.pacadev.local
start http://mecafric.pacadev.local
start http://mecafric_water.pacadev.local
```

> **Note :** Le port 80 étant le port HTTP par défaut, `http://afrequip.pacadev.local` suffit — plus besoin de préciser `:8090`.

## Configuration Linux (serveur)

```bash
# Option 1 : via resolvectl (temporaire)
sudo resolvectl dns ens18 192.168.11.20
sudo resolvectl domain ens18 "~pacadev.local"

# Option 2 : permanente (créer le fichier)
sudo mkdir -p /etc/systemd/resolved.conf.d
cat << 'EOF' | sudo tee /etc/systemd/resolved.conf.d/pacadev.conf
[Resolve]
DNS=192.168.11.20
Domains=~pacadev.local
EOF
sudo systemctl restart systemd-resolved
```

### Vérification Linux

```bash
dig afrequip.pacadev.local @192.168.11.20 +short
# → 192.168.11.20

curl -s -o /dev/null -w "%{http_code}" http://afrequip.pacadev.local/web/login
# → 303
```

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `nslookup` échoue | Firewall bloque port 53 | `sudo ufw allow 53/udp && sudo ufw allow 53/tcp` |
| DNS répond mais Traefik 404 | Labels Traefik manquants dans compose client | Vérifier `docker inspect <client>_odoo \| grep traefik.http.routers` |
| Résolution lente | Timeout upstream DNS | Vérifier les upstreams dans `core/infra/dns/dnsmasq.conf` |
