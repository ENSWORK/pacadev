# PACADEV — Architecture Serveur

> Serveur: VM Proxmox — Ubuntu 24.04 — 6GB RAM — 100GB disk
> IP: 192.168.11.20 — SSH: `pacadev@192.168.11.20`

---

## Arborescence

```
/home/pacadev/pacadev/
├── core/
│   ├── cli/                     # CLI Typer — pacadev
│   │   └── cli/
│   │       ├── main.py          # Entry point + init/list/health/version
│   │       ├── commands/
│   │       │   ├── work.py      # work start/stop/status
│   │       │   ├── deploy.py    # deploy approve [--dry-run]
│   │       │   ├── backup.py    # backup create/list
│   │       │   ├── rollback.py  # rollback [--auto/--backup]
│   │       │   ├── test.py      # test run --module
│   │       │   ├── secrets.py   # secrets show/init/edit
│   │       │   ├── generate.py  # generate devcontainer/ci
│   │       │   └── monitor.py   # monitor start/stop/status/logs
│   │       └── utils/
│   │           ├── state.py     # versions.json, audit-log
│   │           ├── git.py       # branches, status
│   │           ├── docker.py    # compose, healthcheck
│   │           └── secrets.py   # SOPS/age decrypt
│   ├── workflow/                 # FSM — 13 états, 20 transitions
│   │   └── fsm.py
│   ├── security/                 # RBAC + ApprovalManager (tokens HMAC)
│   │   ├── rbac.py              # 4 rôles: admin/lead/dev/viewer
│   │   ├── tokens.py            # HMAC tokens (fixé: vérification réelle)
│   │   └── approval.py          # Single-use approval manager
│   ├── audit/                    # Logs immuables (hash chaîné SHA256)
│   │   ├── logger.py
│   │   └── verifier.py
│   ├── ci-templates/
│   │   ├── pipeline-base.yml    # lint→test→security→IA→tag
│   │   └── deploy.yml           # deploy + rollback auto
│   ├── secrets/
│   │   ├── .sops.yaml           # règles chiffrement age
│   │   ├── .env.template.yaml   # template secrets
│   │   └── <client>.enc.yaml    # secrets chiffrés par client
│   ├── monitoring/
│   │   └── docker-compose.yml   # Prometheus + Grafana + Loki + Promtail
│   ├── infra/
│   │   ├── traefik/
│   │   │   ├── docker-compose.yml
│   │   │   └── dynamic/pacadev.yml
│   │   └── scripts/
│   │       ├── recreate-containers.sh
│   │       └── start-all-clients.sh
│   └── scripts/
│       └── init-acmecorp.sh
│
├── v14/clients/                  # Projets Odoo 14 (innovation_electrique, sofilair)
├── v17/clients/                  # Projets Odoo 17
│   ├── afrequip/                 # :8070 — DEV
│   ├── maxelec/                  # :8082
│   ├── mecafric/                 # :8092
│   └── mecafric_water/           # :8076
├── v19/clients/                  # Projets Odoo 19 (pacadai)
├── modules/                      # Modules ENS partagés (ens_core-17)
├── web/                          # Dashboard Next.js (port 3000)
│   ├── src/app/api/              # API routes (32 endpoints)
│   └── .next/                    # Build output
└── docs/
    ├── ARCHITECTURE.md           # Ce fichier
    ├── RUNBOOK.md                # Procédures d'urgence
    ├── RAPPORT_MIGRATION_SERVEUR.md
    ├── CLI_REFERENCE.md          # Référence complète CLI
    ├── WORKFLOW.md               # Workflow complet
    └── SERVEUR_SETUP.md          # Guide installation serveur

~/.pacadev/                      # État global
├── config.yaml                  # Configuration globale
├── secret.key                   # Clé HMAC (générée automatiquement)
├── tokens.jsonl                 # Token data pour vérification HMAC
├── state/
│   ├── versions.json            # Source de vérité clients
│   ├── audit-log.jsonl          # Historique actions (hash chaîné)
│   └── approvals.jsonl          # Historique approbations
├── secrets/
│   └── age/keys.txt             # Clé SOPS/age
├── logs/
└── monitoring/
```

---

## Infrastructure Docker

