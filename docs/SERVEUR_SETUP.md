# PACADEV — Guide Installation Serveur

> VM Proxmox — Ubuntu 24.04 — 6GB RAM — 100GB disk
> IP: 192.168.11.20 — User: `pacadev`

---

## Pré-requis installés

| Outil | Version | Path |
|-------|---------|------|
| Python | 3.12 | `/usr/bin/python3` |
| pip | 24.0 | `/usr/bin/pip` |
| Docker | 29.6.1 | `/usr/bin/docker` |
| Docker Compose | v2.39.1 | `/usr/bin/docker` (plugin) |
| Node.js | 20.19.0 | `/home/pacadev/.local/bin/node` |
| npm | 10.8.2 | `/home/pacadev/.local/bin/npm` |
| SOPS | 3.9.4 | `/usr/bin/sops` |
| Age | 1.2.0 | `/home/pacadev/bin/age` |
| Git | 2.43.0 | `/usr/bin/git` |
| jq | 1.7 | `/usr/bin/jq` |

---

## Installation

### 1. Cloner le repo

```bash
cd /home/pacadev
git clone https://github.com/ENSWORK/pacadev.git
cd pacadev
```

### 2. Installer le venv Python

```bash
cd /home/pacadev/pacadev
python3 -m venv .venv
source .venv/bin/activate
pip install -e core/cli/ -q
```

### 3. Installer Node.js (si pas déjà fait)

```bash
# Télécharger le binaire
cd /tmp
wget https://nodejs.org/dist/v20.19.0/node-v20.19.0-linux-x64.tar.xz
tar -xf node-v20.19.0-linux-x64.tar.xz
cp -r node-v20.19.0-linux-x64/{bin,lib,share} /home/pacadev/.local/
rm -rf /tmp/node-v20.19.0-linux-x64*
```

### 4. Installer SOPS + Age

```bash
# SOPS depuis les releases GitHub
cd /tmp
wget https://github.com/getsops/sops/releases/download/v3.9.4/sops-v3.9.4.linux.amd64
chmod +x sops-v3.9.4.linux.amd64
mv sops-v3.9.4.linux.amd64 /usr/bin/sops

# Age
mkdir -p /home/pacadev/bin
cd /tmp
wget https://github.com/FiloSottile/age/releases/download/v1.2.0/age-v1.2.0-linux-amd64.tar.gz
tar -xf age-v1.2.0-linux-amd64.tar.gz
cp age-v1.2.0-linux-amd64/age /home/pacadev/bin/
cp age-v1.2.0-linux-amd64/age-keygen /home/pacadev/bin/
rm -rf /tmp/age*
```

### 5. Configurer les secrets SOPS

```bash
# Copier la clé age depuis le repo
mkdir -p ~/.config/sops/age
cp /home/pacadev/pacadev/core/secrets/age/keys.txt ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt
```

### 6. Démarrer l'infrastructure

```bash
cd /home/pacadev/pacadev
pacadev infra start
pacadev infra status
```

### 7. Créer les containers Odoo

```bash
# PostgreSQL partagé
docker run -d --name pacadev_postgres_shared \
  --network pacadev-network \
  -e POSTGRES_USER=odoo \
  -e POSTGRES_PASSWORD=odoo \
  -e POSTGRES_DB=postgres \
  -v pacadev_pgdata:/var/lib/postgresql/data \
  -p 5434:5432 \
  --restart unless-stopped \
  postgres:14

# Traefik
docker run -d --name pacadev_traefik \
  --network pacadev-network \
  -p 8090:80 \
  -p 8091:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /home/pacadev/pacadev/core/infra/traefik/dynamic:/etc/traefik/dynamic:ro \
  --restart unless-stopped \
  traefik:v2.11 \
  --configFile=/etc/traefik/traefik.yml
```

### 8. Restaurer les bases de données

```bash
# Restaurer afrequip
docker exec -i pacadev_postgres_shared psql -U odoo -d postgres < /home/pacadev/pacadev/dumps/afrequip.sql

# Créer les autres DBs
for db in maxelec mecafric_prod mecafric_water; do
  docker exec pacadev_postgres_shared createdb -U odoo $db
  docker exec $db_odoo odoo -c /odoo.conf -d $db -i base --stop-after-init
done
```

---

## Vérification

```bash
# État de l'infra
pacadev infra status

# Healthcheck
pacadev health --all

# Dashboard
curl -sf http://localhost:3000/api/health

# Traefik
curl -sf http://localhost:8090

# PostgreSQL
docker exec pacadev_postgres_shared pg_isready -U odoo
```

---

## Configuration /etc/hosts (client Windows)

Pour accéder aux clients via Traefik, ajouter dans `C:\Windows\System32\drivers\etc\hosts` :

```
192.168.11.20  afrequip.pacadev.local mecafric.pacadev.local mecafric_water.pacadev.local maxelec.pacadev.local dashboard.pacadev.local
```

---

## Mise à jour

```bash
cd /home/pacadev/pacadev
git pull

# Mettre à jour le CLI
source .venv/bin/activate
pip install -e core/cli/ -q

# Mettre à jour les containers
docker pull odoo:17
docker compose -f v17/clients/*/docker-compose.yml build

# Rebuild le dashboard
cd web && npm run build && cd ..
```
