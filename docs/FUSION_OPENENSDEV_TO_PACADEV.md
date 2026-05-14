# FUSION OPENENSDEV → PACADEV
## Plan stratégique et technique pour conserver pacadev comme orchestrateur final, enrichi des meilleures pratiques d'OpenEnsdev

**Date :** 2026-05-14
**Auteur :** Analyse comparative générée par Claude Code
**Sources analysées :**
- `/home/abdelali/OpenEnsdev` (ancien orchestrateur, opérationnel ~2 ans)
- `/home/abdelali/pacadev` (nouvel orchestrateur, Phase A+B validées)

**Objectif final :** Garder `pacadev` comme orchestrateur unique, en y intégrant les forces opérationnelles de `OpenEnsdev` (workflow IA, orchestration multi-clients Docker, mémoire contextuelle, dashboard).

---

## TABLE DES MATIÈRES

1. [Vision et principes de fusion](#1-vision-et-principes-de-fusion)
2. [Vue synoptique comparative](#2-vue-synoptique-comparative)
3. [Inventaire détaillé — OpenEnsdev](#3-inventaire-détaillé--openensdev)
4. [Inventaire détaillé — pacadev](#4-inventaire-détaillé--pacadev)
5. [Comparaison feature par feature](#5-comparaison-feature-par-feature)
6. [Plan de fusion — architecture cible](#6-plan-de-fusion--architecture-cible)
7. [Roadmap d'exécution (8 phases)](#7-roadmap-dexécution-8-phases)
8. [Détails techniques par composant à porter](#8-détails-techniques-par-composant-à-porter)
9. [Stratégie de migration des modules Odoo](#9-stratégie-de-migration-des-modules-odoo)
10. [Stratégie de migration des clients Docker](#10-stratégie-de-migration-des-clients-docker)
11. [Tests, validation & checklists](#11-tests-validation--checklists)
12. [Risques, antipatterns & mitigations](#12-risques-antipatterns--mitigations)
13. [Annexes](#13-annexes)

---

# 1. VISION ET PRINCIPES DE FUSION

## 1.1 Pourquoi cette fusion

`OpenEnsdev` est **mature opérationnellement** mais souffre de dérive : 14/16 conteneurs clients à l'arrêt depuis ~2 mois, secrets en clair (`.env`, `admin_passwd`), aucun test automatisé, duplication de modules (`cli/ensdev/ens_core-17/` ↔ `main-dev-repo/ens_core-17/`), pas de CI/CD active.

`pacadev` est **moderne et rigoureux** : FSM stricte 11 états, audit immuable JSONL hashé, RBAC + tokens HMAC, secrets SOPS/age, monitoring Prometheus/Grafana/Loki, IA Risk Scoring intégré dans la CI, 34/34 tests E2E validés. Mais il manque encore : modules métier (Odoo 17 production), clients réellement déployés, mémoire contextuelle pour l'IA, dashboard opérationnel visible.

→ La fusion = **prendre la rigueur architecturale de pacadev comme socle** et **importer le savoir-faire opérationnel d'OpenEnsdev** (modules métier, scripts d'orchestration éprouvés, intégration IA locale, expérience clients réels).

## 1.2 Principes directeurs

| Principe | Application concrète |
|---|---|
| **pacadev = source de vérité** | Toute action (deploy, backup, rollback, work start) passe par le CLI `pacadev`. L'ancien CLI `ensdev` est progressivement déprécié. |
| **FSM + Audit immuable obligatoires** | Aucun shortcut. Tout changement d'état d'un client passe par `workflow/fsm.py` et est loggé dans `~/.pacadev/audit-log.jsonl`. |
| **Secrets jamais en clair** | Migration immédiate des `.env`, `admin_passwd`, clés API d'OpenEnsdev vers `secrets/*.enc.yaml` chiffrés SOPS/age. |
| **Tests d'abord** | Aucun nouveau script porté sans test pytest associé. Cible : maintenir 100 % de réussite sur `validate-e2e.py`. |
| **Réutilisation > réécriture** | Les artefacts éprouvés d'OpenEnsdev (workflow engine 10 états, dashboard Streamlit, scripts UFW/Docker, wrapper Aider) sont **adaptés** au schéma pacadev, pas redéveloppés. |
| **Décommissionner par paliers** | OpenEnsdev reste accessible en lecture seule tant que tous ses clients ne sont pas migrés + validés. Pas de "big bang". |

## 1.3 Ce qui doit disparaître à terme

- `cli/ensdev/` (remplacé par `core/cli/`).
- `cli/enstask-legacy/`, `cli/odooctl_old/` (déjà dépréciés).
- `main-dev-repo/` (modules absorbés dans `v17/clients/<client>/addons/ens_core/` ou submodule partagé).
- `.env` à la racine OpenEnsdev (clés migrées vers SOPS).
- `~/.ensdev/` (état remplacé par `~/.pacadev/state/`).
- Conteneurs clients arrêtés depuis >60 jours : décision archive vs reactivation par client.

## 1.4 Ce qui doit être préservé absolument

- Les modules Odoo 17 ENS de `main-dev-repo/ens_core-17/` (6 modules production : `custom_reports`, `custom_sale_invoice`, `ens_crm_task`, `ens_extra`, `ens_reports_print`, `enswork_config_center`, `partner_statement_report`).
- Les configurations clients fonctionnelles (au minimum `specta` v14, `afrequip`/`maxelec`/`mecafric` v17, `pacadai` v19).
- Les bases PostgreSQL avec leurs filestores (backup avant toute opération).
- Les conventions de branches `dev/<client>-<ticket>-<action>` (déjà compatibles avec pacadev `dev/<client>/<ticket>-<action>` — léger ajustement du séparateur).
- Le workflow engine 10 états (à fusionner avec FSM 11 états pacadev).
- Mem0 + ChromaDB + Ollama (à intégrer comme module IA local optionnel).

---

# 2. VUE SYNOPTIQUE COMPARATIVE

## 2.1 Matrice de capacité

| Dimension | OpenEnsdev | pacadev | Verdict |
|---|---|---|---|
| **Orchestration multi-clients Docker** | ✅ 16 clients (specta actif, 14 arrêtés) | 🟡 3 clients initialisés, peu d'usage réel | OpenEnsdev gagne en maturité, pacadev gagne en hygiène |
| **CLI principale** | `ensdev` (9 cmds, Typer, venv Mem0) | `pacadev` (10 cmds, Typer, .venv) | Architecture pacadev plus propre, fonctionnalités à compléter |
| **Workflow / state machine** | 10 états (workflow_engine.py) sans FSM stricte | 11 états FSM stricte + transitions validées | pacadev gagne (sécurité) |
| **Audit / traçabilité** | Logs dispersés Docker/Traefik | JSONL append-only + hash chaîné SHA256 | pacadev gagne (tamper-proof) |
| **RBAC / permissions** | ❌ Aucun | ✅ 4 rôles (admin/lead/dev/viewer) | pacadev gagne |
| **Approbations prod** | Manuel | Tokens HMAC 15 min usage unique | pacadev gagne |
| **Secrets management** | `.env` clair + admin_passwd hardcodé | SOPS + age (clés locales) | pacadev gagne (critique) |
| **Tests automatisés** | Aucun (manuel UI Odoo) | 34/34 E2E + tests FSM unitaires | pacadev gagne |
| **CI/CD** | Pre-commit (non enforce) | GitHub Actions complet (lint+test+sec+IA risk) | pacadev gagne |
| **IA développement** | Mem0 local + Ollama + Aider | Continue.dev + Claude (cloud) + agents | Complémentaire — fusion possible |
| **IA Risk Scoring** | ❌ | ✅ Claude Haiku 0.0–1.0 auto-merge | pacadev gagne |
| **Dashboard / observabilité** | Streamlit 2 onglets (supervision + workflow) | Prometheus + Grafana + Loki | Complémentaire — Streamlit pour ops, Grafana pour métriques |
| **Backups** | Bind mounts, dumps manuels | Ansible role `backup-atomic` (DB+filestore atomique) | pacadev gagne (idempotence) |
| **Rollback** | Manuel | Ansible role `rollback-atomic` | pacadev gagne |
| **Modules Odoo ENS** | 6 modules production (v17) | ❌ Aucun encore importé | OpenEnsdev gagne — à migrer |
| **Documentation processus** | `Workflow ENSDEV Orchestration.md`, `OPENENSDEV_REFERENCE.md`, etc. | `ARCHITECTURE.md`, `RUNBOOK.md`, `PHASE_A/B_DELIVERY.md` | Égalité, à consolider |
| **Devcontainer / IDE** | `.vscode/` minimaliste | `templates/devcontainer/` + Continue.dev | pacadev gagne |
| **Reverse proxy** | Traefik v2.11 actif | Non configuré | OpenEnsdev gagne — à reproduire dans pacadev |
| **PostgreSQL partagé** | Container `odoo_postgres_shared` (PG 14) | Non centralisé | OpenEnsdev gagne — à reproduire |
| **Monitoring stack** | Portainer GUI uniquement | Prometheus+Grafana+Loki+Promtail | pacadev gagne |
| **VPN / accès** | Aucun | Tailscale ACL prévu | pacadev gagne |
| **Versionnage modules** | `17.0.X.Y.Z` (semver Odoo) | `17.0.X.Y.Z` + tags `<client>/v17/<date>-<build>` | Compatible, pacadev étend |

## 2.2 Heuristique de décision de fusion

```
Pour chaque composant d'OpenEnsdev :
  SI pacadev a déjà un équivalent plus rigoureux ET fonctionnel :
    → Documenter l'équivalent + déprécier OpenEnsdev
  SINON SI OpenEnsdev a un asset opérationnel manquant dans pacadev :
    → Porter sous core/ ou v17/clients/, avec tests et secrets externalisés
  SINON SI les deux ont des approches complémentaires :
    → Fusionner sous l'architecture pacadev (FSM, audit, RBAC)
  SINON :
    → Archiver
```

## 2.3 Schéma d'architecture cible (post-fusion)

```
┌─────────────────────────────────────────────────────────────────┐
│                         PACADEV (final)                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  CLI         │  │  Workflow    │  │  Security Layer      │  │
│  │  pacadev     │→ │  FSM 11 états│← │  RBAC + Tokens HMAC  │  │
│  │  (Typer)     │  │  + Audit     │  │  + SOPS/age secrets  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                  │                                    │
│  ┌──────┴──────────────────┴────────────────────────────────┐  │
│  │  Memory & Context Layer (intégré d'OpenEnsdev)           │  │
│  │  Mem0 + ChromaDB + Ollama (optionnel, local)             │  │
│  │  Continue.dev + Claude (cloud) ← existant                │  │
│  └─────────────────────────────┬────────────────────────────┘  │
│                                 │                                │
│  ┌──────────────────────────────┴───────────────────────────┐  │
│  │  Orchestration Infrastructure                            │  │
│  │  Ansible (deploy / backup-atomic / rollback-atomic)      │  │
│  │  + scripts shell (start-all-clients, verify-ufw-docker)  │  │
│  └──────────────────────────────┬───────────────────────────┘  │
│                                 │                                │
│  ┌──────────────────────────────┴───────────────────────────┐  │
│  │  Runtime (Docker)                                        │  │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ PostgreSQL partagé  │  │ Traefik v2.11 (reverse) │  │  │
│  │  │ (porté d'OpenEnsdev)│  │ (porté d'OpenEnsdev)    │  │  │
│  │  └─────────────────────┘  └──────────────────────────┘  │  │
│  │                                                          │  │
│  │  v14/clients/<C>   v17/clients/<C>   v19/clients/<C>    │  │
│  │  └─ docker-compose ─ addons (oca / ens_core) ─ config   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Observabilité                                            │  │
│  │  Prometheus + Grafana + Loki + Promtail (pacadev existant)│  │
│  │  + Dashboard Streamlit "Operator UI" (porté OpenEnsdev)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CI/CD (GitHub Actions)                                   │  │
│  │  Lint → Tests → Bandit/Trivy → IA Risk → Auto-merge       │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

# 3. INVENTAIRE DÉTAILLÉ — OpenEnsdev

## 3.1 Arborescence

```
/home/abdelali/OpenEnsdev/   (~16.7 GB, NON git à la racine)
├── main-dev-repo/           # 8.5 MB — repo Git GitHub a-bahou/ensdev (modules ENS)
│   ├── ens_core-14/         # legacy, minimal
│   ├── ens_core-17/         # 6 modules ENS production
│   │   ├── custom_reports/              v17.0.1.44
│   │   ├── custom_sale_invoice/
│   │   ├── ens_crm_task/
│   │   ├── ens_extra/
│   │   ├── ens_reports_print/
│   │   ├── enswork_config_center/
│   │   └── partner_statement_report/   (récent)
│   ├── ens_core-19/         # squelette
│   ├── configs/             # fichiers config par client
│   ├── AI_CODE_RULES.md     # standards obligatoires pour code IA
│   ├── AI_PROMPT_STANDARD.md
│   ├── odools.toml          # Odoo Language Server
│   ├── WORKFLOW.md          # workflow Git v2.0
│   └── NEW_METHODODOLOGY_README.md
├── cli/                     # 47 MB
│   ├── ensdev/              # CLI v1.2.0 (Typer + venv-mem0)
│   ├── enstask-legacy/      # déprécié
│   ├── odooctl              # gestion containers (Typer)
│   └── odooctl_old/         # déprécié
├── clients/                 # 6.6 GB — environnements Docker
│   ├── 14.0/local/{africapool, biomatec, innovation_electrique, scandi, sidtec, sofilair, specta}
│   ├── 14.0/local/vps_partage/{enzo_industrie, ex_connect, fime, shared_vps}
│   ├── 17.0/local/{afrequip, maxelec, mecafric}
│   ├── 17.0/local/vps_partage/{aquaplanet, elecap, enswork, ibtech, shared_vps}
│   ├── 17.0/local/vps_dedie/{mecafric, mecafric_water, powerone}
│   └── 19.0/local/pacadai
├── infra/                   # services partagés
│   ├── postgres/            # PG 14 (odoo_postgres_shared) + docker-compose
│   ├── traefik/             # Traefik v2.11 + dynamic routes
│   ├── portainer/           # GUI supervision
│   ├── logs/                # agrégation
│   └── scripts/             # start-all-clients.sh + UFW
├── odoo-sources/odoo-17/    # 1.2 GB sources Odoo 17 (pour IDE/Language Server)
├── venv-odoo-dev/           # 8.1 GB venv PyCharm/Aider
├── venv-mem0/               # 833 MB venv ensdev CLI
├── scripts/                 # setup-orchestration.sh, apply-openensdev-local.sh
├── docs/                    # docs maintenance + reprise
├── .env                     # ⚠️ secrets en clair
├── CLAUDE.md, versions.txt, .gitignore
└── .vscode/, .claude/, .grok/, .mem0/
```

## 3.2 CLI `ensdev` v1.2.0 (47 MB)

**Entry point :** `cli/ensdev/cli.py` (Typer)
**Venv :** `~/OpenEnsdev/venv-mem0/bin/python` (Python 3.12)

### 3.2.1 Commandes

| Commande | Signature | Rôle | Notes pour fusion |
|---|---|---|---|
| `start` | `ensdev start <client> <ticket> [msg] [--version]` | Checkout branche `dev/<client>-<ticket>-<action>` + charge contexte Mem0 + lance Aider | À porter vers `pacadev work start --client X --issue N` |
| `next` | `ensdev next` | Avance à l'étape suivante du workflow (10 états) | À fusionner avec FSM pacadev |
| `commit` | `ensdev commit <msg> [--client] [--version]` | Commit formaté `[module] type: desc` | À porter dans `pacadev work commit` |
| `deploy` | `ensdev deploy <env> <client> [--version] [--target]` | Déploie conteneur + backup DB | Déjà couvert par `pacadev deploy` mais à enrichir des patterns OpenEnsdev |
| `done` | `ensdev done <ticket_id>` | Ferme issue GitHub | À porter dans `pacadev issue close` ou `pacadev work done` |
| `status` | `ensdev status` | État workflow courant | Recoupe `pacadev work status` |
| `memory-search` | `ensdev memory-search <query> [--client]` | Recherche Mem0 local (ChromaDB) | À porter — **valeur unique** |
| `dashboard` | `ensdev dashboard` | Lance Streamlit | À porter comme `pacadev dashboard` |
| `orchestrate` | `ensdev orchestrate <ticket> [--action] [--client]` | UI orchestration workflow | À fusionner avec FSM |

### 3.2.2 Workflow engine — 10 états

**Fichier :** `cli/ensdev/workflow_engine.py` (~137 lignes)
**Persistance :** `~/.ensdev/workflow/ticket_<N>.json`

| # | État | Émoji | Action attendue |
|---|---|---|---|
| 1 | `TICKET_CREATION` | 📥 | Formulaire création (GitHub issue) |
| 2 | `TICKET_OPENED` | 🔍 | Ticket chargé, contexte Mem0 injecté |
| 3 | `DEV_IN_PROGRESS` | 🏗️ | Aider en cours |
| 4 | `SELF_REVIEW` | 👀 | Diff + rapport technique |
| 5 | `TEST_AUTO` | 🤖 | pytest + Flake8 + vérifications Odoo |
| 6 | `TEST_MANUEL` | 🧪 | UI Odoo + checklist fonctionnelle |
| 7 | `READY_FOR_COMMIT` | ✅ | Prévisualisation commit |
| 8 | `COMMITTED` | 🔵 | Push GitHub |
| 9 | `DEPLOYED` | 🚀 | Déploiement + backup |
| 10 | `CLOSED` | 🏁 | Clôture + rapport PDF |

**Méthodes clés :** `load_state()`, `save_state()`, `next_state()`, `previous_state()`, `set_state()`, `pause()`, `list_active()`, `@property progress`.

### 3.2.3 Memory system

**Fichier :** `cli/ensdev/memory/mem0_local.py`

**Stack :**
- **LLM :** Ollama + `llama3.1:8b-instruct-q6_K`
- **Embedder :** Ollama + `nomic-embed-text`
- **Vector store :** ChromaDB local (`cli/ensdev/memory/chroma_db/`)
- **History DB :** `~/.mem0/history.db`

**Loaders :**
- `load_clients.py` — règles spécifiques par client
- `load_rules.py` — standards Odoo 14/17/19
- `load_history.py` — historique des fixes

**Usage :** `memory.search(query, user_id=client_name)`

### 3.2.4 Dashboard Streamlit

**Fichier :** `cli/ensdev/dashboard.py` (~200 lignes)

**Onglet 1 — Supervision**
- Recherche Mem0
- Historique actions (`~/.ensdev/history.log`)
- Monitoring Docker (`docker ps`, stats)
- GitHub issues
- Stats Mem0 (collections, métriques)

**Onglet 2 — Orchestration Workflow**
- Sélection ticket + état courant
- Barre de progression (0-100 %)
- Boutons spécifiques par état
- Historique transitions
- Navigation (⬅️ Retour, ⏸️ Pause, ⏭️ Forcer)

**URL :** `http://openensdev.local` (Traefik) ou `http://localhost:8501`
**Service systemd :** `ensdev-dashboard` (user service auto-start)

### 3.2.5 Aider wrapper

**Fichier :** `cli/ensdev/agent/aider_wrapper.py`

**Flux :**
1. Récupère règles client + historique fixes depuis Mem0
2. Détecte version Odoo (14/17/19)
3. Construit prompt contexte (client rules + Odoo rules + history)
4. Génère `.aider.yml` temporaire
5. Lance Aider avec contexte pré-chargé (offline llama3.1 via Ollama)

## 3.3 Infrastructure

### 3.3.1 PostgreSQL partagé

**Container :** `odoo_postgres_shared` (image `postgres:14`)
**Volume :** `infra/postgres/data` → `/var/lib/postgresql/data`
**Network :** `odoo-network` (external)
**Credentials :** user/password `odoo/odoo`
**Bases détectées :** `postgres`, `specta_prod`, `bd-erp-mecafric` (les autres ont possiblement été archivées)

### 3.3.2 Traefik v2.11

**Container :** `traefik`
**Ports :** 80 (web), 8080 (dashboard insecure)
**Providers :** Docker + fichiers dynamiques (`infra/traefik/dynamic/`)
**Route dynamique principale :** `openensdev.local` → `http://172.21.0.1:8501` (dashboard Streamlit)
**Pattern client (labels Docker) :**
```yaml
- traefik.enable=true
- traefik.http.routers.<client>.rule=Host(`<client>.odoo.localhost`)
- traefik.http.services.<client>.loadbalancer.server.port=8069
```

### 3.3.3 Portainer

**Container :** `portainer` (image `portainer-ce:latest`)
**Port :** 9000
**Rôle :** GUI supervision Docker

### 3.3.4 Structure type d'un client OpenEnsdev

```
clients/<version>/local/<client>/
├── docker-compose.yml           # service Odoo
├── config/odoo.conf             # addons_path + DB + admin_passwd (⚠️ hardcodé)
├── addons/
│   ├── ens_core/                # bind mount vers main-dev-repo
│   ├── oca/                     # modules OCA
│   └── oca_custom/              # custom OCA
├── filestore/                   # données fichiers Odoo
└── backups/                     # snapshots tar.gz
```

**Exemple `docker-compose.yml` (maxelec) :**
```yaml
services:
  maxelec_odoo:
    image: odoo:17.0
    environment:
      HOST: odoo_postgres_shared
      DB_NAME: maxelec_prod
    volumes:
      - ./addons/ens_core:/mnt/extra-addons/ens_core
      - ./config:/etc/odoo
      - ./filestore:/var/lib/odoo/filestore
    ports: ["8082:8069"]
    labels:
      - traefik.enable=true
      - traefik.http.routers.maxelec.rule=Host(`maxelec.odoo.localhost`)
```

### 3.3.5 Scripts infra

| Script | Lignes | Rôle |
|---|---|---|
| `infra/scripts/start-all-clients.sh` | 169 | Démarrage master + vérification état |
| `infra/scripts/verify-ufw-docker.sh` | 273 | Diagnostic firewall UFW vs Docker (gold standard à porter) |
| `infra/scripts/configure-ufw-docker.sh` | 130 | Configuration UFW pour Traefik/clients |
| `infra/scripts/recreate-containers.sh` | 48 | Reset Docker (rm + recreate) |
| `scripts/setup-orchestration.sh` | 123 | Init workflow + systemd service ensdev-dashboard |
| `scripts/apply-openensdev-local.sh` | 56 | Setup DNS local + Traefik openensdev.local |

## 3.4 Configuration & secrets (état actuel — à corriger)

**Fichier :** `OpenEnsdev/.env`
```
ANTHROPIC_API_KEY=sk-ant-api03-...    # ⚠️ EN CLAIR
OLLAMA_API_BASE=http://127.0.0.1:11434
```

**Fichier :** `clients/*/config/odoo.conf`
```
admin_passwd = <REDACTED — voir backup pré-migration ~/backups/openensdev_<date>/>   # ⚠️ HARDCODÉ
db_password = <REDACTED — défaut faible>                                              # ⚠️ FAIBLE
```

→ **À chiffrer immédiatement** via SOPS lors de la fusion (cf. §8.6).
→ Les valeurs réelles sont consultables uniquement via `sops -d` post-Phase 4.

## 3.5 Git workflow main-dev-repo

**Fichier :** `main-dev-repo/WORKFLOW.md`

**Branches :**
- `main` — modules stables toutes versions
- `client/<version>/<nom>` — branche par client (×16)
- `dev/<client>-<ticket>-<action>` — branche de travail

**Convention commit :**
```
[module_name] type: description

Détails si nécessaire

Refs: #N
```
Types : `feat`, `fix`, `refactor`, `docs`, `test`.

**Exemples :**
```
[ens_crm_task] feat: add custom field deadline_date
Refs: #42

[custom_reports] fix: invoice total calculation
Refs: #42
```

## 3.6 Forces & faiblesses synthèse

**Forces :**
- ✅ Architecture infrastructure mature (Docker + Traefik + PG partagé + Portainer).
- ✅ CLI ensdev fonctionnelle avec workflow engine et orchestration.
- ✅ IA locale Mem0 + Ollama + Aider (offline, 0 €).
- ✅ Modules Odoo 17 ENS robustes en production.
- ✅ Documentation processus complète.

**Faiblesses :**
- ❌ Aucun test automatisé.
- ❌ Duplication code (`cli/ensdev/ens_core-17/` ↔ `main-dev-repo/ens_core-17/`).
- ❌ 11/16 conteneurs clients arrêtés depuis ~2 mois.
- ❌ Secrets en clair (`.env`, `admin_passwd`).
- ❌ Pas de CI/CD active (`.github/workflows/` vides).
- ❌ Pas de RBAC, pas d'approbations, pas d'audit immuable.
- ❌ Observabilité minimaliste (logs dispersés).

---

# 4. INVENTAIRE DÉTAILLÉ — pacadev

## 4.1 Arborescence

```
/home/abdelali/pacadev/      (Git initialisé, dépôt local)
├── core/                    # orchestrateur central
│   ├── agents/              # context-builder, risk-scorer (Claude Haiku)
│   ├── ansible/             # roles: backup-atomic, odoo-deploy, rollback-atomic + playbooks
│   ├── audit/               # logger.py (~120 L), verifier.py (~100 L)
│   ├── ci-templates/        # pipeline-base.yml, deploy.yml
│   ├── cli/                 # main.py (entry) + commands/ (10 sous-cmds) + utils/
│   ├── monitoring/          # Prometheus/Grafana/Loki/Promtail + dashboards
│   ├── scripts/             # validate-e2e.py (396 L), test-phase-ab-integration.py, init-rbac.py, setup-github-*, tailscale-auth.sh
│   ├── secrets/             # .sops.yaml + .env.template.yaml + *.enc.yaml
│   ├── security/            # rbac.py (189 L), tokens.py (166 L), secrets.py (114 L)
│   ├── templates/           # devcontainer/ (docker-compose.dev.yml, devcontainer.json, continue.json, odoo.conf, .aiignore)
│   ├── workflow/            # fsm.py (~190 L, 11 états), validators.py, test_fsm.py (220 L)
│   ├── PHASE_A_DELIVERY.md / PHASE_A_INTEGRATION.md
│   ├── PHASE_B_DELIVERY.md / PHASE_B_INTEGRATION.md
│   ├── WORKFLOW_README.md
│   ├── .sops.yaml
│   └── tailscale-acl.json
├── v14/clients/, v17/clients/, v19/clients/   # clients par version (afrequip, maxelec, mecafric initialisés en v17)
├── migration/               # from-enswork/, from-openensdev/, from-pacadai/, from-pacadev-legacy/ (vides actuellement)
├── docs/                    # ARCHITECTURE.md, RUNBOOK.md
├── .pacadev/                # état global multi-clients
│   ├── config.yaml          # defaults (odoo_version=17, ai.provider=anthropic, risk_threshold=0.5)
│   ├── state/
│   │   ├── versions.json    # source de vérité clients
│   │   └── audit-log.jsonl  # historique immuable hashé
│   ├── secrets/             # SSH keys, deploy_key
│   ├── logs/                # exécution CLI
│   └── clients/<C>/config.json
├── .github/                 # workflows + ISSUE/PR templates
├── .vscode/, .claude/, .venv/
├── RUNBOOK_PHASE_AB.md (418 L)
├── VALIDATION_E2E_REPORT.md (223 L)
└── core.zip (archive)
```

## 4.2 CLI `pacadev`

**Entry point :** `core/cli/main.py` (~92 lignes, Typer)
**Total :** ~1191 lignes (commands + utils)

| Commande | Sous-commandes | Rôle | Phase |
|---|---|---|---|
| `work` | `start` / `stop` / `status` | Démarrer dev sur ticket (init FSM, branche Git, RBAC check) | A/B |
| `deploy` | `approve` / `staging` / `prod` | Déployer avec gates (token HMAC requis pour prod) | A/B |
| `backup` | `create` / `list` | Snapshots atomiques DB + filestore | A |
| `rollback` | `--auto` / `--backup <id>` | Restauration post-incident | A |
| `test` | `run --module <m>` | Tests locaux pytest | A |
| `secrets` | `show` / `init` / `edit` / `encrypt` | Gestion SOPS/age | B |
| `generate` | `devcontainer` / `ci` | Génération templates client | A |
| `monitor` | `start` / `stop` / `logs` | Stack monitoring Prometheus/Grafana/Loki | A |
| `issue` | `create` / `list` / `update` | Intégration GitHub | A |
| `runbook` | — | Procédures d'urgence | A |

**Utils :**
- `utils/state.py` — init_client, list_clients, load_versions, get_client_config
- `utils/git.py` — create_branch (pattern `dev/<client>/<issue>-<action>`), current_branch
- `utils/docker.py` — container_running, healthcheck_odoo, healthcheck_db
- `utils/secrets.py` — decrypt_secrets (age), fetch_api_key
- `decorators.py` — `@require_permission`, `@require_approval`, `@mask_secrets_in_log`, `@validate_and_log`

## 4.3 FSM (workflow stricte) — 11 états

**Fichier :** `core/workflow/fsm.py` (~190 lignes)

```
INIT
 │ (work_start_valid → RBAC + validators)
 ▼
DEV
 ├── (push_detected) → CI_RUNNING
 └── (error_occurred) → ERROR

CI_RUNNING
 ├── (all_checks_pass) → CI_PASSED
 ├── (check_failed) → DEV
 └── (error_occurred) → ERROR

CI_PASSED → MERGED → STAGING_DEPLOYED → STAGING_VALIDATED
 → PROD_APPROVED → PROD_DEPLOYED → CLOSED

ERROR
 │ (rollback_triggered)
 ▼
DEV
```

**Validateurs pré-vol** (`workflow/validators.py`) :
- Issue GitHub existe + ouvert
- Branche `dev/<client>/<issue>-*`
- Dépôt Git local sain
- Tests locaux pass
- Backup < 24 h
- CI checks passing
- Secrets chiffrés (SOPS)

## 4.4 Audit immuable

**Fichier :** `core/audit/logger.py` + `verifier.py`
**Format :** JSONL append-only, hash chaîné SHA256

```json
{
  "timestamp": "2026-05-13T12:34:56.789123",
  "action": "deploy_prod",
  "client": "acmecorp",
  "user": "alice",
  "git_commit": "bea4f483",
  "tag": "acmecorp/v17/2026.05.13-1",
  "prev_hash": "88eb3e29...",
  "hash": "99647e1c..."
}
```

**Vérification :** `AuditVerifier.verify_log_integrity()` recalcule la chaîne et détecte toute falsification.

## 4.5 Security Layer

### 4.5.1 RBAC

**Fichier :** `core/security/rbac.py` (~189 L)

| Rôle | work_start | test | staging | prod | approve | rollback |
|---|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `lead` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `dev` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `viewer` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Utilisateurs par défaut :** `abdelali=admin`, `alice=lead`, `bob/charlie=dev`, `viewer=viewer`.

### 4.5.2 Tokens HMAC

**Fichier :** `core/security/tokens.py` (~166 L)
**Format :** `token_<timestamp>.<git_commit>.<signature>`
**Propriétés :** HMAC-SHA256, expiration 15 min, usage unique.
**Clé secrète :** `$HOME/.pacadev/secret.key` ou `$PACADEV_SECRET_KEY`.

### 4.5.3 Secrets masking

**Fichier :** `core/security/secrets.py` (~114 L)
**9 patterns détectés :** API keys, passwords, GitHub tokens, private keys (SSH/RSA/GPG), AWS creds, DB passwords, Slack/Stripe tokens, URLs avec credentials, env vars sensibles.
**Appliqué automatiquement à :** audit log, CLI output, GitHub Actions logs.

### 4.5.4 SOPS/age secrets

**Fichier :** `core/.sops.yaml`
```yaml
age key: age1ryz9rjrfhaywedjq7sk8wdtym7w4m9mg47ezhgu5hgryfvntwgtq6naerr
rules: *.enc.yaml, secrets/*.yaml
```

## 4.6 CI/CD

**Fichier principal :** `.github/workflows/pacadev-pipeline.yml`

Pipeline sur push `dev/**` :
1. **LINT** — `ruff check` + `pylint-odoo`
2. **TESTS** — `pytest-odoo` (DB isolée)
3. **SECURITY** — `bandit` + `safety` + `trivy`
4. **IA RISK** — Claude Haiku score 0.0–1.0
   - Score < 0.5 → auto-merge + tag auto
   - Score ≥ 0.5 → review humaine requise
5. **DEPLOY** — Trigger `pacadev deploy` sur merge

**Templates :** `.github/PULL_REQUEST_TEMPLATE/`, `.github/ISSUE_TEMPLATE/bug.md|feature.md|incident.md`.

## 4.7 Monitoring stack

**Fichier :** `core/monitoring/docker-compose.yml`

| Service | Port | Rôle |
|---|---|---|
| Prometheus | 9090 | Métriques (scrape odoo, postgres, node_exporter) |
| Grafana | 3000 | Dashboards (`grafana/dashboards/pacadev-overview.json`) |
| Loki | 3100 | Agrégation logs |
| Promtail | — | Shipper logs (Docker JSON logs) |

**Alertes :** `prometheus/alerts.yml` (heartbeat, errors).

## 4.8 Ansible

| Role | Tâches |
|---|---|
| `backup-atomic` | pg_dump + tar filestore atomique timestamped |
| `odoo-deploy` | docker-compose pull, restart, curl healthcheck |
| `rollback-atomic` | pg_restore + tar extract + restart |

## 4.9 Templates devcontainer

`core/templates/devcontainer/` :
- `docker-compose.dev.yml` — Odoo 17 + PostgreSQL
- `devcontainer.json` — VSCode devcontainer
- `continue.json` — Claude via Continue.dev
- `odoo.conf` — config template
- `.aiignore` — exclusions secrets

## 4.10 Agents Claude

- `core/agents/context-builder/` — génère contexte IA (diff, impact).
- `core/agents/risk-scorer/` — Haiku → score 0.0–1.0.

## 4.11 Forces & faiblesses synthèse

**Forces :**
- ✅ FSM stricte 11 états + audit immuable hashé.
- ✅ RBAC 4 rôles + tokens HMAC 15 min.
- ✅ Secrets SOPS/age (zéro clair).
- ✅ CI/CD GitHub Actions complet (lint+test+sec+IA risk).
- ✅ Monitoring Prometheus + Grafana + Loki.
- ✅ Tests E2E 34/34 + tests FSM unitaires.
- ✅ Multi-version Odoo (14, 17, 19) prête.
- ✅ Devcontainer + Continue.dev (Claude intégré).
- ✅ Ansible idempotent pour deploy/backup/rollback.

**Faiblesses (gaps actuels) :**
- ❌ `migration/from-*/` vides — aucune migration commencée.
- ❌ Clients (afrequip, maxelec, mecafric) en `initialized`, jamais testés E2E réel.
- ❌ Pas de modules ENS Odoo 17 importés (les 6 modules critiques sont encore dans OpenEnsdev).
- ❌ Pas de PostgreSQL partagé ni de Traefik en production locale.
- ❌ Devcontainer template existe mais pas auto-appliqué.
- ❌ Monitoring stack pas auto-déployé depuis CLI.
- ❌ Agents Claude définis mais intégration CLI à confirmer.
- ❌ Mémoire contextuelle IA (Mem0) absente.
- ❌ Dashboard opérateur Streamlit absent (Grafana ≠ UX opérateur).
- ❌ Pas de chat-ops (Slack/Teams webhooks).

---

# 5. COMPARAISON FEATURE PAR FEATURE

## 5.1 Tableau exhaustif

| # | Capacité | OpenEnsdev | pacadev | Décision fusion |
|---|---|---|---|---|
| 1 | Versions Odoo supportées | 14, 17, 19 | 14, 17, 19 | ✅ Compatible — conserver schéma pacadev `v<X>/clients/<C>/` |
| 2 | Séparation par version | Dossier `clients/<X.0>/local/` | Dossier `v<X>/clients/<C>/` | ✅ pacadev plus propre — migrer clients OpenEnsdev vers ce schéma |
| 3 | Branche dev | `dev/<client>-<ticket>-<action>` | `dev/<client>/<issue>-<action>` | ⚠️ Mineur — adopter `/` (pacadev) partout, migrer ancien |
| 4 | Versionnage module | `17.0.X.Y.Z` (semver Odoo) | `17.0.X.Y.Z` + tags `<client>/v17/<date>-<build>` | ✅ Conserver pacadev (étend OpenEnsdev) |
| 5 | Workflow état | 10 états (workflow_engine.py) | 11 états (fsm.py) stricte | ✅ Garder FSM pacadev, mapper les 10 états OpenEnsdev (cf. §8.2) |
| 6 | Persistance état | `~/.ensdev/workflow/ticket_N.json` | `~/.pacadev/state/versions.json` + audit-log.jsonl | ✅ pacadev — déprécier `~/.ensdev/` |
| 7 | CLI principale | `ensdev` (Typer, venv-mem0) | `pacadev` (Typer, .venv) | ✅ pacadev — porter cmds manquantes |
| 8 | `start ticket` | ensdev start <c> <t> | pacadev work start --client <c> --issue <i> | ✅ pacadev, enrichir avec pré-chargement Mem0 |
| 9 | `commit` | ensdev commit | (absent → utiliser `git` direct) | 🔄 Porter `pacadev work commit` (validation message + Refs) |
| 10 | `done/close` | ensdev done <id> | pacadev issue update (partiel) | 🔄 Porter `pacadev work done` |
| 11 | `memory-search` | ensdev memory-search | ❌ absent | 🔄 Porter — **valeur unique** d'OpenEnsdev |
| 12 | `dashboard` | ensdev dashboard (Streamlit) | (Grafana seul) | 🔄 Porter en `pacadev dashboard` (Streamlit opérateur) |
| 13 | `orchestrate` (UI) | ensdev orchestrate | (Grafana dashboard) | 🔄 Fusionner dans `pacadev dashboard` |
| 14 | Workflow engine state machine | non-stricte (assignations libres) | FSM stricte + transitions validées | ✅ pacadev |
| 15 | Audit immuable | ❌ | ✅ JSONL hashé SHA256 | ✅ pacadev |
| 16 | RBAC | ❌ | ✅ 4 rôles | ✅ pacadev |
| 17 | Tokens d'approbation prod | manuel | ✅ HMAC-SHA256 15 min | ✅ pacadev |
| 18 | Secrets management | `.env` clair + odoo.conf hardcodé | SOPS + age | ✅ pacadev — migrer immédiatement |
| 19 | Tests automatisés | ❌ | ✅ 34/34 E2E + unit FSM | ✅ pacadev |
| 20 | Linters/formatters | pre-commit présent (non enforce) | ruff + pylint-odoo + bandit + black | ✅ pacadev — adopter `.pre-commit-config.yaml` partout |
| 21 | CI/CD | `.github/` vide | GitHub Actions complet | ✅ pacadev |
| 22 | IA dev | Aider + Mem0 + Ollama (offline) | Continue.dev + Claude (cloud) | 🔄 Complémentaires — garder Continue.dev par défaut, intégrer Mem0 comme module optionnel `pacadev memory` |
| 23 | IA Risk scoring | ❌ | Claude Haiku (auto-merge < 0.5) | ✅ pacadev |
| 24 | Modules Odoo 17 ENS | 6 modules production | ❌ aucun | 🔄 Migrer urgent (cf. §9) |
| 25 | PostgreSQL partagé | `odoo_postgres_shared` (PG 14) | ❌ absent | 🔄 Porter dans `core/infra/postgres/` |
| 26 | Reverse proxy | Traefik v2.11 + Portainer | ❌ absent | 🔄 Porter dans `core/infra/traefik/` |
| 27 | Backups | Bind mounts + dumps manuels | Ansible `backup-atomic` | ✅ pacadev |
| 28 | Rollback | Manuel | Ansible `rollback-atomic` | ✅ pacadev |
| 29 | Monitoring | Portainer GUI seul | Prometheus+Grafana+Loki+Promtail | ✅ pacadev |
| 30 | VPN/accès | ❌ | Tailscale ACL prévu | ✅ pacadev |
| 31 | Devcontainer | `.vscode/` minimal | `templates/devcontainer/` + Continue | ✅ pacadev |
| 32 | Standards code IA | `AI_CODE_RULES.md` + `AI_PROMPT_STANDARD.md` | ❌ implicites | 🔄 Porter sous `docs/AI_CODE_RULES.md` |
| 33 | Odoo Language Server | `odools.toml` | ❌ | 🔄 Porter `odools.toml` à la racine |
| 34 | Workflow Git doc | `WORKFLOW.md` + `NEW_METHODODOLOGY_README.md` | `RUNBOOK_PHASE_AB.md` + ARCHITECTURE.md | 🔄 Fusionner dans `docs/WORKFLOW.md` |
| 35 | Procédures urgence | dispersées | `RUNBOOK.md` + `RUNBOOK_PHASE_AB.md` | ✅ pacadev — enrichir des cas réels OpenEnsdev |
| 36 | Décommissionnement clients | non documenté | non documenté | 🔄 À écrire (§10) |

## 5.2 Décisions de fusion (résumé)

- ✅ **Garde pacadev** : 22 capacités (FSM, audit, RBAC, tokens, secrets, tests, CI/CD, monitoring, etc.).
- 🔄 **Importe d'OpenEnsdev** : 11 capacités (modules ENS, PG partagé, Traefik, Mem0/Aider, dashboard Streamlit, memory-search, work commit, work done, standards IA, odools.toml, scripts UFW).
- 🗑️ **Abandonne** : `cli/ensdev/ens_core-17/` (duplication), `cli/enstask-legacy/`, `cli/odooctl_old/`, `.env` clair, admin_passwd hardcodés.

---

# 6. PLAN DE FUSION — ARCHITECTURE CIBLE

## 6.1 Arborescence cible pacadev (après fusion)

```
/home/abdelali/pacadev/
├── core/
│   ├── agents/                          # IA (context-builder, risk-scorer)
│   ├── ansible/                         # roles existants
│   ├── audit/                           # logger.py, verifier.py
│   ├── ci-templates/                    # pipelines
│   ├── cli/
│   │   ├── main.py
│   │   ├── commands/
│   │   │   ├── work.py                  # ENRICHI : start+commit+done+status+memory hooks
│   │   │   ├── deploy.py                # existant
│   │   │   ├── backup.py
│   │   │   ├── rollback.py
│   │   │   ├── test.py
│   │   │   ├── secrets.py
│   │   │   ├── generate.py
│   │   │   ├── monitor.py
│   │   │   ├── issue.py
│   │   │   ├── runbook.py
│   │   │   ├── dashboard.py             # NOUVEAU (porté OpenEnsdev)
│   │   │   ├── memory.py                # NOUVEAU : memory search/load
│   │   │   └── infra.py                 # NOUVEAU : start-all, stop-all, verify-ufw
│   │   └── utils/                       # state, git, docker, secrets, decorators
│   ├── infra/                           # NOUVEAU (porté d'OpenEnsdev)
│   │   ├── postgres/
│   │   │   ├── docker-compose.yml       # PG 14 partagé
│   │   │   └── README.md
│   │   ├── traefik/
│   │   │   ├── docker-compose.yml       # Traefik v2.11
│   │   │   ├── dynamic/pacadev.yml
│   │   │   └── README.md
│   │   ├── portainer/                   # optionnel
│   │   └── scripts/
│   │       ├── start-all-clients.sh     # porté
│   │       ├── stop-all-clients.sh
│   │       ├── verify-ufw-docker.sh     # porté
│   │       ├── configure-ufw-docker.sh  # porté
│   │       └── recreate-containers.sh   # porté
│   ├── memory/                          # NOUVEAU (porté du module Mem0)
│   │   ├── mem0_local.py
│   │   ├── chroma_db/                   # vecteurs locaux
│   │   ├── loaders/
│   │   │   ├── load_clients.py
│   │   │   ├── load_rules.py
│   │   │   └── load_history.py
│   │   ├── aider_wrapper.py             # contexte avant lancement Aider (optionnel)
│   │   └── README.md
│   ├── dashboard/                       # NOUVEAU (porté Streamlit OpenEnsdev)
│   │   ├── app.py                       # 2 onglets : supervision + workflow
│   │   ├── pages/
│   │   │   ├── 1_supervision.py
│   │   │   └── 2_workflow.py
│   │   └── systemd/pacadev-dashboard.service
│   ├── monitoring/                      # Prometheus/Grafana/Loki
│   ├── scripts/                         # validate-e2e, init-rbac, setup-github-*, tailscale-auth
│   ├── secrets/                         # *.enc.yaml + .sops.yaml
│   ├── security/                        # rbac, tokens, secrets masking
│   ├── templates/                       # devcontainer
│   ├── workflow/                        # FSM 11 états (étendue, cf. §8.2)
│   └── docs/                            # déplacé : voir docs/ racine
│
├── modules/                             # NOUVEAU — modules ENS centralisés
│   ├── ens_core-14/                     # archive (legacy)
│   ├── ens_core-17/                     # ⭐ 6 modules ENS production importés
│   │   ├── custom_reports/
│   │   ├── custom_sale_invoice/
│   │   ├── ens_crm_task/
│   │   ├── ens_extra/
│   │   ├── ens_reports_print/
│   │   ├── enswork_config_center/
│   │   └── partner_statement_report/
│   ├── ens_core-19/
│   └── README.md
│
├── v14/clients/                         # clients par version
├── v17/clients/                         # afrequip, maxelec, mecafric + nouveaux importés
├── v19/clients/                         # pacadai (importé d'OpenEnsdev)
│
├── migration/                           # scripts d'import depuis legacy
│   ├── from-openensdev/                 # ⭐ rempli (cf. §10)
│   │   ├── 01_inventory.py              # liste clients + bases + secrets
│   │   ├── 02_extract_secrets.py        # extrait → SOPS
│   │   ├── 03_migrate_modules.py        # main-dev-repo → modules/
│   │   ├── 04_migrate_client.py         # par client : compose, addons, filestore
│   │   ├── 05_migrate_pg.py             # PG dumps + restore via pg_dump custom
│   │   ├── 06_validate_client.py        # smoke test post-migration
│   │   ├── 07_decommission.py           # archive + arrêt OpenEnsdev (idempotent)
│   │   └── README.md
│   ├── from-enswork/, from-pacadai/, from-pacadev-legacy/
│
├── docs/
│   ├── ARCHITECTURE.md                  # existant, enrichi
│   ├── RUNBOOK.md                       # existant, enrichi
│   ├── FUSION_OPENENSDEV_TO_PACADEV.md  # CE DOCUMENT
│   ├── WORKFLOW.md                      # NOUVEAU (fusionne WORKFLOW.md OpenEnsdev)
│   ├── AI_CODE_RULES.md                 # NOUVEAU (porté)
│   ├── AI_PROMPT_STANDARD.md            # NOUVEAU (porté)
│   ├── INFRA.md                         # NOUVEAU (postgres+traefik+monitoring)
│   ├── MEMORY.md                        # NOUVEAU (Mem0 module local)
│   ├── DASHBOARD.md                     # NOUVEAU
│   └── DECOMMISSION_OPENENSDEV.md       # NOUVEAU (procédure d'arrêt)
│
├── odoo-sources/                        # OPTIONNEL (porté pour Odoo LS) — symlink possible
├── .pacadev/                            # état runtime
├── .github/                             # workflows existants
├── .vscode/, .claude/
├── odools.toml                          # NOUVEAU (porté)
├── .pre-commit-config.yaml              # NOUVEAU (enforce)
├── CLAUDE.md                            # existant
└── RUNBOOK_PHASE_AB.md / VALIDATION_E2E_REPORT.md
```

## 6.2 Mapping de fichiers (OpenEnsdev → pacadev)

| Source OpenEnsdev | Destination pacadev | Action |
|---|---|---|
| `main-dev-repo/ens_core-17/*` | `modules/ens_core-17/` | Copie + sous-module Git ou monorepo |
| `main-dev-repo/ens_core-14/*` | `modules/ens_core-14/` | Copie (archive) |
| `main-dev-repo/ens_core-19/*` | `modules/ens_core-19/` | Copie |
| `main-dev-repo/AI_CODE_RULES.md` | `docs/AI_CODE_RULES.md` | Copie |
| `main-dev-repo/AI_PROMPT_STANDARD.md` | `docs/AI_PROMPT_STANDARD.md` | Copie |
| `main-dev-repo/WORKFLOW.md` | `docs/WORKFLOW.md` (fusion) | Fusion |
| `main-dev-repo/odools.toml` | `odools.toml` (racine pacadev) | Copie |
| `infra/postgres/docker-compose.yml` | `core/infra/postgres/docker-compose.yml` | Copie + adapter creds via SOPS |
| `infra/traefik/docker-compose.yml` | `core/infra/traefik/docker-compose.yml` | Copie |
| `infra/traefik/dynamic/openensdev.yml` | `core/infra/traefik/dynamic/pacadev.yml` | Copie + renommer host |
| `infra/portainer/*` | `core/infra/portainer/` (optionnel) | Copie |
| `infra/scripts/start-all-clients.sh` | `core/infra/scripts/start-all-clients.sh` | Copie + adapter chemins `v17/clients/` |
| `infra/scripts/verify-ufw-docker.sh` | `core/infra/scripts/verify-ufw-docker.sh` | Copie |
| `infra/scripts/configure-ufw-docker.sh` | `core/infra/scripts/configure-ufw-docker.sh` | Copie |
| `infra/scripts/recreate-containers.sh` | `core/infra/scripts/recreate-containers.sh` | Copie |
| `cli/ensdev/workflow_engine.py` | _absorbé dans_ `core/workflow/fsm.py` (mapping états cf. §8.2) | Adapter |
| `cli/ensdev/memory/mem0_local.py` | `core/memory/mem0_local.py` | Copie + adapter config |
| `cli/ensdev/memory/chroma_db/` | `core/memory/chroma_db/` (ou `~/.pacadev/memory/chroma_db/`) | Copie |
| `cli/ensdev/memory/load_*.py` | `core/memory/loaders/load_*.py` | Copie |
| `cli/ensdev/agent/aider_wrapper.py` | `core/memory/aider_wrapper.py` | Copie + adapter |
| `cli/ensdev/dashboard.py` | `core/dashboard/app.py` | Refonte multipage |
| `cli/ensdev/cli.py` (commandes `commit`, `done`, `memory-search`) | `core/cli/commands/work.py` + `core/cli/commands/memory.py` | Réimplémenter dans Typer pacadev |
| `clients/14.0/local/<C>/` | `v14/clients/<C>/` | Migration via `migration/from-openensdev/04_migrate_client.py` |
| `clients/17.0/local/<C>/` | `v17/clients/<C>/` | Idem |
| `clients/19.0/local/pacadai/` | `v19/clients/pacadai/` | Idem |
| `.env` (root) | `core/secrets/openensdev.enc.yaml` (chiffré SOPS) | Migration via `02_extract_secrets.py` |
| `clients/*/config/odoo.conf` (admin_passwd) | `core/secrets/<client>.enc.yaml` + injection via env | Migration |
| `~/.ensdev/workflow/ticket_*.json` | _Archive_ `~/.pacadev/state/legacy/ensdev_workflow_<id>.json` | Backup uniquement |
| `~/.ensdev/history.log` | _Archive_ `~/.pacadev/logs/ensdev_history.log` | Backup uniquement |
| `scripts/setup-orchestration.sh` | `core/scripts/setup-dashboard.sh` (adapté) | Adapter |
| `odoo-sources/odoo-17/` | `odoo-sources/odoo-17/` (symlink ou copie) | Optionnel |

## 6.3 Stratégie de coexistence pendant la transition

Pendant la migration (estimée 2–4 semaines selon vélocité), **les deux orchestrateurs restent vivants** mais avec un partage clair :

| Composant | OpenEnsdev | pacadev | Règle |
|---|---|---|---|
| PostgreSQL `odoo_postgres_shared` | ✅ Source de vérité | ❌ | pacadev se branche dessus en read pour les clients non migrés |
| Traefik `traefik` | ✅ Source de vérité | ❌ | Idem |
| Modules ENS Odoo 17 | ✅ `main-dev-repo/ens_core-17/` | 🔄 sync via Git remote | Pendant transition : pacadev `modules/ens_core-17/` est un clone Git du repo `a-bahou/ensdev` (branche main) |
| CLI ensdev | ✅ utilisable | ⚠️ | Préférer `pacadev` dès qu'une commande existe |
| Workflow state | `~/.ensdev/workflow/` | `~/.pacadev/state/` | Un ticket par orchestrateur, pas de bridge |
| Mem0 ChromaDB | `cli/ensdev/memory/chroma_db/` | `core/memory/chroma_db/` (copie initiale) | Sync manuel ou bridge lecture seule |

**Marqueur de transition** : à la fin de chaque migration de client, mettre à jour `.pacadev/state/versions.json` avec `migrated_from: openensdev` + `migration_date`.

---

# 7. ROADMAP D'EXÉCUTION (8 PHASES)

Chaque phase est **indépendamment validable** (peut être arrêtée et reprise). Chaque phase produit un audit log immuable (action `migration_phase_X_completed`).

## Phase 1 — Préparation & inventaire (1–2 jours)

**But :** Cartographier l'existant OpenEnsdev avec précision et préparer pacadev.

**Tâches :**
1. Lancer `migration/from-openensdev/01_inventory.py` qui produit un YAML :
   ```yaml
   clients:
     - name: specta
       version: "14.0"
       location: "clients/14.0/local/specta"
       docker_status: running
       db_name: specta_prod
       db_size_mb: ...
       filestore_size_mb: ...
       last_backup: ...
       custom_modules: [...]
       secrets:
         admin_passwd: "<REDACTED>"
         db_password: "<REDACTED>"
   ```
2. Faire l'inventaire des modules ENS dans `main-dev-repo/ens_core-17/` (versions, dépendances).
3. Sauvegarder TOUTES les bases PostgreSQL d'OpenEnsdev :
   ```bash
   docker exec odoo_postgres_shared pg_dumpall -U odoo > /home/abdelali/openensdev_full_backup_$(date +%F).sql
   ```
4. Sauvegarder les filestores : `tar -czf filestores_backup_$(date +%F).tar.gz clients/*/local/*/filestore/`.
5. Snapshotter `~/.ensdev/` et `cli/ensdev/memory/chroma_db/`.

**Critères de sortie :**
- [ ] Inventaire YAML produit et validé manuellement.
- [ ] Backup full PostgreSQL > 0 bytes, restorable test passé.
- [ ] Backups filestores > 0 bytes.
- [ ] Audit log Phase 1 écrit.

## Phase 2 — Import des modules ENS (1 jour)

**But :** Centraliser les 6 modules ENS Odoo 17 (+ 14, 19) dans `pacadev/modules/`.

**Tâches :**
1. Créer `/home/abdelali/pacadev/modules/ens_core-{14,17,19}/`.
2. Copier ou git-add le contenu de `main-dev-repo/ens_core-17/*` vers `pacadev/modules/ens_core-17/`.
3. Décider stratégie :
   - **Option A** : monorepo (copie directe, commit dans `pacadev`).
   - **Option B** : submodule Git pointant vers `a-bahou/ensdev`.
   - **Recommandé** : Option A (simplicité + cohérence audit).
4. Adapter les `__manifest__.py` si nécessaire (vérifier dépendances absolues).
5. Créer `modules/README.md` documentant chaque module (description, version, dépendances).
6. Lancer test : `cd pacadev && pytest modules/ens_core-17/<m>/tests/` si tests Odoo existent.

**Critères de sortie :**
- [ ] 6 modules présents et lisibles dans `pacadev/modules/ens_core-17/`.
- [ ] Manifests cohérents avec convention `17.0.X.Y.Z`.
- [ ] Commit Git `feat(modules): import ENS Odoo 17 from OpenEnsdev`.

## Phase 3 — Import infrastructure partagée (1 jour)

**But :** Rendre pacadev capable de faire tourner ses propres clients Docker via PG partagé + Traefik.

**Tâches :**
1. Créer `core/infra/postgres/docker-compose.yml` (copie d'OpenEnsdev, network `pacadev-network`).
2. Créer `core/infra/traefik/docker-compose.yml` (copie, host `pacadev.local`).
3. Créer `core/infra/scripts/start-infra.sh` :
   ```bash
   #!/bin/bash
   docker network create pacadev-network 2>/dev/null || true
   docker compose -f core/infra/postgres/docker-compose.yml up -d
   docker compose -f core/infra/traefik/docker-compose.yml up -d
   ```
4. Porter `start-all-clients.sh`, `verify-ufw-docker.sh`, `configure-ufw-docker.sh`, `recreate-containers.sh` sous `core/infra/scripts/` en remplaçant `clients/<X.0>/local/` par `v<X>/clients/`.
5. Adapter `pacadev` CLI : ajouter `core/cli/commands/infra.py` avec sous-commandes `start`, `stop`, `verify`, `recreate`.
6. Test : démarrer infra, vérifier `docker ps` montre `pacadev_postgres_shared` + `pacadev_traefik`, vérifier `http://pacadev.local` accessible.

**Critères de sortie :**
- [ ] `pacadev infra start` démarre PG + Traefik.
- [ ] `pacadev infra verify` confirme état sain.
- [ ] `core/infra/README.md` documente architecture.

## Phase 4 — Migration des secrets vers SOPS (0.5 jour)

**But :** Éradiquer tous les secrets en clair.

**Tâches :**
1. Lancer `migration/from-openensdev/02_extract_secrets.py` qui :
   - Lit `OpenEnsdev/.env` (clés API).
   - Lit chaque `clients/*/config/odoo.conf` (admin_passwd, db_password).
   - Produit `core/secrets/<client>.enc.yaml` chiffré avec la clé age existante de pacadev.
2. Pour chaque client à migrer, adapter `docker-compose.yml` pour lire `admin_passwd` depuis env (`ODOO_ADMIN_PASSWD`) injecté au démarrage via SOPS.
3. Modifier `odoo.conf` : remplacer `admin_passwd = ...` par `admin_passwd = $ODOO_ADMIN_PASSWD` (Odoo supporte la substitution d'env vars).
4. Supprimer `OpenEnsdev/.env` après vérification (archive d'abord).
5. Lancer `pacadev secrets show <client>` pour vérifier décryptage.

**Critères de sortie :**
- [ ] Aucun secret en clair dans `pacadev/` (validation `grep -r 'admin_passwd =' pacadev/`).
- [ ] `pacadev secrets show` fonctionne pour chaque client.
- [ ] Audit log : `migration_phase_4_secrets_migrated`.

## Phase 5 — Migration progressive des clients (1–2 jours par client)

**But :** Migrer un client à la fois, le valider, puis passer au suivant.

**Ordre recommandé** (du plus simple au plus complexe) :
1. Client v19 unique : `pacadai`.
2. Clients v17 déjà initialisés dans pacadev : `afrequip`, `maxelec`, `mecafric` (reprendre la config OpenEnsdev pour les bases existantes).
3. Clients v17 actifs : `enswork`, `aquaplanet`.
4. Clients v14 actif : `specta`.
5. Clients v14 arrêtés : décision archive vs réactivation (probable archive de la plupart).

**Procédure par client (idempotente) :**

```bash
# 1. État initial
pacadev audit log "migration_start --client <C>"

# 2. Backup OpenEnsdev complet (DB + filestore)
docker exec odoo_postgres_shared pg_dump -U odoo <db_name> > /tmp/<C>_db.sql
tar -czf /tmp/<C>_filestore.tar.gz -C /home/abdelali/OpenEnsdev/clients/<X.0>/local/<C>/filestore .

# 3. Création target pacadev
python migration/from-openensdev/04_migrate_client.py --client <C> --version <X> \
    --source /home/abdelali/OpenEnsdev/clients/<X.0>/local/<C> \
    --target /home/abdelali/pacadev/v<X>/clients/<C>

# Ce script :
#  - Copie docker-compose.yml et l'adapte (image, network=pacadev-network, labels Traefik adaptés)
#  - Copie addons/ en bindant vers pacadev/modules/ens_core-<X>/ au lieu de main-dev-repo
#  - Copie filestore/ (ou symlink si gros)
#  - Génère core/secrets/<C>.enc.yaml depuis odoo.conf
#  - Génère .pacadev/clients/<C>/config.json
#  - Met à jour .pacadev/state/versions.json (status=migrating, migrated_from=openensdev)

# 4. Restore DB sur PG pacadev
python migration/from-openensdev/05_migrate_pg.py --client <C> --source-dump /tmp/<C>_db.sql

# 5. Démarrage client sur pacadev
pacadev work start --client <C> --issue 0 --no-branch  # mode init
docker compose -f pacadev/v<X>/clients/<C>/docker-compose.yml up -d

# 6. Validation
python migration/from-openensdev/06_validate_client.py --client <C>
# Vérifie : healthcheck Odoo, login admin, modules ENS chargés, données présentes

# 7. Si OK, marquer migré
pacadev audit log "migration_complete --client <C>"
# Met à jour versions.json : status=migrated

# 8. Décommission OpenEnsdev (NE PAS faire avant validation production)
# python migration/from-openensdev/07_decommission.py --client <C> --dry-run
```

**Critères de sortie (par client) :**
- [ ] Client accessible via `http://<C>.pacadev.local`.
- [ ] Tous les modules ENS chargés sans erreur.
- [ ] Login admin OK avec admin_passwd lu depuis SOPS.
- [ ] Au moins une transaction Odoo (création produit, devis…) testée.
- [ ] Backup automatique fonctionnel (`pacadev backup create --client <C>`).
- [ ] Rollback testé sur DB synthétique (`pacadev rollback --auto --client <C>`).

## Phase 6 — Import IA & dashboard (1–2 jours)

**But :** Porter Mem0 + dashboard Streamlit comme modules optionnels.

**Tâches :**
1. Créer `core/memory/` :
   - Copier `mem0_local.py`, loaders.
   - Adapter chemins ChromaDB → `~/.pacadev/memory/chroma_db/`.
   - Adapter config Ollama (lire endpoint depuis `core/secrets/openensdev.enc.yaml` ou env).
2. Créer `core/cli/commands/memory.py` :
   - `pacadev memory search <query> [--client <C>]`
   - `pacadev memory load-rules` (recharge règles Odoo)
   - `pacadev memory load-clients` (recharge règles clients)
   - `pacadev memory load-history` (recharge fixes)
   - `pacadev memory stats` (collections, métriques)
3. Hook `pacadev work start` : si Mem0 disponible, pré-charge contexte automatiquement et propose une option `--with-aider` pour lancer Aider avec contexte.
4. Créer `core/dashboard/` :
   - Streamlit multipage (`app.py` + `pages/1_supervision.py` + `pages/2_workflow.py`).
   - Onglet supervision : `docker ps`, GitHub issues, état clients, recherche Mem0, derniers audit log.
   - Onglet workflow : sélection ticket → état FSM → boutons transitions (alimentés par `pacadev work` programmable).
5. Créer `core/dashboard/systemd/pacadev-dashboard.service` (user service) :
   ```ini
   [Unit]
   Description=PACADEV operator dashboard (Streamlit)
   [Service]
   ExecStart=/home/abdelali/pacadev/.venv/bin/streamlit run /home/abdelali/pacadev/core/dashboard/app.py --server.port 8501
   Restart=on-failure
   [Install]
   WantedBy=default.target
   ```
6. Ajouter route Traefik dynamique `core/infra/traefik/dynamic/pacadev.yml` :
   ```yaml
   http:
     routers:
       dashboard:
         rule: "Host(`dashboard.pacadev.local`)"
         service: dashboard-svc
     services:
       dashboard-svc:
         loadBalancer:
           servers:
             - url: "http://host.docker.internal:8501"
   ```
7. Documenter dans `docs/DASHBOARD.md` et `docs/MEMORY.md`.

**Critères de sortie :**
- [ ] `pacadev memory search "facture maxelec"` retourne des résultats.
- [ ] `pacadev dashboard` ouvre le navigateur (ou affiche URL).
- [ ] `http://dashboard.pacadev.local` accessible via Traefik.
- [ ] Audit log : `dashboard_started`.

## Phase 7 — Workflow & FSM extension (1 jour)

**But :** Étendre la FSM pacadev pour absorber les sémantiques d'OpenEnsdev (notamment SELF_REVIEW et TEST_MANUEL).

**Tâches :**
1. Ajouter à `core/workflow/fsm.py` :
   - États supplémentaires : `SELF_REVIEW`, `TEST_MANUAL` (entre DEV et CI_RUNNING).
   - Transitions :
     - `DEV → SELF_REVIEW` (auto après `pacadev work review --start`)
     - `SELF_REVIEW → DEV` (corrections)
     - `SELF_REVIEW → TEST_MANUAL` (review OK)
     - `TEST_MANUAL → DEV` (test échec)
     - `TEST_MANUAL → CI_RUNNING` (push trigger)
2. Mettre à jour `test_fsm.py` pour valider les nouvelles transitions.
3. Ajouter à `work.py` les sous-commandes :
   - `pacadev work review --start` / `--done`
   - `pacadev work test-manual --start` / `--passed` / `--failed --reason "..."`
   - `pacadev work commit -m "..." [--module <m>] [--type feat|fix|refactor|docs|test]` (avec validation format `[module] type: desc` et auto-ajout `Refs: #<issue>`).
   - `pacadev work done` (ferme issue GitHub via API, transition vers CLOSED).
4. Documenter mapping états OpenEnsdev → pacadev (cf. §8.2).

**Critères de sortie :**
- [ ] `pacadev work` couvre les 13 états (FSM 11 + 2 ajouts).
- [ ] `pytest core/workflow/test_fsm.py` : 100 % passing.
- [ ] `validate-e2e.py` toujours 100 % (34/34 → 36/36 si ajout de cas).

## Phase 8 — Décommissionnement OpenEnsdev (1 jour, après validation totale)

**But :** Arrêt propre de l'ancien orchestrateur, archivage des données.

**Pré-requis :**
- TOUS les clients migrés et validés (audit log montre `migration_complete` pour chaque).
- Au minimum 7 jours de fonctionnement sans incident sur pacadev.
- Décision explicite via `pacadev approve --generate --action decommission_openensdev --reason "Migration complète validée"`.

**Tâches :**
1. Arrêter les conteneurs OpenEnsdev :
   ```bash
   cd /home/abdelali/OpenEnsdev
   docker compose -f infra/postgres/docker-compose.yml down
   docker compose -f infra/traefik/docker-compose.yml down
   docker compose -f infra/portainer/docker-compose.yml down
   for c in clients/*/local/*/; do
     [ -f "$c/docker-compose.yml" ] && docker compose -f "$c/docker-compose.yml" down
   done
   ```
2. Désactiver systemd `ensdev-dashboard` :
   ```bash
   systemctl --user stop ensdev-dashboard
   systemctl --user disable ensdev-dashboard
   ```
3. Archiver le dépôt OpenEnsdev :
   ```bash
   tar -czf /home/abdelali/archives/OpenEnsdev_$(date +%F).tar.gz /home/abdelali/OpenEnsdev
   ```
4. Garder OpenEnsdev sur disque en read-only pendant 30 jours minimum :
   ```bash
   chmod -R a-w /home/abdelali/OpenEnsdev
   ```
5. Audit log : `decommission_openensdev_complete`.
6. Mettre à jour `docs/DECOMMISSION_OPENENSDEV.md` avec date effective.
7. Optionnel : retirer venvs (`venv-odoo-dev`, `venv-mem0`) après confirmation que rien n'en dépend.

**Critères de sortie :**
- [ ] `docker ps` ne montre plus aucun conteneur OpenEnsdev.
- [ ] `systemctl --user status ensdev-dashboard` : inactive.
- [ ] Tar archive > 5 GB (full backup).
- [ ] `docs/DECOMMISSION_OPENENSDEV.md` à jour.

---

# 8. DÉTAILS TECHNIQUES PAR COMPOSANT À PORTER

## 8.1 Scripts shell d'infrastructure

### 8.1.1 `start-all-clients.sh` (porté)

**Source :** `OpenEnsdev/infra/scripts/start-all-clients.sh` (169 lignes)
**Destination :** `pacadev/core/infra/scripts/start-all-clients.sh`

**Adaptations nécessaires :**
- Remplacer `OpenEnsdev/clients/<X.0>/local/` par `pacadev/v<X>/clients/`.
- Remplacer `odoo-network` par `pacadev-network`.
- Logguer dans `~/.pacadev/logs/start-all-clients_<timestamp>.log` au lieu de `/tmp/`.
- Hook audit : appeler `python -c "from core.audit.logger import AuditLogger; AuditLogger().log('infra_start_all', ...)"` au début et à la fin.

**Squelette adapté :**
```bash
#!/bin/bash
set -euo pipefail

PACADEV_ROOT="${PACADEV_ROOT:-/home/abdelali/pacadev}"
LOG_DIR="${HOME}/.pacadev/logs"
LOG_FILE="${LOG_DIR}/start-all-clients_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

# Audit start
python3 "$PACADEV_ROOT/core/audit/logger.py" --action infra_start_all_started

for version in v14 v17 v19; do
  clients_dir="$PACADEV_ROOT/$version/clients"
  [ -d "$clients_dir" ] || continue
  for client in "$clients_dir"/*/; do
    cname=$(basename "$client")
    compose="$client/docker-compose.yml"
    [ -f "$compose" ] || { echo "SKIP $cname (no compose)"; continue; }
    echo "STARTING $cname ($version)..."
    docker compose -f "$compose" up -d
    sleep 3
    if ! docker ps --filter "name=${cname}" --filter "status=running" | grep -q "$cname"; then
      echo "FAILED $cname — see logs"
      continue
    fi
    echo "OK $cname"
  done
done

python3 "$PACADEV_ROOT/core/audit/logger.py" --action infra_start_all_completed
```

### 8.1.2 `verify-ufw-docker.sh` (porté tel quel)

**Source :** `OpenEnsdev/infra/scripts/verify-ufw-docker.sh` (273 lignes)
**Destination :** `pacadev/core/infra/scripts/verify-ufw-docker.sh`
**Adaptations :** aucune (script de diagnostic indépendant), juste copier.

### 8.1.3 `configure-ufw-docker.sh`

Idem, à porter tel quel.

### 8.1.4 `recreate-containers.sh`

Idem, adapter les chemins.

## 8.2 Mapping FSM : 10 états OpenEnsdev ↔ 11 états pacadev

| OpenEnsdev | pacadev (cible) | Action de migration |
|---|---|---|
| `TICKET_CREATION` | _(implicite avant INIT)_ | Création GitHub issue |
| `TICKET_OPENED` | `INIT` | `pacadev work start` |
| `DEV_IN_PROGRESS` | `DEV` | — |
| `SELF_REVIEW` | `SELF_REVIEW` (NOUVEAU dans pacadev) | `pacadev work review --start` |
| `TEST_AUTO` | _(absorbé dans `CI_RUNNING`)_ | CI Actions trigger |
| `TEST_MANUEL` | `TEST_MANUAL` (NOUVEAU dans pacadev) | `pacadev work test-manual --start` |
| `READY_FOR_COMMIT` | `DEV` (sous-état "ready") | `pacadev work commit -m "..."` |
| `COMMITTED` | `CI_RUNNING` (auto-déclenché par push) | git push |
| _(implicite)_ | `CI_PASSED` | CI succès |
| _(implicite)_ | `MERGED` | Auto-merge IA risk < 0.5 ou approbation lead |
| _(implicite)_ | `STAGING_DEPLOYED` | `pacadev deploy --env staging` |
| _(implicite)_ | `STAGING_VALIDATED` | Smoke tests staging |
| _(implicite)_ | `PROD_APPROVED` | Token HMAC généré par lead |
| `DEPLOYED` | `PROD_DEPLOYED` | `pacadev deploy --env prod --approve-token ...` |
| `CLOSED` | `CLOSED` | `pacadev work done` (ferme issue) |
| _(implicite)_ | `ERROR` | Toute erreur déclenche transition + rollback proposé |

**FSM finale (13 états) :**

```
INIT → DEV → SELF_REVIEW → TEST_MANUAL → CI_RUNNING → CI_PASSED → MERGED
       ↑          │              │           │
       ├──────────┘              │           │
       │                          │           │
       │←─────────────────────────┘           │
       │                                       │
       │←──────────────────────────────────────┘ (check_failed)
       │
       └→ ERROR (depuis tout état) → DEV (rollback)

MERGED → STAGING_DEPLOYED → STAGING_VALIDATED → PROD_APPROVED → PROD_DEPLOYED → CLOSED
```

**Persistance :** chaque transition appelle `audit/logger.py` qui écrit dans `~/.pacadev/audit-log.jsonl` avec hash chaîné.

## 8.3 Commandes CLI à ajouter dans pacadev

### 8.3.1 `pacadev work commit`

**Fichier :** `core/cli/commands/work.py` (ajouter sous-commande)

```python
@work_app.command("commit")
def commit_cmd(
    message: str = typer.Option(..., "-m", help="Commit message body"),
    module: str = typer.Option(None, "--module", help="Module concerné (ex: ens_crm_task)"),
    type_: str = typer.Option("feat", "--type", help="feat|fix|refactor|docs|test"),
    client: str = typer.Option(None, "--client"),
):
    """Commit avec format [module] type: desc + Refs: #issue."""
    state = load_current_work_state(client=client)
    if not state:
        typer.echo("Aucun travail en cours. Lance 'pacadev work start' d'abord.")
        raise typer.Exit(1)
    issue = state["issue"]
    module_resolved = module or state.get("module") or "general"
    formatted = f"[{module_resolved}] {type_}: {message}\n\nRefs: #{issue}"
    # Exécuter git commit
    subprocess.run(["git", "commit", "-am", formatted], check=True)
    AuditLogger().log(
        action="work_commit",
        client=client,
        user=current_user(),
        message=formatted,
        module=module_resolved,
    )
    # Transition FSM (rester en DEV jusqu'au push)
```

### 8.3.2 `pacadev work done`

```python
@work_app.command("done")
def done_cmd(
    client: str = typer.Option(..., "--client"),
):
    """Ferme l'issue GitHub et transitionne vers CLOSED."""
    state = load_current_work_state(client=client)
    if state["state"] != "PROD_DEPLOYED":
        typer.echo(f"Impossible de clôturer depuis l'état {state['state']}.")
        raise typer.Exit(1)
    issue = state["issue"]
    # Fermer issue via gh CLI
    subprocess.run(["gh", "issue", "close", str(issue), "--repo", state["repo"]], check=True)
    fsm = WorkflowFSM.load(client=client, issue=issue)
    fsm.transition("close")  # PROD_DEPLOYED → CLOSED
    AuditLogger().log(
        action="work_done",
        client=client,
        issue=issue,
        user=current_user(),
    )
```

### 8.3.3 `pacadev memory`

**Fichier :** `core/cli/commands/memory.py` (nouveau)

```python
import typer
from pathlib import Path
from core.memory.mem0_local import get_memory_client

memory_app = typer.Typer(help="Mémoire contextuelle locale (Mem0+ChromaDB+Ollama).")

@memory_app.command("search")
def search_cmd(
    query: str,
    client: str = typer.Option(None, "--client"),
    limit: int = typer.Option(5, "--limit"),
):
    mem = get_memory_client()
    user_id = client or "default"
    results = mem.search(query, user_id=user_id, limit=limit)
    for r in results:
        typer.echo(f"--- score={r.get('score', 0):.2f} ---")
        typer.echo(r["text"])

@memory_app.command("load-rules")
def load_rules_cmd():
    from core.memory.loaders.load_rules import load_all_rules
    load_all_rules()

@memory_app.command("load-clients")
def load_clients_cmd():
    from core.memory.loaders.load_clients import load_all_clients
    load_all_clients()

@memory_app.command("load-history")
def load_history_cmd():
    from core.memory.loaders.load_history import load_all_history
    load_all_history()

@memory_app.command("stats")
def stats_cmd():
    mem = get_memory_client()
    typer.echo(mem.stats())
```

### 8.3.4 `pacadev dashboard`

**Fichier :** `core/cli/commands/dashboard.py`

```python
import typer, subprocess, os
from pathlib import Path

dashboard_app = typer.Typer(help="Dashboard Streamlit opérateur.")

@dashboard_app.command("start")
def start_cmd(port: int = 8501):
    app_path = Path(__file__).parent.parent.parent / "dashboard" / "app.py"
    subprocess.Popen([
        "streamlit", "run", str(app_path),
        "--server.port", str(port),
        "--server.address", "0.0.0.0",
    ])
    typer.echo(f"Dashboard lancé sur http://localhost:{port}")

@dashboard_app.command("stop")
def stop_cmd():
    subprocess.run(["pkill", "-f", "streamlit run"])

@dashboard_app.command("status")
def status_cmd():
    r = subprocess.run(["pgrep", "-f", "streamlit run"], capture_output=True, text=True)
    typer.echo("running" if r.returncode == 0 else "stopped")
```

### 8.3.5 `pacadev infra`

**Fichier :** `core/cli/commands/infra.py`

```python
import typer, subprocess
from pathlib import Path

infra_app = typer.Typer(help="Orchestration infrastructure partagée.")

INFRA_ROOT = Path(__file__).parent.parent.parent / "infra"

@infra_app.command("start")
def start_cmd():
    subprocess.run([
        "docker", "compose",
        "-f", str(INFRA_ROOT / "postgres" / "docker-compose.yml"),
        "up", "-d"
    ], check=True)
    subprocess.run([
        "docker", "compose",
        "-f", str(INFRA_ROOT / "traefik" / "docker-compose.yml"),
        "up", "-d"
    ], check=True)
    typer.echo("Infra démarrée (postgres + traefik).")

@infra_app.command("stop")
def stop_cmd():
    for svc in ["traefik", "postgres"]:
        subprocess.run([
            "docker", "compose",
            "-f", str(INFRA_ROOT / svc / "docker-compose.yml"),
            "down"
        ], check=False)

@infra_app.command("verify")
def verify_cmd():
    script = INFRA_ROOT / "scripts" / "verify-ufw-docker.sh"
    subprocess.run(["bash", str(script)])

@infra_app.command("start-all-clients")
def start_all_cmd():
    script = INFRA_ROOT / "scripts" / "start-all-clients.sh"
    subprocess.run(["bash", str(script)])
```

## 8.4 Module Mem0 — config adaptée

**Fichier :** `core/memory/mem0_local.py` (adapté d'OpenEnsdev)

```python
from mem0 import Memory
from pathlib import Path
import os

PACADEV_MEMORY_DIR = Path(os.environ.get("PACADEV_MEMORY_DIR", Path.home() / ".pacadev" / "memory"))
PACADEV_MEMORY_DIR.mkdir(parents=True, exist_ok=True)

CONFIG = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "pacadev_context",
            "path": str(PACADEV_MEMORY_DIR / "chroma_db"),
        },
    },
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "llama3.1:8b-instruct-q6_K",
            "ollama_base_url": os.environ.get("OLLAMA_API_BASE", "http://127.0.0.1:11434"),
            "temperature": 0.2,
        },
    },
    "embedder": {
        "provider": "ollama",
        "config": {
            "model": "nomic-embed-text",
            "ollama_base_url": os.environ.get("OLLAMA_API_BASE", "http://127.0.0.1:11434"),
        },
    },
    "history_db_path": str(PACADEV_MEMORY_DIR / "history.db"),
}

_memory_instance = None

def get_memory_client():
    global _memory_instance
    if _memory_instance is None:
        _memory_instance = Memory.from_config(CONFIG)
    return _memory_instance
```

## 8.5 Dashboard Streamlit — squelette

**Fichier :** `core/dashboard/app.py`

```python
import streamlit as st

st.set_page_config(
    page_title="PACADEV Operator",
    page_icon="⚙️",
    layout="wide",
)

st.title("PACADEV — Operator Dashboard")
st.markdown("Sélectionne une page dans la sidebar.")

with st.sidebar:
    st.header("Pages")
    st.markdown("- 📊 Supervision")
    st.markdown("- 🔄 Workflow")
    st.markdown("- 📜 Audit log")
    st.markdown("- 🧠 Memory search")
```

**Fichier :** `core/dashboard/pages/1_Supervision.py`

```python
import streamlit as st
import subprocess, json
from pathlib import Path

st.title("📊 Supervision")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Conteneurs Docker")
    r = subprocess.run(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"],
                       capture_output=True, text=True)
    if r.returncode == 0:
        for line in r.stdout.strip().split("\n"):
            st.text(line)

with col2:
    st.subheader("Clients pacadev")
    state_file = Path.home() / ".pacadev" / "state" / "versions.json"
    if state_file.exists():
        data = json.loads(state_file.read_text())
        for client, info in data.get("clients", {}).items():
            st.markdown(f"**{client}** — {info.get('status', '?')} — v{info.get('odoo_version', '?')}")

st.subheader("Derniers audit logs")
audit_file = Path.home() / ".pacadev" / "audit-log.jsonl"
if audit_file.exists():
    lines = audit_file.read_text().strip().split("\n")
    for line in lines[-20:][::-1]:
        try:
            entry = json.loads(line)
            st.markdown(f"`{entry['timestamp']}` **{entry['action']}** — {entry.get('client', '-')} — {entry.get('user', '-')}")
        except Exception:
            pass
```

**Fichier :** `core/dashboard/pages/2_Workflow.py`

```python
import streamlit as st
import json
from pathlib import Path

st.title("🔄 Workflow")

state_file = Path.home() / ".pacadev" / "state" / "versions.json"
if not state_file.exists():
    st.error("État pacadev introuvable.")
    st.stop()

data = json.loads(state_file.read_text())
clients = list(data.get("clients", {}).keys())
client = st.selectbox("Client", clients)

if not client:
    st.stop()

info = data["clients"][client]
st.markdown(f"**État :** `{info.get('state', 'INIT')}`")
st.markdown(f"**Issue :** #{info.get('issue', '-')}")
st.markdown(f"**Branche :** `{info.get('branch', '-')}`")

st.subheader("Transitions disponibles")
state = info.get("state", "INIT")

# Mapping état → boutons (à câbler avec pacadev work CLI)
TRANSITIONS = {
    "INIT": [("Démarrer dev", "work_start")],
    "DEV": [("Self-review", "review_start"), ("Tester manuel", "test_manual_start")],
    "SELF_REVIEW": [("Review OK", "review_done"), ("Retour DEV", "review_back")],
    "TEST_MANUAL": [("Test OK", "test_passed"), ("Test KO", "test_failed")],
    "CI_RUNNING": [],  # auto
    "CI_PASSED": [("Merger", "merge")],
    "MERGED": [("Deploy staging", "deploy_staging")],
    "STAGING_DEPLOYED": [("Valider staging", "staging_validate")],
    "STAGING_VALIDATED": [("Approuver prod", "approve_prod")],
    "PROD_APPROVED": [("Deploy prod", "deploy_prod")],
    "PROD_DEPLOYED": [("Clôturer", "done")],
    "CLOSED": [],
    "ERROR": [("Rollback", "rollback")],
}
for label, action in TRANSITIONS.get(state, []):
    if st.button(label):
        st.info(f"Lance `pacadev work {action} --client {client}` (à câbler).")
```

## 8.6 Migration secrets — script détaillé

**Fichier :** `migration/from-openensdev/02_extract_secrets.py`

```python
#!/usr/bin/env python3
"""Extrait les secrets en clair d'OpenEnsdev et les chiffre dans pacadev/core/secrets/."""

import os, re, subprocess, yaml
from pathlib import Path

OPENENSDEV = Path("/home/abdelali/OpenEnsdev")
PACADEV = Path("/home/abdelali/pacadev")
SECRETS_DIR = PACADEV / "core" / "secrets"

def parse_odoo_conf(path: Path) -> dict:
    result = {}
    for line in path.read_text().splitlines():
        m = re.match(r"^\s*(admin_passwd|db_password|db_host|db_user|db_name)\s*=\s*(.+)$", line)
        if m:
            result[m.group(1)] = m.group(2).strip()
    return result

def extract_env() -> dict:
    env_file = OPENENSDEV / ".env"
    if not env_file.exists():
        return {}
    return {
        k.strip(): v.strip().strip('"').strip("'")
        for line in env_file.read_text().splitlines()
        if "=" in line and not line.startswith("#")
        for k, v in [line.split("=", 1)]
    }

def encrypt_yaml(path: Path):
    subprocess.run(["sops", "-e", "-i", str(path)], check=True)

def main():
    SECRETS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Secrets globaux (API keys)
    global_secrets = extract_env()
    if global_secrets:
        out = SECRETS_DIR / "openensdev_global.yaml"
        out.write_text(yaml.safe_dump(global_secrets, sort_keys=True))
        encrypt_yaml(out)
        out.rename(SECRETS_DIR / "openensdev_global.enc.yaml")
        print(f"OK: {out.name}")

    # 2. Secrets par client (odoo.conf)
    for client_dir in OPENENSDEV.glob("clients/*/local/*/"):
        conf = client_dir / "config" / "odoo.conf"
        if not conf.exists():
            continue
        client_name = client_dir.name
        secrets = parse_odoo_conf(conf)
        if not secrets:
            continue
        out = SECRETS_DIR / f"{client_name}.yaml"
        out.write_text(yaml.safe_dump(secrets, sort_keys=True))
        encrypt_yaml(out)
        out.rename(SECRETS_DIR / f"{client_name}.enc.yaml")
        print(f"OK: {out.name}")

    print("\n→ Vérification décryptage : sops -d pacadev/core/secrets/<file>.enc.yaml")

if __name__ == "__main__":
    main()
```

## 8.7 Adaptation `docker-compose.yml` client (modèle)

**Avant (OpenEnsdev) :**
```yaml
services:
  maxelec_odoo:
    image: odoo:17.0
    volumes:
      - ./config:/etc/odoo
      - ./addons/ens_core:/mnt/extra-addons/ens_core
    environment:
      HOST: odoo_postgres_shared
    networks:
      - odoo-network
```

**Après (pacadev) :**
```yaml
services:
  maxelec_odoo:
    image: odoo:17.0
    container_name: maxelec_odoo_1
    volumes:
      - ./config:/etc/odoo
      - /home/abdelali/pacadev/modules/ens_core-17:/mnt/extra-addons/ens_core:ro
      - ./addons/oca:/mnt/extra-addons/oca:ro
      - ./filestore:/var/lib/odoo/filestore
    environment:
      HOST: pacadev_postgres_shared
      DB_NAME: maxelec_prod
      ODOO_ADMIN_PASSWD: ${ODOO_ADMIN_PASSWD}  # injecté via SOPS au démarrage
    networks:
      - pacadev-network
    labels:
      - traefik.enable=true
      - traefik.http.routers.maxelec.rule=Host(`maxelec.pacadev.local`)
      - traefik.http.services.maxelec.loadbalancer.server.port=8069
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8069/web/health"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  pacadev-network:
    external: true
```

**Wrapper de démarrage** (pour injecter SOPS) :
```bash
#!/bin/bash
# pacadev/core/infra/scripts/start-client.sh
client=$1
version=$2
client_dir="/home/abdelali/pacadev/v${version}/clients/${client}"
secrets_file="/home/abdelali/pacadev/core/secrets/${client}.enc.yaml"

eval $(sops -d "$secrets_file" | yq -r 'to_entries[] | "export ODOO_\(.key | ascii_upcase)=\"\(.value)\""')
docker compose -f "$client_dir/docker-compose.yml" up -d
```

## 8.8 Standards code IA portés

**Fichier :** `docs/AI_CODE_RULES.md` (copié depuis `OpenEnsdev/main-dev-repo/AI_CODE_RULES.md`)

Contenu type :
- Naming : `snake_case` (Python), `kebab-case` (XML IDs).
- Manifest : `__manifest__.py` format strict.
- Security : `ir.model.access.csv` + `security.xml` toujours.
- Views : XPath précis, pas d'inheritance lourd.
- Models : computed fields avec `@api.depends`, constraints via `@api.constrains`.
- Pas de `print()`, pas de `pdb.set_trace()`.
- Migration scripts : `migrations/<version>/post-migrate.py`.

À fusionner avec `core/templates/devcontainer/.aiignore` pour cohérence.

---

# 9. STRATÉGIE DE MIGRATION DES MODULES ODOO

## 9.1 Inventaire des modules à migrer

**Depuis `OpenEnsdev/main-dev-repo/ens_core-17/` :**

| Module | Version | Dépendances clés | Clients utilisateurs |
|---|---|---|---|
| `custom_reports` | 17.0.1.44 | base, web, sale, purchase, stock, account, identifiants_fiscaux_maroc | tous v17 |
| `custom_sale_invoice` | ? | account, sale | tous v17 |
| `ens_crm_task` | ? | crm, project | maxelec, mecafric |
| `ens_extra` | ? | base | tous v17 |
| `ens_reports_print` | ? | report | tous v17 |
| `enswork_config_center` | ? | base | tous v17 |
| `partner_statement_report` | récent | account, partner | tous v17 |

**Depuis `OpenEnsdev/main-dev-repo/ens_core-14/` :**
- Modules legacy, version 14.0.X.Y.Z — à archiver, ne pas activer sauf pour `specta`.

**Depuis `OpenEnsdev/main-dev-repo/ens_core-19/` :**
- Squelette uniquement — à compléter au fur et à mesure.

## 9.2 Procédure d'import

```bash
# Pour chaque version
for v in 14 17 19; do
  src="/home/abdelali/OpenEnsdev/main-dev-repo/ens_core-${v}"
  dst="/home/abdelali/pacadev/modules/ens_core-${v}"
  [ -d "$src" ] || continue
  mkdir -p "$dst"
  cp -r "$src"/* "$dst/"
done
```

## 9.3 Validation post-import

1. **Cohérence manifest** :
   ```bash
   for m in /home/abdelali/pacadev/modules/ens_core-17/*/; do
     python3 -c "
   import ast, sys
   src = open('$m/__manifest__.py').read()
   manifest = ast.literal_eval(src)
   v = manifest.get('version', '')
   assert v.startswith('17.0.'), f'Bad version {v} in $m'
   print(f'OK $m {v}')
   "
   done
   ```
2. **Dépendances** : `pip install pylint-odoo && pylint-odoo /home/abdelali/pacadev/modules/ens_core-17/*/`.
3. **Tests Odoo** (s'il y en a) :
   ```bash
   pacadev test run --module custom_reports
   ```

## 9.4 Stratégie de versionnage post-fusion

- Convention conservée : `17.0.X.Y.Z`.
- Bump patch (Z+1) pour fixes après migration.
- Bump minor (Y+1, Z=0) pour nouvelle fonctionnalité.
- Tag Git : `<client>/v17/<YYYY.MM.DD>-<build>` sur déploiement prod (déjà standard pacadev).

## 9.5 Stratégie OCA

OCA modules sont actuellement bind-mountés depuis `clients/<X.0>/local/<C>/addons/oca/`.
→ Garder cette logique mais centraliser via submodules Git dans `pacadev/modules/oca-17/`, `pacadev/modules/oca-14/`, etc.

Ou conserver per-client : plus simple, moins de risque de cassure.
→ **Recommandation : per-client** (statu quo OpenEnsdev), avec doc claire sur les versions OCA utilisées par client.

---

# 10. STRATÉGIE DE MIGRATION DES CLIENTS DOCKER

## 10.1 Plan par client

| Client | Version | État OpenEnsdev | Priorité migration | Estimation effort |
|---|---|---|---|---|
| `specta` | 14.0 | ✅ Running | 🟡 Moyenne (seul client actif v14) | 0.5 j |
| `pacadai` | 19.0 | ❌ Arrêté | 🟢 Haute (v19, unique) | 0.5 j |
| `afrequip` | 17.0 | ⚠️ Initialized pacadev | 🟢 Haute | 0.5 j |
| `maxelec` | 17.0 | ⚠️ Initialized pacadev | 🟢 Haute | 0.5 j |
| `mecafric` | 17.0 | ⚠️ Initialized pacadev | 🟢 Haute | 0.5 j |
| `enswork` | 17.0 | ❌ Arrêté | 🟡 Moyenne | 1 j |
| `aquaplanet`, `elecap`, `ibtech`, `shared_vps` | 17.0 | ❌ Arrêté | 🔴 Décision archive vs migration | 1 j si migré |
| `mecafric` (vps_dedie), `mecafric_water`, `powerone` | 17.0 | ❌ Arrêté | 🔴 Décision | 1 j si migré |
| `africapool`, `biomatec`, `innovation_electrique`, `scandi`, `sidtec`, `sofilair` | 14.0 | ❌ Arrêté | 🔴 Très probable archive | — |
| `enzo_industrie`, `ex_connect`, `fime`, `shared_vps` (v14) | 14.0 | ❌ Arrêté | 🔴 Très probable archive | — |

**Décision recommandée :** Migrer les 5 actifs ou récemment actifs (specta, pacadai, afrequip, maxelec, mecafric, enswork) ; archiver le reste avec backup full.

## 10.2 Script `04_migrate_client.py`

```python
#!/usr/bin/env python3
"""Migre un client OpenEnsdev → pacadev."""

import argparse, shutil, yaml, subprocess, json
from pathlib import Path
from datetime import datetime

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--client", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--source", required=True, type=Path)
    p.add_argument("--target", required=True, type=Path)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    if args.target.exists():
        print(f"SKIP: {args.target} existe déjà")
        return

    # 1. Création arborescence
    if not args.dry_run:
        args.target.mkdir(parents=True)
        (args.target / "addons").mkdir()
        (args.target / "config").mkdir()
        (args.target / "filestore").mkdir()
        (args.target / "backups").mkdir()

    # 2. Copie addons (sauf ens_core qui sera symlinké vers pacadev/modules/)
    for sub in (args.source / "addons").iterdir():
        if sub.name == "ens_core":
            # créer symlink vers pacadev/modules/ens_core-<version>
            link = args.target / "addons" / "ens_core"
            target_modules = Path(f"/home/abdelali/pacadev/modules/ens_core-{args.version}")
            if not args.dry_run:
                link.symlink_to(target_modules)
        else:
            if not args.dry_run:
                shutil.copytree(sub, args.target / "addons" / sub.name, symlinks=True)

    # 3. Copie config (odoo.conf sera adapté ensuite par 02_extract_secrets.py)
    if (args.source / "config").exists():
        if not args.dry_run:
            shutil.copytree(args.source / "config", args.target / "config", dirs_exist_ok=True)

    # 4. Copie filestore (ou symlink si > 1 GB)
    src_fs = args.source / "filestore"
    if src_fs.exists():
        size_mb = sum(f.stat().st_size for f in src_fs.rglob("*") if f.is_file()) / 1024 / 1024
        if size_mb > 1024 and not args.dry_run:
            # symlink (à valider après PG migration)
            (args.target / "filestore").rmdir()
            (args.target / "filestore").symlink_to(src_fs)
        elif not args.dry_run:
            shutil.copytree(src_fs, args.target / "filestore", dirs_exist_ok=True)

    # 5. Adapter docker-compose.yml
    src_compose = args.source / "docker-compose.yml"
    if src_compose.exists():
        compose = yaml.safe_load(src_compose.read_text())
        # Adapter network
        for svc in compose.get("services", {}).values():
            svc["networks"] = ["pacadev-network"]
            # admin_passwd via env
            env = svc.get("environment", {})
            if isinstance(env, list):
                env = {e.split("=", 1)[0]: e.split("=", 1)[1] for e in env if "=" in e}
            env["HOST"] = "pacadev_postgres_shared"
            env["ODOO_ADMIN_PASSWD"] = "${ODOO_ADMIN_PASSWD}"
            svc["environment"] = env
            # labels Traefik adaptés
            svc.setdefault("labels", []).append(
                f"traefik.http.routers.{args.client}.rule=Host(`{args.client}.pacadev.local`)"
            )
        compose["networks"] = {"pacadev-network": {"external": True}}
        if not args.dry_run:
            (args.target / "docker-compose.yml").write_text(yaml.safe_dump(compose))

    # 6. Métadonnées pacadev
    config_json = {
        "client": args.client,
        "odoo_version": args.version,
        "migrated_from": "openensdev",
        "migration_date": datetime.utcnow().isoformat(),
        "source_path": str(args.source),
    }
    pacadev_meta = Path.home() / ".pacadev" / "clients" / args.client
    if not args.dry_run:
        pacadev_meta.mkdir(parents=True, exist_ok=True)
        (pacadev_meta / "config.json").write_text(json.dumps(config_json, indent=2))

    # 7. versions.json
    versions_file = Path.home() / ".pacadev" / "state" / "versions.json"
    if not args.dry_run and versions_file.exists():
        data = json.loads(versions_file.read_text())
        data.setdefault("clients", {})[args.client] = {
            "odoo_version": args.version,
            "status": "migrating",
            "migrated_from": "openensdev",
            "migration_date": datetime.utcnow().isoformat(),
        }
        versions_file.write_text(json.dumps(data, indent=2))

    print(f"OK: {args.client} migré vers {args.target}")

if __name__ == "__main__":
    main()
```

## 10.3 Script `05_migrate_pg.py`

```python
#!/usr/bin/env python3
"""Restore une DB depuis dump OpenEnsdev vers PG pacadev."""

import argparse, subprocess
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--client", required=True)
    p.add_argument("--source-dump", required=True, type=Path)
    p.add_argument("--target-container", default="pacadev_postgres_shared")
    p.add_argument("--db-name", default=None)
    args = p.parse_args()

    db = args.db_name or f"{args.client}_prod"

    # 1. Créer DB cible
    subprocess.run([
        "docker", "exec", args.target_container,
        "psql", "-U", "odoo", "-c", f"CREATE DATABASE {db} OWNER odoo;"
    ], check=False)  # ignore si existe

    # 2. Restore
    with open(args.source_dump) as f:
        subprocess.run([
            "docker", "exec", "-i", args.target_container,
            "psql", "-U", "odoo", "-d", db
        ], stdin=f, check=True)

    print(f"OK: DB {db} restaurée dans {args.target_container}")

if __name__ == "__main__":
    main()
```

## 10.4 Script `06_validate_client.py`

```python
#!/usr/bin/env python3
"""Valide qu'un client migré fonctionne."""

import argparse, time, subprocess, requests, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--client", required=True)
    p.add_argument("--port", type=int, default=None)
    args = p.parse_args()

    container = f"{args.client}_odoo_1"
    print(f"Vérification {container}...")

    # 1. Container running
    r = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", container],
                       capture_output=True, text=True)
    if r.stdout.strip() != "true":
        print(f"FAIL: container {container} pas running")
        sys.exit(1)

    # 2. Healthcheck Odoo via Traefik
    url = f"http://{args.client}.pacadev.local/web/health"
    for attempt in range(10):
        try:
            r = requests.get(url, timeout=3)
            if r.status_code == 200:
                print(f"OK: healthcheck {url}")
                break
        except requests.RequestException:
            pass
        time.sleep(3)
    else:
        print(f"FAIL: healthcheck {url} après 30s")
        sys.exit(1)

    # 3. Vérifier modules ENS chargés (via psql)
    db = f"{args.client}_prod"
    r = subprocess.run([
        "docker", "exec", "pacadev_postgres_shared",
        "psql", "-U", "odoo", "-d", db, "-tAc",
        "SELECT name FROM ir_module_module WHERE state='installed' AND name LIKE 'ens_%' OR name LIKE 'custom_%';"
    ], capture_output=True, text=True)
    modules = [m.strip() for m in r.stdout.strip().split("\n") if m.strip()]
    print(f"OK: {len(modules)} modules ENS/custom installés : {modules}")

    print(f"VALIDATION RÉUSSIE pour {args.client}")

if __name__ == "__main__":
    main()
```

---

# 11. TESTS, VALIDATION & CHECKLISTS

## 11.1 Tests à exécuter avant chaque fusion de phase

```bash
# Tests E2E pacadev (doivent rester 100 %)
cd /home/abdelali/pacadev
python core/scripts/validate-e2e.py

# Tests FSM unitaires
python -m pytest core/workflow/test_fsm.py -v

# Tests intégration Phase A+B
python core/scripts/test-phase-ab-integration.py

# Lint
ruff check core/
pylint-odoo modules/ens_core-17/*/

# Sécurité
bandit -r core/
trivy fs core/

# Vérif secrets en clair
! grep -rE '(admin_passwd|sk-ant-|api_key)\s*[:=]\s*[a-zA-Z0-9]+' core/ v14/ v17/ v19/ --include='*.py' --include='*.yaml' --include='*.conf'
```

## 11.2 Checklist pré-migration

- [ ] Lecture complète de ce document.
- [ ] Backup full OpenEnsdev (DB + filestores + code) > 7 jours antérieur.
- [ ] Snapshot disque ou VM (si possible).
- [ ] Test décryptage SOPS sur clé age actuelle : `sops -d core/secrets/.env.template.yaml` (vérifier syntaxe).
- [ ] Phase A pacadev validée (34/34).
- [ ] Phase B pacadev validée (tokens, RBAC).
- [ ] Disponibilité opérateur (1 personne dédiée pour migration).
- [ ] Plage horaire planifiée (idéalement hors heures ouvrées Odoo prod).

## 11.3 Checklist par client migré

- [ ] Backup DB OpenEnsdev : `docker exec odoo_postgres_shared pg_dump -U odoo <db> > ~/backups/pre_migration_<client>_<date>.sql` (taille > 0).
- [ ] Backup filestore : `tar -czf ~/backups/pre_migration_<client>_filestore_<date>.tar.gz <filestore_path>` (taille > 0).
- [ ] Script `04_migrate_client.py` exécuté sans erreur.
- [ ] `secrets/<client>.enc.yaml` présent et décryptable.
- [ ] `docker compose -f v<X>/clients/<C>/docker-compose.yml up -d` démarre sans erreur.
- [ ] `pacadev` script `06_validate_client.py` retourne succès.
- [ ] Login admin Odoo OK via UI.
- [ ] Modules ENS chargés (vérif `Apps` → `Modules installés`).
- [ ] Création d'un ordre de vente / facture test : OK.
- [ ] `pacadev backup create --client <C>` génère un backup atomique.
- [ ] `pacadev audit log --filter client=<C>` montre toutes les transitions.
- [ ] `versions.json` à jour avec `status: migrated`.
- [ ] Conteneur OpenEnsdev correspondant arrêté (mais pas supprimé).

## 11.4 Checklist post-fusion (décommissionnement)

- [ ] Tous les clients critiques migrés et validés.
- [ ] 7 jours minimum de fonctionnement pacadev sans incident.
- [ ] Audit log pacadev cohérent (aucune transition `ERROR` non résolue).
- [ ] Backups atomiques fonctionnent et restorables.
- [ ] Monitoring (Grafana) alimenté en données.
- [ ] Dashboard Streamlit accessible.
- [ ] `pacadev memory search` fonctionne avec données rechargées.
- [ ] Token d'approbation `decommission_openensdev` généré et utilisé.
- [ ] OpenEnsdev en read-only (`chmod -R a-w`).
- [ ] Archive tar OpenEnsdev > 5 GB sauvegardée sur stockage externe.
- [ ] `docs/DECOMMISSION_OPENENSDEV.md` daté et signé.
- [ ] Audit log final : `migration_openensdev_to_pacadev_complete`.

---

# 12. RISQUES, ANTIPATTERNS & MITIGATIONS

## 12.1 Risques techniques

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Corruption DB pendant migration | Faible | Critique | Backup full + test restore sur PG de dev avant migration prod |
| R2 | Perte filestore (gros volumes) | Moyenne | Élevé | tar+verify checksum + symlink temporaire avant copie définitive |
| R3 | Modules ENS incompatibles entre OpenEnsdev et pacadev | Moyenne | Moyen | Tester sur client de staging avant prod ; conserver tag Git pre-migration |
| R4 | Secrets perdus pendant migration SOPS | Faible | Critique | Garder `.env` OpenEnsdev en backup non chiffré pendant 30 j |
| R5 | Conflit de ports (Traefik, PG) | Moyenne | Faible | Démarrer pacadev infra sur ports alternatifs si OpenEnsdev encore actif |
| R6 | Bind mounts cassés après migration filestore | Moyenne | Moyen | Tester `docker exec <c> ls /var/lib/odoo/filestore` post-migration |
| R7 | FSM extension casse les 34 tests E2E | Faible | Élevé | Tests régression avant merge ; pas de modification fsm.py sans test associé |
| R8 | Mem0/Ollama indisponible | Élevée | Faible | Module optionnel ; pacadev fonctionne sans Mem0 |
| R9 | `git push` accidentel pendant migration | Moyenne | Moyen | Pré-hooks Git pour bloquer push sur branches `dev/migration/*` sans flag explicit |
| R10 | Drift entre `pacadev/modules/` et `OpenEnsdev/main-dev-repo/` | Élevée | Moyen | Pendant transition : freeze `main-dev-repo` (lecture seule) |

## 12.2 Antipatterns à éviter

- ❌ **Big bang** : tout migrer en un weekend. → ✅ Phase par phase, client par client.
- ❌ **Ignorer les backups** : "ça va aller". → ✅ Backup atomique + verify restore avant toute action destructive.
- ❌ **Copier les secrets** : `.env` dans `pacadev/.env`. → ✅ SOPS chiffré uniquement.
- ❌ **Désactiver pre-commit pour gagner du temps**. → ✅ Linter actif sur toutes les branches.
- ❌ **Supprimer `OpenEnsdev/` dès que pacadev fonctionne**. → ✅ Read-only 30 jours minimum.
- ❌ **Bind mount `ens_core` vers `main-dev-repo` après migration**. → ✅ Bind vers `pacadev/modules/`.
- ❌ **Hard-coder `admin_passwd` dans `docker-compose.yml`**. → ✅ Toujours via `${ODOO_ADMIN_PASSWD}` + SOPS.
- ❌ **Réutiliser ports OpenEnsdev (80, 5432)**. → ✅ Vérifier conflits via `verify-ufw-docker.sh` adapté.
- ❌ **Ignorer l'audit log pendant migration**. → ✅ Chaque action de migration produit un événement.
- ❌ **Modifier FSM sans test**. → ✅ Tout ajout d'état/transition → test pytest associé.

## 12.3 Plan de rollback

Si une migration de client échoue à mi-chemin :

```bash
# 1. Stop conteneur pacadev
docker compose -f /home/abdelali/pacadev/v17/clients/<C>/docker-compose.yml down

# 2. Drop DB pacadev (si créée)
docker exec pacadev_postgres_shared psql -U odoo -c "DROP DATABASE <C>_prod;"

# 3. Remove arborescence cliente pacadev
rm -rf /home/abdelali/pacadev/v17/clients/<C>

# 4. Remove secrets
rm /home/abdelali/pacadev/core/secrets/<C>.enc.yaml

# 5. Update versions.json (retirer entrée client)
python3 -c "
import json
from pathlib import Path
f = Path.home() / '.pacadev' / 'state' / 'versions.json'
d = json.loads(f.read_text())
d['clients'].pop('<C>', None)
f.write_text(json.dumps(d, indent=2))
"

# 6. Audit log
pacadev audit log "migration_rollback --client <C> --reason <reason>"

# 7. Restart OpenEnsdev container (si pas encore arrêté)
docker compose -f /home/abdelali/OpenEnsdev/clients/<X.0>/local/<C>/docker-compose.yml up -d
```

---

# 13. ANNEXES

## 13.1 Glossaire

- **FSM** : Finite State Machine (machine à états finis). Garantit que seules les transitions explicitement définies sont valides.
- **HMAC** : Hash-based Message Authentication Code. Token cryptographique signé avec clé secrète.
- **JSONL** : JSON Lines. Format où chaque ligne est un JSON indépendant. Idéal pour logs append-only.
- **SOPS** : Secrets OPerationS (Mozilla). Chiffrement de fichiers YAML/JSON avec clés age, GPG, AWS KMS, etc.
- **age** : Outil de chiffrement moderne (alternative à GPG), clés simples (public/private, pas de keyring).
- **OCA** : Odoo Community Association. Modules communautaires de qualité production.
- **Mem0** : Bibliothèque de mémoire LLM avec vector store (ChromaDB) + LLM (Ollama) pour contexte persistant.
- **Aider** : Assistant de codage CLI utilisant Git diff et un LLM pour modifier du code.
- **Continue.dev** : Extension VSCode pour intégrer Claude/GPT dans l'IDE.
- **Devcontainer** : Spécification VSCode pour environnement de dev conteneurisé reproductible.
- **Traefik** : Reverse proxy moderne avec auto-découverte Docker et routage par labels.

## 13.2 Commandes pacadev finales (post-fusion)

```bash
# Init projet (rarement utilisé)
pacadev secrets init --age-key-file ~/.pacadev/age.key

# Workflow quotidien
pacadev work start --client maxelec --issue 42 --action partner_statement_report
pacadev work commit -m "add deadline_date field" --module ens_crm_task --type feat
pacadev work review --start
pacadev work review --done
pacadev work test-manual --start
pacadev work test-manual --passed
# (git push trigger CI → IA risk → auto-merge ou review)
pacadev deploy --env staging --client maxelec
pacadev deploy --env staging --validate  # smoke tests
pacadev approve --generate --client maxelec --action deploy_prod --reason "Hotfix #42"
# (lead exécute cette commande, partage token avec dev)
pacadev deploy --env prod --client maxelec --approve-token "token_xxx" --reason "Hotfix #42"
pacadev work done --client maxelec

# Mémoire IA (porté d'OpenEnsdev)
pacadev memory search "facture maxelec calcul TVA"
pacadev memory load-rules
pacadev memory load-clients
pacadev memory stats

# Infrastructure (porté d'OpenEnsdev)
pacadev infra start                          # PG + Traefik
pacadev infra start-all-clients              # tous les clients
pacadev infra verify                          # diagnostic UFW/Docker
pacadev infra stop

# Dashboard (porté d'OpenEnsdev)
pacadev dashboard start                       # http://localhost:8501
pacadev dashboard stop

# Backup / rollback
pacadev backup create --client maxelec
pacadev backup list --client maxelec
pacadev rollback --client maxelec --backup <id>
pacadev rollback --client maxelec --auto      # dernier backup

# Monitoring
pacadev monitor start                         # Prometheus + Grafana + Loki
pacadev monitor logs --client maxelec
pacadev monitor stop

# Tests
pacadev test run --module custom_reports

# Secrets
pacadev secrets show --client maxelec
pacadev secrets edit --client maxelec
pacadev secrets encrypt --client maxelec     # après edit non chiffré

# Audit
pacadev audit log --filter client=maxelec --since "7 days ago"
pacadev audit verify                          # check intégrité hashs
```

## 13.3 Configuration `~/.pacadev/config.yaml` finale

```yaml
defaults:
  odoo_version: "17"
  branch_prefix: "dev/"
  staging_env: "staging"
  prod_env: "prod"
  ai:
    provider: "anthropic"          # Claude pour risk scoring
    max_tokens: 4000
    risk_threshold: 0.5            # auto-merge si < 0.5
    memory:                         # Mem0 (porté OpenEnsdev)
      enabled: true
      provider: "ollama"
      llm_model: "llama3.1:8b-instruct-q6_K"
      embedder_model: "nomic-embed-text"
      ollama_base_url: "http://127.0.0.1:11434"
      chroma_path: "~/.pacadev/memory/chroma_db"
paths:
  workspace: "/home/abdelali/pacadev"
  state_dir: "~/.pacadev/state"
  secrets_dir: "~/.pacadev/secrets"
  modules_dir: "/home/abdelali/pacadev/modules"
  infra_dir: "/home/abdelali/pacadev/core/infra"
network:
  tailscale_subnet: "10.200.0.0/16"
  postgres_port: 5432
  odoo_port: 8069
  traefik_dashboard_port: 8080
  monitoring:
    prometheus: 9090
    grafana: 3000
    loki: 3100
  dashboard:
    streamlit: 8501
infrastructure:
  postgres:
    container_name: "pacadev_postgres_shared"
    image: "postgres:14"
    network: "pacadev-network"
  traefik:
    container_name: "pacadev_traefik"
    image: "traefik:v2.11"
    host: "pacadev.local"
github:
  org: ENSWORK
  core_repo: ENSWORK/pacadev
  workflow:
    branch_pattern: "dev/{client}/{issue}-{action}"
    commit_pattern: "[{module}] {type}: {message}\n\nRefs: #{issue}"
    tag_pattern: "{client}/v{version}/{date}-{build}"
```

## 13.4 Estimation totale d'effort

| Phase | Durée optimiste | Durée réaliste | Effort cumulé |
|---|---|---|---|
| 1. Préparation & inventaire | 0.5 j | 1.5 j | 1.5 j |
| 2. Import modules ENS | 0.5 j | 1 j | 2.5 j |
| 3. Import infra partagée | 0.5 j | 1 j | 3.5 j |
| 4. Migration secrets | 0.25 j | 0.5 j | 4 j |
| 5. Migration clients (×5) | 2.5 j | 5–7 j | 9–11 j |
| 6. Import IA & dashboard | 1 j | 2 j | 11–13 j |
| 7. Workflow & FSM extension | 0.5 j | 1 j | 12–14 j |
| 8. Décommissionnement | 0.5 j | 1 j | 13–15 j |
| **Total** | **6 j** | **13–15 j** | — |

Soit **~2-3 semaines** de travail focalisé pour un opérateur seul.

## 13.5 Références croisées

- Document architecture pacadev : `/home/abdelali/pacadev/docs/ARCHITECTURE.md`
- Runbook urgences pacadev : `/home/abdelali/pacadev/docs/RUNBOOK.md`
- Runbook Phase A+B : `/home/abdelali/pacadev/RUNBOOK_PHASE_AB.md`
- Validation E2E : `/home/abdelali/pacadev/VALIDATION_E2E_REPORT.md`
- Phase A delivery : `/home/abdelali/pacadev/core/PHASE_A_DELIVERY.md`
- Phase B delivery : `/home/abdelali/pacadev/core/PHASE_B_DELIVERY.md`
- Workflow README : `/home/abdelali/pacadev/core/WORKFLOW_README.md`
- Workflow OpenEnsdev : `/home/abdelali/OpenEnsdev/Workflow ENSDEV Orchestration.md`
- Methodology OpenEnsdev : `/home/abdelali/OpenEnsdev/main-dev-repo/NEW_METHODODOLOGY_README.md`
- AI rules OpenEnsdev : `/home/abdelali/OpenEnsdev/main-dev-repo/AI_CODE_RULES.md`

## 13.6 FAQ

**Q : Pourquoi ne pas garder OpenEnsdev en parallèle indéfiniment ?**
R : Coût opérationnel (16 GB disque, 2 venvs, multiples containers), risque de drift entre les deux orchestrateurs, dispersion des secrets. Une source de vérité unique = simplicité.

**Q : Que faire si un client refuse la migration (downtime non acceptable) ?**
R : Migration en mode "shadow" — créer le client dans pacadev en pointant vers la DB OpenEnsdev (read-only), valider l'usage, puis copier la DB pendant fenêtre de maintenance. Voir Phase 5 procédure adaptée.

**Q : Faut-il vraiment porter Mem0 / Aider ? Continue.dev suffit-il ?**
R : Continue.dev (Claude cloud) est plus puissant mais coûteux et nécessite Internet. Mem0 + Ollama local est gratuit et offline, pertinent pour code legacy ou révisions répétitives. Recommandation : **les deux**, Mem0 pour pré-chargement contexte, Continue/Claude pour génération.

**Q : Comment gérer les modules OCA ?**
R : Statu quo — bind mount par client depuis `addons/oca/`. Possibilité future de centralisation dans `pacadev/modules/oca-<v>/` mais pas prioritaire.

**Q : Le PostgreSQL partagé est-il vraiment plus efficace ?**
R : Oui, économie RAM significative (1 instance vs N), simplifie les backups groupés, permet partage de modèles `auth_*`. Mais isolation moins forte qu'un PG par client. Choix conscient documenté dans `docs/INFRA.md`.

**Q : Que devient l'environnement Aider/PyCharm `venv-odoo-dev` (8 GB) ?**
R : À conserver tant qu'il sert (debugging legacy). Peut être pointé vers `pacadev/odoo-sources/odoo-17/` (symlink) pour servir aux deux orchestrateurs. À retirer après décommissionnement complet.

**Q : Faut-il migrer les bases de données ChromaDB (Mem0) ?**
R : Oui — copier `cli/ensdev/memory/chroma_db/` vers `~/.pacadev/memory/chroma_db/` puis relancer `pacadev memory load-clients/rules/history`. Conserver les vecteurs déjà calculés.

---

# RÉSUMÉ EXÉCUTIF (1 page)

**Objectif :** Conserver `pacadev` comme orchestrateur final unique, en y intégrant les meilleures pratiques opérationnelles d'`OpenEnsdev`.

**Méthode :**
1. pacadev = socle (FSM stricte, audit immuable, RBAC, tokens HMAC, SOPS secrets, monitoring, CI/CD).
2. OpenEnsdev = source des modules ENS Odoo 17 (6 modules production), infrastructure éprouvée (Traefik + PG partagé), CLI workflow (Mem0+Aider+dashboard Streamlit), conventions Git.

**8 phases (13–15 jours) :**
1. Préparation & inventaire (backup full).
2. Import modules ENS → `pacadev/modules/ens_core-<v>/`.
3. Import infra (PG + Traefik + scripts) → `pacadev/core/infra/`.
4. Migration secrets vers SOPS (élimination clair text).
5. Migration progressive des clients (1 par 1, validation E2E par client).
6. Import IA (Mem0 + Ollama) et dashboard Streamlit → modules optionnels pacadev.
7. Extension FSM (ajout SELF_REVIEW + TEST_MANUAL).
8. Décommissionnement OpenEnsdev (read-only puis archive).

**Résultats attendus :**
- pacadev devient seul orchestrateur, avec :
  - Toutes les capacités sécurité/qualité pacadev (FSM, audit, RBAC, tests, CI).
  - Tous les actifs métier OpenEnsdev (modules, clients, infra, IA locale, dashboard).
- OpenEnsdev archivé (read-only, conservé 30 j minimum puis tar full).
- Documentation consolidée, secrets exclusivement chiffrés, tests 100 % passing.

**Indicateurs de réussite :**
- `pacadev audit verify` : 100 % intègre.
- `validate-e2e.py` : 36/36 (34 actuels + 2 ajouts FSM).
- Aucun secret en clair : `grep -r` négatif.
- 5 clients critiques migrés et fonctionnels.
- 7 jours sans incident post-migration.
- Audit log final : `migration_openensdev_to_pacadev_complete`.

---

**Fin du document.**
**Version :** 1.0
**Lignes :** ~1700
**Statut :** Brouillon initial — à valider avec opérateur et lead avant exécution.