```
┌──────────────────────────────────────────────────────┐
│                   pacadev-network                     │
│                                                       │
│  ┌──────────────┐    ┌──────────────────────┐        │
│  │ traefik       │    │ postgres_shared       │        │
│  │ :8090 (web)   │    │ PG 14                 │        │
│  │ :8091 (dash)  │    │ :5434→5432            │        │
│  └──────┬───────┘    └──────────┬───────────┘        │
│         │                       │                     │
│  ┌──────┼───────────────────────┼──────────┐         │
│  │      │                       │          │         │
│  ▼      ▼                       ▼          ▼         │
│ afrequip maxelec           mecafric   mecafric_water  │
│ _odoo    _odoo              _odoo       _odoo         │
│ :8070    :8082              :8092       :8076         │
└──────────────────────────────────────────────────────┘
```

---

## CLI — Commandes principales

```bash
# Infrastructure
pacadev infra start              # Démarrer PostgreSQL + Traefik
pacadev infra stop               # Tout arrêter
pacadev infra status             # État de l'infra

# Workflow
pacadev work start --client <c> --issue <N>   # Créer branche + work
pacadev work stop --client <c>                # Arrêter le travail
pacadev work status --client <c>              # État FSM

# Déploiement
pacadev deploy approve --client <c> --env prod   # Déployer
pacadev deploy approve --client <c> --dry-run    # Dry-run

# Backup / Rollback
pacadev backup create --client <c>    # Backup DB + filestore
pacadev rollback --client <c>         # Rollback dernier backup

# Sécurité
pacadev secrets show <client>         # Voir les secrets
pacadev secrets edit <client>         # Éditer (éditeur)

# Monitoring
pacadev monitor start                 # Démarrer Prometheus+Grafana+Loki
pacadev health --all                  # Healthcheck tous les clients
```

---

## Workflow FSM

```
IDLE → DEV → SELF_REVIEW → TEST_MANUAL → CI_PENDING → STAGING → PROD_APPROVAL → PROD_DEPLOYED → CLOSED
  ↑         ↑                                                                        │
  └─────────┘ ←── failed (loop back to DEV)                                          │
  ↑                                                                                   │
  └───── CLOSED ←─────────────────────────────────────────────────────────────────────┘
```

13 états, 20 transitions. Chaque transition est loggée dans l'audit log.

---

## Sécurité

| Mécanisme         | Détail                                                  |
|-------------------|---------------------------------------------------------|
| **RBAC**          | Rôles `admin / lead / dev / viewer` par client          |
| **Approval token**| Signé HMAC-SHA256, TTL 15 min, usage unique             |
| **SOPS + age**    | Secrets chiffrés dans `core/secrets/<client>.enc.yaml`  |
| **Audit log**     | `~/.pacadev/state/audit-log.jsonl` — SHA256 hash chain  |
| **Secrets masking**| `SecretsMasker` — 9 patterns, jamais en clair dans logs |

---

## Clients configurés

| Client          | Port host | Port container | DB             | Statut   |
|-----------------|-----------|----------------|----------------|----------|
| afrequip        | 8070      | 8070           | afrequip (150MB)| DEV     |
| maxelec         | 8082      | 8082           | maxelec (23MB)  | Init    |
| mecafric        | 8092      | 8092           | mecafric_prod   | Init    |
| mecafric_water  | 8076      | 8076           | mecafric_water  | Init    |

---

## Dashboard Next.js

Port: `3000` — 32 API endpoints

| Endpoint                  | Description                          |
|---------------------------|--------------------------------------|
| `/api/clients`            | Liste des clients                    |
| `/api/clients/[slug]`     | Détail client                        |
| `/api/clients/[slug]/logs`| Logs Odoo temps réel                 |
| `/api/services`           | État services Docker                 |
| `/api/dashboard`          | Stats globales                       |
| `/api/security/scan`      | Scan sécurité (bandit/gitleaks)      |
| `/api/audit/stream`       | Stream audit log                     |

---

## Décisions Techniques

| Décision | Raison |
|----------|--------|
| PostgreSQL shared (1 container) | Economie RAM, backup centralisé |
| Traefik v2 | Routing dynamique par labels, auto-HTTPS |
| SOPS + age | Pas de serveur de clés, clés en fichier local |
| Typer pour le CLI | Auto-help, typage Python, completion shell |
| HMAC tokens stockés | Vérification réelle de signature (pas fail-open) |
| SHA256 hash chain audit | Intégrité vérifiable, détection altération |
