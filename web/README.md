# PACADEV Web UI

Centre de commande unifié pour l'orchestrateur Odoo multi-clients PACADEV.

**Stack** : Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Zustand · Prisma/SQLite · Socket.io

---

## Démarrage rapide

```bash
cd web/
bun install          # dépendances
bun run dev          # http://localhost:3000
```

WebSocket temps réel (optionnel) :
```bash
cd mini-services/ws-service/
bun install && bun run index.ts   # port 3003
```

**Prérequis** : Bun ≥ 1.x · Node ≥ 20 · Docker · Git · PACADEV CLI installé

---

## Architecture

```
Navigateur (SPA React)
  ├── Zustand store (navigation + données clients/tickets)
  ├── Socket.io-client → port 3003 (métriques/alertes temps réel)
  └── fetch → /api/* (Next.js App Router)

Next.js 16 (port 3000)
  ├── 8 vues : Dashboard · Clients · Workspace · Pipeline · IA · Backup · Observabilité · Audit
  ├── 40+ API Routes → src/lib/pacadev-service.ts → fichiers PACADEV locaux + CLI
  └── SQLite (db/custom.db) via Prisma

Sources de données réelles
  ├── ~/.pacadev/state/versions.json    → liste clients
  ├── ~/.pacadev/state/audit-log.jsonl  → journal immuable
  ├── ~/.pacadev/config.yaml            → configuration
  ├── ~/pacadev/v{N}/clients/{slug}/    → modules, addons
  ├── docker ps / docker logs            → status containers
  └── GitHub API (curl + gh token)       → issues, pipeline CI
```

---

## Configuration

Fichier `.env` à la racine de `web/` :

```env
DATABASE_URL=file:/home/abdelali/pacadev/web/db/custom.db

# Chemins absolus — nécessaires car bun snap utilise un HOME différent
PACADEV_HOME=/home/abdelali/.pacadev
PACADEV_WORKSPACE=/home/abdelali/pacadev
DOCKER_BIN=/usr/bin/docker
```

---

## État d'intégration des données réelles

| Module | Données | Status |
|--------|---------|--------|
| Dashboard — Clients | `versions.json` | ✅ Réel |
| Dashboard — Services | `docker ps` | ✅ Réel |
| Espace Client — Modules | scan `addons/` | ✅ Réel |
| Espace Client — Branches | git + GitHub API | ✅ Réel |
| Espace Client — Versions | audit-log + versions | ✅ Réel |
| Espace Client — Tickets | GitHub Issues API | ✅ Réel |
| Workspace — Work start/stop | CLI `pacadev work` | ✅ Réel |
| Deploy / Rollback | CLI `pacadev deploy` | ✅ Réel |
| Backup | scan `/tmp` + audit | ✅ Réel |
| Pipeline CI/CD | GitHub Actions API | ⚠️ Composant non connecté |
| IA & Risque | GitHub Actions API | ⚠️ Composant non connecté |
| WebSocket — Métriques | `docker stats` | ⚠️ ws-service optionnel |
| Audit — Export PDF | route `/api/audit/export` | ⚠️ Non implémenté |

---

## Structure des dossiers

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # SPA shell + DataLoader
│   │   ├── layout.tsx
│   │   └── api/                      # 40+ routes Next.js
│   ├── components/
│   │   ├── modules/                  # 8 vues principales
│   │   ├── shared/                   # composants réutilisables
│   │   └── ui/                       # shadcn/ui
│   └── lib/
│       ├── pacadev-service.ts        # couche service centrale (toutes fonctions réelles)
│       ├── store.ts                  # Zustand store global
│       ├── types.ts                  # types TypeScript partagés
│       └── api.ts                    # client HTTP centralisé
├── mini-services/ws-service/         # Socket.io temps réel (port 3003)
├── db/custom.db                      # SQLite Prisma
├── .env                              # configuration chemins
├── INTEGRATION_ROADMAP.md            # stratégie 3 semaines (phases B2→D)
├── TASK_TRACKER.md                   # suivi des tâches
└── README.md                         # ce fichier
```

---

## RBAC — Rôles

| Rôle | Permissions |
|------|-------------|
| `dev` | lecture, work start/stop |
| `lead` | + deploy staging, approve |
| `admin` | + rollback, backup, reset |
| `client` | lecture seule (espace client) |

---

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+N` | Nouveau ticket |
| `Ctrl+W` | Démarrer Work |
| `Ctrl+L` | Logs rapides |
| `Ctrl+K` | Palette de commandes |

