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
| API | 32 endpoints — fonctionnels |
| Repo | dans le repo principal (web/) |

### 3.6 Outils Installés

| Outil | Version |
|---|---|
| Node.js | v20.19.0 |
| npm | 10.8.2 |
| Python | 3.12 |
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

4. **Rsync du code complet** — Repo git, modules, configs
5. **Rsync du dossier `.git/`** — Historique complet
6. **Rsync des dumps DB** — `afrequip.sql` (95 MB)
7. **Rsync des filestores** — afrequip (51 MB), mecafric (77 MB), mecafric_water (123 MB)

### Phase 3 — Infra Docker

8. **Création du réseau** — `pacadev-network` (externe)
9. **Démarrage PostgreSQL** — Container `pacadev_postgres_shared`, PG 14, healthy
10. **Démarrage Traefik** — Container `pacadev_traefik`, v2.11, dashboard sur 8091

### Phase 4 — Bases de Données

11. **Restauration DB afrequip** — `createdb` + `psql` restore depuis dump (95 MB)
12. **Création DBs vides** — `maxelec`, `mecafric_prod`, `mecafric_water`
13. **Init DBs avec `-i base`** — `odoo -d <db> -i base --stop-after-init` pour initialiser le schéma Odoo

### Phase 5 — Containers Odoo

14. **Pull image `odoo:17`** — Image de base
15. **Build images custom** — Dockerfile avec wkhtmltopdf + boto3 + paramiko
16. **Tag image** — `pacadev-odoo17:latest`
17. **Démarrage des 4 containers** — afrequip, maxelec, mecafric, mecafric_water

### Phase 6 — Corrections de Migration (initiale)

18. **Paths `/data/Pacadev`** → `/home/pacadev/pacadev` — 7 fichiers
19. **Ven shebangs** — `/home/abdelali/...` → `/home/pacadev/...`
20. **`db_name` supprimé** de tous les odoo.conf (permet database manager)
21. **`list_db = True`** ajouté dans tous les odoo.conf
22. **`db_port`** mecafric_water corrigé: 5434 → 5432
23. **`extra_hosts`** mecafric_water supprimé (mauvaise IP)
24. **`db_user`/`db_password`** mecafric: `abdelali`/`` → `odoo`/`odoo`
25. **SOPS secrets mecafric** — Fichier `.env` créé
26. **SOPS age key** — Copiée dans `~/.config/sops/age/keys.txt`
27. **sops binary path** — Hardcodé dans `core/cli/cli/utils/secrets.py`
28. **Traefik labels** — `entrypoints=web` ajouté pour afrequip et maxelec
29. **Node.js** — v20.19.0 installé via binaire précompilé

### Phase 7 — Tests Core PACADEV

30. **CLI `pacadev`** — Réinstallé via `pip install -e .`
31. **FSM** — 13 états, 20 transitions, happy path validé
32. **PreFlight Validators** — `check_branch_name`, `check_git_repo` OK
33. **Audit Logger + Verifier** — JSONL + SHA256 hash chain, intégrité validée
34. **HMAC Tokens** — Génération + expiration OK
35. **RBAC** — 4 rôles, permissions correctes
36. **Approval Manager** — Single-use enforcement OK
37. **Secrets Masker** — 9 patterns, OK
38. **Infra Status** — PostgreSQL + Traefik + Network détectés

### Phase 8 — Dashboard Web

39. **Next.js build** — Build standalone réussi
40. **Démarrage** — Port 3000, APIs fonctionnelles
41. **Fix `.env`** — Paths corrigés

---

## 5. Nettoyage Post-Migration (17 Juillet 2026)

### Phase 9 — Suppression Dossiers Obsolètes

42. **Supprimé `.claude/worktrees/`** — 2 worktrees (migration-guide, migration-wsl2) contenant des centaines de paths `/home/abdelali` stale
43. **Supprimé `web/upload/extracted_core/`** — Copie extraite inutile du core
44. **Supprimé `Previous Migraton to WSL/`** — Archive ancienne migration WSL
45. **Supprimé `migration-wsl2/`** — Scripts de migration WSL (secrets obsolètes inclus)
46. **Supprimé `migration/from-openensdev/`** — Scripts de migration depuis OpenEnsdev

### Phase 10 — Nettoyage Documentation Obsolète

47. **Supprimé `docs/FUSION_OPENENSDEV_TO_PACADEV.md`** — Historique fusion (2400+ lignes)
48. **Supprimé `core/PHASE_A_DELIVERY.md`** — Phase A terminée
49. **Supprimé `core/PHASE_A_INTEGRATION.md`** — Phase A terminée
50. **Supprimé `core/PHASE_B_DELIVERY.md`** — Phase B terminée
51. **Supprimé `RUNBOOK_PHASE_AB.md`** — Obsolète
52. **Supprimé `VALIDATION_E2E_REPORT.md`** — Rapport initial

