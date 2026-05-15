# PACADEV — Infrastructure partagée

Reproduction adaptée de l'architecture infrastructure d'OpenEnsdev pour pacadev.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Hôte                                                    │
│                                                          │
│  ┌─────────────────────┐    ┌─────────────────────────┐ │
│  │ pacadev_traefik     │    │ pacadev_postgres_shared │ │
│  │ traefik:v2.11       │    │ postgres:14              │ │
│  │ :8090 (web)         │    │ :5434 (host)             │ │
│  │ :8091 (dashboard)   │    │ → 5432 (container)       │ │
│  └─────────────────────┘    └─────────────────────────┘ │
│              │                          │                │
│              └─────── pacadev-network ──┘                │
│                              │                            │
│              ┌───────────────┼──────────────┐            │
│              ▼               ▼              ▼            │
│         ┌────────┐      ┌────────┐    ┌────────┐        │
│         │client A│      │client B│    │client N│        │
│         │ Odoo   │      │ Odoo   │    │ Odoo   │        │
│         └────────┘      └────────┘    └────────┘        │
└──────────────────────────────────────────────────────────┘
```

## Composants

| Composant | Container | Image | Ports host | Rôle |
|---|---|---|---|---|
| Réseau | (`pacadev-network`) | bridge | — | Interconnexion des services |
| PostgreSQL | `pacadev_postgres_shared` | `postgres:14` | **5434** → 5432 | Base partagée multi-clients |
| Traefik | `pacadev_traefik` | `traefik:v2.11` | **8090** (web), **8091** (dashboard) | Reverse proxy + routing par host |

### Pourquoi ports 5434/8090/8091 ?

Pour permettre la **coexistence avec OpenEnsdev** durant la migration :
- `5432` : occupé localement (autre PG)
- `5433` : occupé par `afrequip_postgres_1`
- `80, 8080` : occupés par Traefik OpenEnsdev (`traefik`)

À la décommission OpenEnsdev (Phase 8), tu pourras éventuellement basculer pacadev sur les ports standards :
```bash
PACADEV_PG_HOST_PORT=5432 PACADEV_TRAEFIK_WEB_PORT=80 PACADEV_TRAEFIK_DASHBOARD_PORT=8080 \
  pacadev infra start
```

## Démarrage

```bash
# Démarrer infra partagée (1ʳᵉ fois ou redémarrage)
pacadev infra start

# Vérifier
pacadev infra status

# Diagnostic UFW si conteneurs ne se voient pas
sudo pacadev infra verify   # ou : sudo bash core/infra/scripts/verify-ufw-docker.sh
```

## Arrêt / redémarrage

```bash
pacadev infra stop          # arrêt propre (données préservées)
pacadev infra recreate      # full restart avec --force-recreate
```

## Démarrage des clients

```bash
# Tous les clients déclarés sous v14/, v17/, v19/
pacadev infra start-all-clients

# Ou directement le script
bash core/infra/scripts/start-all-clients.sh
```

## Credentials PostgreSQL

**Par défaut** (à changer Phase 4 via SOPS) :
- user : `odoo`
- password : `odoo`
- DB système : `postgres`

Pour utiliser des secrets chiffrés (Phase 4) :
```bash
eval $(sops -d core/secrets/pacadev_infra.enc.yaml | yq -r 'to_entries[] | "export \(.key)=\(.value)"')
pacadev infra start
```

## Routing Traefik

Les routes statiques sont dans `traefik/dynamic/pacadev.yml` (rechargées à chaud).

Pour qu'un client soit routé via `<client>.pacadev.local`, ajouter ces labels dans son `docker-compose.yml` :

```yaml
services:
  <client>_odoo:
    labels:
      - traefik.enable=true
      - traefik.http.routers.<client>.rule=Host(`<client>.pacadev.local`)
      - traefik.http.services.<client>.loadbalancer.server.port=8069
    networks:
      - pacadev-network

networks:
  pacadev-network:
    external: true
```

Et ajouter à `/etc/hosts` :
```
127.0.0.1   <client>.pacadev.local dashboard.pacadev.local grafana.pacadev.local
```

## Scripts disponibles

| Script | Rôle | Sudo |
|---|---|---|
| `start-infra.sh` | Démarre network + postgres + traefik | non |
| `stop-infra.sh` | Arrête postgres + traefik | non |
| `start-all-clients.sh` | Démarre tous les clients v14/v17/v19 | non |
| `recreate-containers.sh` | `--force-recreate` infra + clients | non |
| `verify-ufw-docker.sh` | Diagnostic UFW/Docker | **oui** |
| `configure-ufw-docker.sh` | Configuration UFW pour Docker | **oui** |

## Compatibilité avec OpenEnsdev (transition)

Pendant la migration, pacadev infra **n'interfère pas** avec OpenEnsdev :
- Ports différents
- Network séparé (`pacadev-network` vs `odoo-network`)
- Volumes séparés (`./data` local vs `OpenEnsdev/infra/postgres/data`)

Tu peux donc :
1. Lancer `pacadev infra start` sans rien casser
2. Migrer les clients un par un (Phase 5)
3. Décommissionner OpenEnsdev (Phase 8) quand tout est validé

## Anciens artefacts à nettoyer (optionnel)

`docker volume ls` et `docker network ls` montrent peut-être des vestiges d'anciennes tentatives :
- `pacadev_shared-network` (network vide, créé par une ancienne config)
- `pacadev_postgres_data` (volume orphelin)

Après validation du nouveau setup, tu peux nettoyer :
```bash
docker network rm pacadev_shared-network
docker volume rm pacadev_postgres_data
```

## Troubleshooting

| Symptôme | Solution |
|---|---|
| `pacadev infra start` échoue port déjà utilisé | Changer port via `PACADEV_PG_HOST_PORT` / `PACADEV_TRAEFIK_*_PORT` |
| Conteneurs clients ne joignent pas la DB | Vérifier `docker network inspect pacadev-network` (containers listés ?) |
| `<client>.pacadev.local` retourne 404 | Vérifier labels Traefik dans compose client + `/etc/hosts` |
| Tableau de bord Streamlit pas accessible via Traefik | `host.docker.internal` requis dans la config Traefik (Linux : `--add-host=host.docker.internal:host-gateway` au container traefik si manquant) |
| `verify-ufw-docker.sh` signale connectivité bloquée | `sudo bash core/infra/scripts/configure-ufw-docker.sh` |

## Source

Architecture inspirée de `OpenEnsdev/infra/` (cf. Phase 3 de la fusion : `docs/FUSION_OPENENSDEV_TO_PACADEV.md`).

## Audit

Toute opération d'infra majeure (start/stop/recreate) doit être loggée via `core/audit/logger.py` action=`infra_*`.
