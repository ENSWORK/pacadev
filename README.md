# PACADEV — Orchestrateur Odoo Multi-Clients

> Version : **1.1.0**  
> Dernière mise à jour : 2026-05-15  
> Auteur : BAHOU / ENSWork

---

## Présentation

PACADEV est un orchestrateur de développement Odoo piloté par CLI. Il centralise la gestion de plusieurs instances Odoo (v14, v17, v19) sur une seule machine, avec une infrastructure partagée, un workflow contrôlé par machine à états (FSM), RBAC, audit immuable et déploiement approuvé.

---

## Versions

| Version | Date       | Description                                      |
|---------|------------|--------------------------------------------------|
| 1.1.0   | 2026-05-15 | Pipeline CI GitHub Actions (4 checks), Dockerfile wkhtmltopdf patché, module `partner_statement_report` afrequip |
| 1.0.0   | 2026-05-14 | Version initiale — infrastructure partagée, CLI Typer, FSM, RBAC, Mem0 |

---

## Architecture globale

```
pacadev/
├── core/
│   ├── cli/          ← CLI Typer (commande : pacadev)
│   ├── infra/        ← PostgreSQL partagé + Traefik
│   ├── workflow/     ← Machine à états FSM
│   ├── security/     ← RBAC + ApprovalManager (tokens HMAC)
│   ├── audit/        ← Logs immuables (hash chaîné)
│   ├── memory/       ← Mémoire IA par client (Mem0)
│   ├── secrets/      ← Secrets chiffrés SOPS + age
│   ├── templates/    ← Devcontainer, odoo.conf, CI
│   └── scripts/      ← Scripts d'initialisation
├── v14/clients/      ← Projets Odoo 14
├── v17/clients/      ← Projets Odoo 17
├── v19/clients/      ← Projets Odoo 19
├── modules/          ← Modules ENS partagés (ens_core-17, …)
├── migration/        ← Artefacts migration depuis OpenEnsdev
└── docs/             ← Architecture, Runbook
```

---

## Infrastructure partagée

Un seul réseau Docker (`pacadev-network`) connecte tous les services :

```
┌──────────────────────────────────────────────────┐
│  pacadev_traefik          pacadev_postgres_shared │
│  traefik:v2.11            postgres:14             │
│  :8090 (web)              :5434 (host)            │
│  :8091 (dashboard)                                │
│        │                        │                 │
│        └──────── pacadev-network ────────────────┘
│                       │
│        ┌──────────────┐
│        ▼              ▼
│   afrequip_odoo  mecafric_odoo
│   :8070           :8071
└──────────────────────────────────────────┘
```

Chaque client Odoo accède au PostgreSQL partagé et est accessible via `<client>.pacadev.local` grâce aux labels Traefik.

---

## CLI — Commandes principales

```bash
# Initialiser un nouveau client
pacadev init <client> --odoo 17

# Démarrer l'infra partagée
pacadev infra start

# Démarrer un environnement de travail
pacadev work start --client <client> --issue <N>

# Cycle de validation avant push
pacadev work review --client <client>
pacadev work test-manual --client <client>
pacadev work commit --client <client> --module <m> --type fix --desc "..."
pacadev work done --client <client> --issue <N>

# Déploiement
pacadev deploy generate-approval --client <client> --reason "..."
pacadev deploy approve --client <client> --env prod --approve-token <TOKEN>

# Backup / Rollback
pacadev backup create --client <client>
pacadev rollback --client <client>

# Monitoring
pacadev monitor start
pacadev health --all
```

---

## Workflow FSM (machine à états)

```
IDLE
  └─ work start ──→ DEV
                      └─ work review ──→ SELF_REVIEW
                                           ├─ passed ──→ TEST_MANUAL
                                           │                └─ passed ──→ DEV (prêt push)
                                           └─ failed ──→ DEV

DEV (prêt push)
  └─ work commit --push ──→ CI_PENDING
                                └─ CI OK ──→ STAGING
                                               └─ smoke OK ──→ PROD_APPROVAL
                                                                  └─ approve ──→ PROD_DEPLOYED
```

---

## Sécurité

| Mécanisme         | Détail                                                  |
|-------------------|---------------------------------------------------------|
| **RBAC**          | Rôles `admin / lead / dev / viewer` par client          |
| **Approval token**| Signé HMAC, TTL 15 min, à usage unique                  |
| **SOPS + age**    | Secrets chiffrés dans `core/secrets/<client>.enc.yaml`  |
| **Audit log**     | `~/.pacadev/state/audit-log.jsonl` — hash chaîné        |
| **Secrets masqués**| Jamais affichés en clair dans les logs CLI             |