### Phase 11 — Correction Paths Stale

53. **Corrigé 16 fichiers** — Toutes les occurrences `/home/abdelali` → `/home/pacadev` dans :
    - `.pacadev/config.yaml`
    - `core/scripts/init-acmecorp.sh`
    - `core/infra/scripts/recreate-containers.sh`
    - `core/infra/scripts/start-all-clients.sh`
    - `core/monitoring/docker-compose.yml`
    - `core/WORKFLOW_README.md`
    - `modules/README.md`
    - `web/src/lib/pacadev-service.ts`
    - `web/src/app/api/audit/stream/route.ts`
    - `web/src/app/api/clients/[slug]/branches/route.ts`
    - `v14/clients/innovation_electrique/addons/ens_core/tools/ensdev/ensdev_learn.py`
    - `v14/clients/sofilair/addons/ens_core/tools/ensdev/ensdev_learn.py`
    - `v19/clients/pacadai/addons/ens_core/tools/ensdev/ensdev_learn.py`

### Phase 12 — Fix Bug Critique HMAC Tokens

54. **Bug : `ApprovalToken.verify()` fail-open** — Retournait toujours `True` sans vérifier la signature
55. **Correction implémentée** dans `core/security/tokens.py` :
    - Ajout de `tokens.jsonl` pour stocker les données signées lors de `generate()`
    - `verify()` vérifie maintenant : format, expiration, client, action, **et signature HMAC-SHA256**
    - Utilisation de `hmac.compare_digest()` pour la comparaison (timing-safe)
    - `get_info()` retourne maintenant les métadonnées du token (client, action, user, reason)

### Phase 13 — Nouvelle Documentation

56. **Réécrit `docs/ARCHITECTURE.md`** — Refléte l'état réel du serveur VM Proxmox
57. **Créé `docs/SERVEUR_SETUP.md`** — Guide d'installation des outils serveur
58. **Créé `docs/CLI_REFERENCE.md`** — Référence complète des 16 commandes CLI
59. **Créé `docs/WORKFLOW.md`** — Workflow complet (FSM + cycle de vie ticket + RBAC + audit)

### Phase 14 — Absorption Web dans le Repo Principal

60. **Décision** — `web/` absorbé dans le repo principal (pas de repo séparé)
61. **`web/.git` supprimé** — Plus de repo git séparé pour web
62. **`web/.gitignore` créé** — Exclut `node_modules/`, `.next/`, `.env`, `*.db`
63. **184 fichiers trackés** — Dashboard Next.js (src/, components, API routes, etc.)
64. **Même branch strategy** — `dev/web/<ticket>-<action>` pour les tickets dashboard
65. **Rebuild `.next`** — Dashboard rebuildé sans paths stale

### Phase 15 — Push Final

66. **Commit principal** — Tous les changements poussés sur `dev/mecafric_water/8-water-templates`
67. **3 commits** :
    - `72e55da` — cleanup: nettoyage serveur + docs + fix HMAC tokens
    - `1253ddf` — Revert absorption (temporaire)
    - `e74e0b2` — refactor: web/ absorbe dans repo principal

---

## 6. Bugs Corrigés

| # | Bug | Correction | Fichier(s) |
|---|---|---|---|
| 1 | Paths `/data/Pacadev` hardcodés | Remplacement par `/home/pacadev/pacadev` | 7 fichiers |
| 2 | Ven shebangs `/home/abdelali/` | Remplacement par `/home/pacadev/` | `.venv/bin/*` |
| 3 | `db_name` filtre database manager | Supprimé des odoo.conf | 4 fichiers |
| 4 | `list_db` non défini | `list_db = True` ajouté | 4 fichiers |
| 5 | `db_port = 5434` (port host) | Corrigé à `5432` | mecafric_water |
| 6 | `extra_hosts` mauvaise IP | Supprimé | mecafric_water |
| 7 | `abdelali`/`` littéraux | `odoo`/`odoo` | mecafric |
| 8 | SOPS age key au mauvais endroit | Copiée dans `~/.config/sops/age/` | — |
| 9 | sops binary pas dans PATH | Path hardcodé | secrets.py |
| 10 | Traefik labels incomplets | `entrypoints=web` ajouté | afrequip/maxelec |
| 11 | Dashboard `.env` paths locaux | Corrigés pour serveur | web/.env |
| 12 | Paths `/home/abdelali` dans 16 fichiers | Tous corrigés | Voir Phase 11 |
| 13 | **`ApprovalToken.verify()` fail-open** | **Vérification HMAC-SHA256 réelle** | core/security/tokens.py |
| 14 | web/ était un repo git séparé | Absorbé dans le repo principal | web/ |

