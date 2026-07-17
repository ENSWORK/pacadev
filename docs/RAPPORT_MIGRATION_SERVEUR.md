# Rapport de Migration PACADEV — Serveur VM Proxmox

**Date** : 17 Juillet 2026
**Auteur** : Abdelali / PACADEV
**Version** : PACADEV v1.0.0

---

## 1. Objectif

Migrer l'orchestrateur de développement PACADEV (multi-clients Odoo) du poste local vers un nouveau serveur VM Proxmox, incluant :

- Le code complet (git + modules)
- Les bases de données PostgreSQL
- Les filestores Odoo (attachments, images)
- Les secrets chiffrés (SOPS + age)
- L'infrastructure Docker (Traefik, PostgreSQL, containers clients)
- Les outils core (CLI, FSM, Audit, Security)
- Le dashboard web (Next.js)

---

## 2. Informations Serveur

| Élément | Valeur |
|---|---|
| **Hostname** | VM Proxmox |
| **OS** | Ubuntu 24.04 LTS |
| **Kernel** | 6.8.0 |
| **RAM** | 5.8 GB |
| **Disk** | 98 GB (25 GB utilisés, 69 GB libres) |
| **IP** | 192.168.11.20 |
| **SSH User** | pacadev |
| **SSH Key** | ~/.ssh/id_ed25519 (copiée sur le serveur) |
| **Docker** | 29.6.1 |

---

## 3. État Final des Services

### 3.1 Infrastructure Docker

| Service | Container | Image | Port Host | Status |
|---|---|---|---|---|
| PostgreSQL | pacadev_postgres_shared | postgres:14 | 5434→5432 | healthy |
| Traefik | pacadev_traefik | traefik:v2.11 | 8090→80, 8091→8080 | running |

### 3.2 Clients Odoo 17

| Client | Container | Port Host | DB Name | Health |
|---|---|---|---|---|
| afrequip | afrequip_odoo | 8070→8069 | afrequip | running |
| maxelec | maxelec_odoo | 8082→8069 | maxelec | healthy |
| mecafric | mecafric_odoo | 8092→8069 | mecafric_prod | healthy |
| mecafric_water | mecafric_water_odoo | 8076→8069 | mecafric_water | healthy |

### 3.3 Bases de Données PostgreSQL

| Base | Taille | Modules Installés |
|---|---|---|
| afrequip | 150 MB | 128 |
| afrequip-data-test | 149 MB | 767 |
| afrequip-data-test-2 | 149 MB | 767 |
| maxelec | 23 MB | 11 (base init) |
| mecafric_prod | 22 MB | 11 (base init) |
| mecafric_water | 21 MB | 11 (base init) |

### 3.4 Filestores

| Client | Taille |
|---|---|
| afrequip | 51 MB |
| maxelec | 4 KB (vide) |
| mecafric | 77 MB |
| mecafric_water | 123 MB |

### 3.5 Dashboard Web (Next.js)

| Élément | Valeur |
|---|---|
| Port | 3000 |
| Database | SQLite (custom.db) |
| Status | running |
| API | /api/clients, /api/services, /api/dashboard — fonctionnelles |

### 3.6 Outils Installés

| Outil | Version |
|---|---|
| Node.js | v20.19.0 |
| SOPS | 3.9.4 |
| Age | v1.2.0 |
| Docker | 29.6.1 |

---

## 4. Travaux Effectués (Chronologique)

### Phase 1 — Préparation Locale

1. **Réparation PostgreSQL local** — WAL corrompu, réparé via `pg_resetwal -f`
2. **Dump de la DB afrequip** — `pg_dump` → `afrequip.sql` (95 MB)
3. **Vérification SSH** — Clé `id_ed25519` déjà installée sur `pacadev@192.168.11.20`

### Phase 2 — Transfert vers le Serveur

4. **Rsync du code complet** — Repo git, modules, configs (hors `.git`, `node_modules`, `.venv`, `postgres/data`, `export/`)
5. **Rsync du dossier `.git/`** — Historique complet
6. **Rsync des dumps DB** — `afrequip.sql` (95 MB)
7. **Rsync des filestores** — afrequip (51 MB), mecafric (77 MB), mecafric_water (123 MB)

### Phase 3 — Infra Docker

8. **Création du réseau** — `pacadev-network` (externe)
9. **Démarrage PostgreSQL** — Container `pacadev_postgres_shared`, PG 14, healthy
10. **Démarrage Traefik** — Container `pacadev_traefik`, v2.11, dashboard sur 8091

### Phase 4 — Bases de Données

11. **Restauration DB afrequip** — `createdb` + `psql` restore depuis dump (95 MB)
12. **Création DBs vides** — `maxelec`, `mecafric_prod`, `mecafric_water` (pas de dumps disponibles en local)
13. **Init DBs avec `-i base`** — `odoo -d <db> -i base --stop-after-init` pour initialiser le schéma Odoo