---

## Clients configurés

| Client          | Version Odoo | Port host | URL locale                    | Statut      |
|-----------------|-------------|-----------|-------------------------------|-------------|
| afrequip        | 17          | 8070      | afrequip.pacadev.local        | DEV         |
| mecafric        | 17          | —         | mecafric.pacadev.local        | Initialisé  |
| mecafric_water  | 17          | —         | mecafric_water.pacadev.local  | Initialisé  |

---

## Structure addons (par client)

```
v17/clients/<client>/addons/
├── oca/         ← modules OCA tiers (read-only, submodules)
└── ens_core/    ← modules ENSWork internes
```

Modules ENS partagés entre clients : `modules/ens_core-17/`

### Modules ens_core livrés

| Client    | Module                      | Version    | Description                                           |
|-----------|-----------------------------|------------|-------------------------------------------------------|
| partagé   | `partner_statement_report`  | 17.0.1.4.0 | Relevé de compte partenaire (impayés, activité, détaillé) — PDF + Excel + email (centralisé dans `modules/ens_core-17/`) |
| partagé   | `hr_payroll_community`      | 17.0.1.1.0 | Paie Odoo 17 Community (payslips, contrats, congés) — centralisé dans `modules/ens_core-17/` |

> Les modules partagés vivent dans `modules/ens_core-17/` et sont bind-montés en lecture seule
> chez tous les clients (`/mnt/extra-addons/ens_core_shared`). Voir `modules/README.md` pour
> l'inventaire complet et les divergences à réarbitrer.

---

## Pipeline CI/CD

Fichier : `.github/workflows/pacadev-pipeline.yml`

Déclenché sur chaque push `dev/**` et chaque PR vers `main`. Les 4 checks sont **requis** avant tout merge (branch protection).

| Job          | Outils                        | Périmètre                          |
|--------------|-------------------------------|------------------------------------|
| **Lint**     | Ruff (Python) + xmllint (XML) | `v17/clients/*/addons/ens_core/`   |
| **Test**     | py_compile + ast.walk + vérif structure | `v17/clients/*/addons/ens_core/` |
| **Security** | Bandit (Python) + Gitleaks (secrets) | `v17/clients/*/addons/ens_core/` |
| **AI Risk**  | Score dynamique (IA commits, insertions, fichiers) | PR uniquement — bloque si score ≥ 8 |

> **Règle de travail :** le pipeline doit être vert avant de procéder aux tests manuels sur l'interface.

### Upgrade module (procédure)

```bash
cd v17/clients/<client>

# 1. Upgrade + stop
docker exec <client>_odoo odoo -c /etc/odoo/odoo.conf -d <client> -u <module> --stop-after-init

# 2. Redémarrer
docker compose start <client>_odoo
```

---

## Image Docker Odoo v17

Fichier : `v17/Dockerfile`

L'image de base `odoo:17` est étendue pour installer **wkhtmltopdf 0.12.6.1** (version avec Qt patché), indispensable pour les header/footer PDF Odoo. La version standard du dépôt apt (`0.12.6` non patché) ne supporte pas `--header-html`.

```dockerfile
FROM odoo:17
# wkhtmltopdf 0.12.6.1 patché — requis pour header/footer PDF
RUN curl -fsSL https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.jammy_amd64.deb \
    -o /tmp/wkhtmltox.deb && dpkg -i /tmp/wkhtmltox.deb
```

Pré-requis Odoo : ajouter dans la configuration du système Odoo (via SQL ou Settings) :
```
report.url = http://127.0.0.1:8069
```

---

## Démarrage rapide

```bash
# 1. Démarrer l'infra
pacadev infra start

# 2. Vérifier
pacadev infra status
pacadev health --all

# 3. Accéder à un client
open http://afrequip.pacadev.local:8090  # via Traefik
# ou directement
open http://localhost:8070
```

Ajouter à `/etc/hosts` si pas encore fait :
```
127.0.0.1  afrequip.pacadev.local mecafric.pacadev.local mecafric_water.pacadev.local sofetelec.pacadev.local dashboard.pacadev.local
```

---

## Documentation complémentaire

- `docs/ARCHITECTURE.md` — arborescence complète et décisions techniques
- `docs/RUNBOOK.md` — procédures d'urgence P0→P3
- `RUNBOOK_PHASE_AB.md` — guide opérationnel FSM + RBAC + tokens
- `core/infra/README.md` — infrastructure partagée (ports, routing, scripts)
- `v17/clients/<client>/MAINTENANCE.md` — procédures par client