---

## 7. Bugs Connus Non Corrigés

| # | Bug | Sévérité | Description |
|---|---|---|---|
| 1 | `check_github_issue` non testé | Moyen | Nécessite accès GitHub (token non configuré) |
| 2 | Ollama/ChromaDB non installés | Faible | Mémoire IA non fonctionnelle |

---

## 8. URLs d'Accès

### Depuis le serveur

| Service | URL |
|---|---|
| afrequip | `http://localhost:8070` |
| maxelec | `http://localhost:8082` |
| mecafric | `http://localhost:8092` |
| mecafric_water | `http://localhost:8076` |
| Dashboard | `http://localhost:3000` |
| Traefik Dashboard | `http://localhost:8091` |

### Via Traefik

```
192.168.11.20  afrequip.pacadev.local maxelec.pacadev.local mecafric.pacadev.local mecafric_water.pacadev.local pacadev.local web.pacadev.local
```

---

## 9. Structure du Serveur

```
/home/pacadev/pacadev/
├── .pacadev/                    # Config, state, secrets (SOPS)
├── .venv/                       # Python 3.12 venv + CLI pacadev
├── core/
│   ├── cli/                     # CLI Typer (pacadev command)
│   ├── workflow/                # FSM (13 états, 20 transitions)
│   ├── audit/                   # Logger JSONL + Verifier SHA256
│   ├── security/                # Tokens HMAC (fixé), RBAC, Approval
│   ├── memory/                  # Ollama + ChromaDB (non installés)
│   ├── monitoring/              # Prometheus + Grafana + Loki
│   ├── infra/
│   │   ├── traefik/             # Traefik v2.11 + dynamic config
│   │   └── scripts/             # start/stop/verify
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
│   ├── src/app/api/             # 32 API endpoints
│   ├── src/components/          # UI components
│   ├── src/lib/                 # pacadev-service.ts (connecteur CLI)
│   └── .gitignore               # node_modules, .next, .env, *.db
├── docs/
│   ├── ARCHITECTURE.md          # Architecture serveur
│   ├── SERVEUR_SETUP.md         # Guide installation
│   ├── CLI_REFERENCE.md         # Référence CLI
│   ├── WORKFLOW.md              # Workflow complet
│   └── RAPPORT_MIGRATION_SERVEUR.md  # Ce fichier
└── README.md
```

---

## 10. Stratégie de Branches

### Clients Odoo

```
dev/<client>/<ticket>-<action>
```

| Exemple | Description |
|---|---|
| `dev/afrequip/42-fix-invoice-report` | Fix bug ticket #42 pour afrequip |
| `dev/mecafric/43-add-module` | Nouveau module ticket #43 |

### Dashboard Web

```
dev/web/<ticket>-<action>
```

| Exemple | Description |
|---|---|
| `dev/web/44-add-dark-mode` | Feature dashboard ticket #44 |
| `dev/web/45-fix-metrics-api` | Fix API ticket #45 |

### Workflow par ticket

```
1. Issue GitHub créée (tag: client:<slug>)
2. pacadev work start --client <slug> --issue <N>
   → Branche créée: dev/<slug>/<N>-<description>
   → FSM: IDLE → DEV
3. Développement + commits
4. pacadev work review → SELF_REVIEW
5. pacadev work test-manual → TEST_MANUAL
6. pacadev work commit --push → CI_PENDING
7. CI/CD GitHub Actions → STAGING
8. pacadev deploy approve → PROD_APPROVAL → PROD_DEPLOYED → CLOSED
```

---

## 11. Commandes Utiles

```bash
# Connexion
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

# PostgreSQL
docker exec pacadev_postgres_shared psql -U odoo -d postgres -c '\l'

# Dashboard
curl -s http://localhost:3000/api/services
curl -s http://localhost:3000/api/clients
```

---

## 12. Prochaines Étapes

1. **Configurer `/etc/hosts`** sur Windows pour accès Traefik
2. **GitHub token** — Configurer pour CI/CD et commandes `pacadev issue`
3. **Monitoring** — `docker compose -f core/monitoring/docker-compose.yml up -d`
4. **Ollama + ChromaDB** — Si mémoire IA souhaitée
5. **Dashboard production** — HTTPS via Traefik, base PostgreSQL au lieu de SQLite