### Phase 5 — Containers Odoo

14. **Pull image `odoo:17`** — Image de base
15. **Build images custom** — Dockerfile avec wkhtmltopdf + boto3 + paramiko (via `requirements.txt`)
16. **Tag image** — `pacadev-odoo17:latest` pour réutilisation
17. **Démarrage des 4 containers** — afrequip, maxelec, mecafric, mecafric_water

### Phase 6 — Corrections de Migration

18. **Paths `/data/Pacadev`** → `/home/pacadev/pacadev` — 7 fichiers corrigés (`state.py`, `runbook.py`, `generate.py`, `secrets.py`, `deploy.yml`, `promtail.yml`, `docker-compose.yml`, `setup-github-client.sh`)
19. **Ven shebangs** — `/home/abdelali/...` → `/home/pacadev/...` dans tous les scripts `.venv/bin/`
20. **`DB_NAME`** → `POSTGRES_DB` dans les docker-compose (puis abandonné au profit de `db_name` dans `odoo.conf`)
21. **`db_name` dans `odoo.conf`** — Ajouté pour chaque client, puis **supprimé** pour permettre l'accès au database manager
22. **`list_db = True`** — Ajouté à tous les `odoo.conf` pour activer le database manager
23. **`db_port` mecafric_water** — Corrigé de `5434` (port host) à `5432` (port container)
24. **`extra_hosts` mecafric_water** — Supprimé (mauvaise IP vers PostgreSQL)
25. **`db_user`/`db_password` mecafric** — `$USER`/`$PASSWORD` → `odoo`/`odoo`
26. **SOPS secrets mecafric** — Fichier `.env` créé avec `ODOO_ADMIN_PASSWD=B@hou1983`
27. **SOPS age key** — Copiée dans `~/.config/sops/age/keys.txt` (emplacement par défaut)
28. **sops binary path** — Hardcodé `/home/pacadev/bin/sops` dans `core/cli/cli/utils/secrets.py`
29. **Traefik labels** — `entrypoints=web` ajouté pour afrequip et maxelec
30. **Node.js installé** — v20.19.0 via binaire précompilé (pas de sudo disponible)
31. **Bun** — Non installé (pas de `unzip` disponible), Node.js utilisé à la place

### Phase 7 — Tests Core PACADEV

32. **CLI `pacadev`** — Réinstallé via `pip install -e .` dans le venv
33. **FSM** — Test complet : 13 états, 20 transitions, happy path INIT→CLOSED validé (13 transitions)
34. **PreFlight Validators** — `check_branch_name` et `check_git_repo` OK
35. **Audit Logger** — JSONL + SHA256 hash chain, 3 entrées loguées et vérifiées
36. **Audit Verifier** — Intégrité de chaîne validée
37. **HMAC Tokens** — Génération OK, expiration OK, mais **`verify()` retourne toujours True** (HMAC non vérifié — bug connu)
38. **RBAC** — 4 rôles (admin/lead/dev/viewer), permissions correctes
39. **Approval Manager** — Single-use enforcement OK, réutilisation bloquée
40. **Secrets Masker** — mask_text/contains_secret OK (9 patterns)
41. **Secrets CLI** — `secrets show afrequip` fonctionne, affiche les clés masquées
42. **Infra Status** — PostgreSQL + Traefik + Network détectés correctement
43. **Memory (Ollama)** — Non disponible (Ollama/ChromaDB non installés)

### Phase 8 — Dashboard Web

44. **Prisma generate** — Client DB généré
45. **Next.js build** — Build standalone réussi
46. **Démarrage** — Port 3000, 6 services détectés via API
47. **Fix `.env`** — Paths corrigés (`DATABASE_URL`, `PACADEV_HOME`, `PACADEV_WORKSPACE`)

---

## 5. Bugs Corrigés

| # | Bug | Correction | Fichier(s) |
|---|---|---|---|
| 1 | Paths `/data/Pacadev` hardcodés | Remplacement par `/home/pacadev/pacadev` | 7 fichiers Python/YAML/SH |
| 2 | Ven shebangs pointent vers `/home/abdelali/` | Remplacement par `/home/pacadev/pacadev/` | `.venv/bin/*` |
| 3 | `db_name` filtre le database manager | Supprimé de tous les `odoo.conf` | 4 fichiers odoo.conf |
| 4 | `list_db` non défini | `list_db = True` ajouté | 4 fichiers odoo.conf |
| 5 | `db_port = 5434` (port host) | Corrigé à `5432` (port container) | mecafric_water/config/odoo.conf |
| 6 | `extra_hosts` avec mauvaise IP | Supprimé | mecafric_water/docker-compose.yml |
| 7 | `$USER`/`$PASSWORD` littéraux | Valeurs réelles (`odoo`/`odoo`) | mecafric/config/odoo.conf |
| 8 | SOPS age key au mauvais emplacement | Copiée dans `~/.config/sops/age/keys.txt` | — |
| 9 | sops binary pas dans PATH | Path hardcodé dans le CLI | core/cli/cli/utils/secrets.py |
| 10 | Traefik labels incomplets | `entrypoints=web` ajouté | afrequip/maxelec docker-compose.yml |
| 11 | Dashboard `.env` avec paths locaux | Corrigés pour le serveur distant | web/.env |