---

## Changelog

### v1.1.0 — 2026-05-15 (actuel)

**Ajouts majeurs**
- `pacadev-service.ts` — couche service complète : 20+ fonctions connectées aux données réelles PACADEV
- `WorkspaceModule` — 3 onglets : TicketCreator, WorkStarter, WorkflowTracker
- `AuditModule` — journal immuable avec stream live, filtres, export
- `SecureConfirmModal` — validation sécurisée (countdown, raison obligatoire, commande CLI affichée)
- `PermissionGuard` — contrôle d'accès RBAC côté UI
- `WorkflowProgressBar` — timeline de workflow FSM (6 étapes)
- `KeyboardShortcuts` — raccourcis globaux (Ctrl+N/W/L/K)

**Routes API ajoutées**
- `GET /api/clients/{slug}/modules` — modules réels depuis `addons/`
- `GET /api/clients/{slug}/branches` — branches git réelles
- `GET /api/clients/{slug}/versions` — historique depuis audit-log
- `GET /api/clients/{slug}/logs` — logs docker réels
- `GET /api/clients/{slug}/pipeline` — GitHub Actions
- `GET /api/clients/{slug}/issues` — GitHub Issues
- `POST /api/clients/{slug}/work/start` — CLI wrapper
- `POST /api/clients/{slug}/deploy/approval` — déploiement avec gate
- `POST /api/clients/{slug}/rollback` — rollback CLI
- `GET/POST /api/clients/{slug}/backups` — gestion backups
- `GET /api/auth/me` — utilisateur réel (RBAC)
- `GET /api/audit/stream` — SSE audit live
- `POST /api/tickets/create` — création ticket GitHub

**Corrections (v1.1.0)**
- Pipeline CI/CD : scope `v17/ens_core`, gitleaks binaire, manifests glob corrigé
- Lint : erreurs Ruff E741/F401/F841 dans `partner_statement_report`
- Dockerfile : wkhtmltopdf intégré

---

### v1.0.0 — 2026-05-13 (baseline)

**Fondations**
- Scaffold Next.js 16 + shadcn/ui importé depuis z.ai
- 8 vues SPA : Dashboard, Clients, Pipeline, IA, Backup, Observabilité, Audit + Workspace
- Données mock complètes (clients, tickets, pipelines, metrics)
- Store Zustand : navigation + `realClients` / `realTickets` / `dataLoaded`
- WebSocket service Socket.io (port 3003) — événements mock 10/20/30s
- Prisma SQLite — 10 modèles (Client, Deployment, Backup, Alert, AIRisk, etc.)
- `GET /api/clients` — 5 clients réels depuis `versions.json`
- `GET /api/audit` — audit-log.jsonl réel avec hash-chain
- `GET /api/services` — containers docker réels

---

### À venir — v1.2.0 (Phase B2→D)

- Connexion composant Pipeline aux données GitHub Actions réelles
- Connexion composant IA & Risque aux résultats CI
- Export PDF du journal d'audit
- WebSocket métriques docker live (ws-service → frontend)
- Smoke tests automatiques post-déploiement
- Support multi-utilisateurs NextAuth

Voir `INTEGRATION_ROADMAP.md` pour le plan détaillé.

---

## Développement

### Ajouter un client

Le client doit être déclaré dans `~/.pacadev/state/versions.json`. L'API `/api/clients` le détecte automatiquement.

### Modifier une vue

Chaque vue est un composant React dans `src/components/modules/`. La navigation est gérée par `currentView` dans le store Zustand — pas de routage fichier Next.js.

### Modifier la couche données

Toutes les fonctions qui lisent PACADEV sont dans `src/lib/pacadev-service.ts`. Les routes API dans `src/app/api/` appellent ces fonctions — elles ne contiennent aucune logique propre.

> ⚠️ Ne jamais modifier les scripts CLI PACADEV (`/home/abdelali/pacadev/core/cli/`). Uniquement la couche `web/`.

---

*PACADEV Web UI — Usage interne ENSWORK*