## 6. Bugs Connus Non Corrigés

| # | Bug | Sévérité | Description |
|---|---|---|---|
| 1 | `ApprovalToken.verify()` fail-open | **Critique** | La vérification HMAC de la signature n'est pas implémentée. `verify()` retourne toujours `True` après vérification d'expiration. Nécessite implémentation de la reconstruction HMAC. |
| 2 | `check_github_issue` non testé | Moyen | Nécessite accès GitHub (token non configuré sur le serveur) |
| 3 | Ollama/ChromaDB non installés | Faible | Système de mémoire IA non fonctionnel |

---

## 7. URLs d'Accès

### Depuis le serveur (curl)

| Service | URL |
|---|---|
| afrequip | `http://localhost:8070` |
| maxelec | `http://localhost:8082` |
| mecafric | `http://localhost:8092` |
| mecafric_water | `http://localhost:8076` |
| Dashboard PACADEV | `http://localhost:3000` |
| Traefik Dashboard | `http://localhost:8091` |

### Via Traefik (hostname)

Pour y accéder depuis un navigateur, ajouter dans `/etc/hosts` :

```
192.168.11.20  afrequip.pacadev.local maxelec.pacadev.local mecafric.pacadev.local mecafric_water.pacadev.local pacadev.local web.pacadev.local
```

| Service | URL Traefik |
|---|---|
| afrequip | `http://afrequip.pacadev.local` |
| maxelec | `http://maxelec.pacadev.local` |
| mecafric | `http://mecafric.pacadev.local` |
| mecafric_water | `http://mecafric_water.pacadev.local` |
| Dashboard | `http://pacadev.local` |

---

## 8. Structure du Serveur

```
/home/pacadev/pacadev/
├── .pacadev/                    # Config, state, secrets (SOPS)
├── .venv/                       # Python 3.12 venv + CLI pacadev
├── core/
│   ├── cli/                     # CLI Typer (pacadev command)
│   ├── workflow/                # FSM (13 états, 20 transitions)
│   ├── audit/                   # Logger JSONL + Verifier SHA256
│   ├── security/                # Tokens HMAC, RBAC, Approval
│   ├── memory/                  # Ollama + ChromaDB (non installés)
│   ├── monitoring/              # Prometheus + Grafana + Loki
│   ├── infra/
│   │   ├── postgres/            # PostgreSQL shared (PG 14)
│   │   ├── traefik/             # Traefik v2.11 + dynamic config
│   │   └── scripts/             # start/stop/verify/configure
│   ├── ci-templates/            # GitHub Actions (pipeline + deploy)
│   ├── secrets/                 # Fichiers .enc.yaml + age keys
│   └── templates/               # Devcontainer templates
├── modules/
│   └── ens_core-17/             # Modules partagés ENS Odoo 17
├── v17/
│   └── clients/
│       ├── afrequip/            # Port 8070
│       ├── maxelec/             # Port 8082
│       ├── mecafric/            # Port 8092
│       └── mecafric_water/      # Port 8076
├── web/                         # Dashboard Next.js (port 3000)
├── docs/                        # Documentation
└── README.md
```

---

## 9. Commandes Utiles

```bash
# Connexion au serveur
ssh pacadev@192.168.11.20

# Pacadev CLI
cd /home/pacadev/pacadev
.venv/bin/pacadev version
.venv/bin/pacadev work status
.venv/bin/pacadev infra status
.venv/bin/pacadev secrets show afrequip
.venv/bin/pacadev health --all

# Docker
docker ps
docker logs <container_name>
docker compose -f v17/clients/afrequip/docker-compose.yml restart

# PostgreSQL
docker exec pacadev_postgres_shared psql -U odoo -d postgres -c '\l'

# Database Manager
curl -s -X POST http://localhost:8070/web/database/list -H 'Content-Type: application/json' -d '{}'

# Dashboard
curl -s http://localhost:3000/api/services
curl -s http://localhost:3000/api/clients
```

---

## 10. Prochaines Étapes

1. **Fix `ApprovalToken.verify()`** — Implémenter la vérification HMAC réelle
2. **Configurer `/etc/hosts`** sur la machine locale pour l'accès Traefik
3. **Installer Ollama + ChromaDB** si le système de mémoire IA est souhaité
4. **Configurer GitHub token** pour les commandes `pacadev issue` et CI/CD
5. **Dashboard web** — Configuration production (HTTPS via Traefik, base PostgreSQL au lieu de SQLite)
6. **Monitoring** — `docker compose -f core/monitoring/docker-compose.yml up -d` (Prometheus + Grafana + Loki)
