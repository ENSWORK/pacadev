# Déploiement Web PACADEV (Dashboard)

> Date : 2026-08-07 · État : **déployé et fonctionnel** sur le serveur `pacadev`.
> PR #14 (`dev/web/restore-dashboard`, merge `05eb6cf`) — le dashboard a été
> restauré en `web/` sur `main`, puis le pipeline CI remis au vert (PR #15, `d0c8f9c`).

## 1. Vue d'ensemble

Le dashboard web PACADEV est une application **Next.js** (App Router, Next 16.x,
TypeScript, Tailwind/shadcn-ui) + **Prisma/SQLite**, servie par **Traefik**.
Un **mini-service WebSocket** (Socket.io, Node pur) pousse en temps réel les
métriques Docker, les logs d'audit, les alertes santé et les pings pipeline.

| Composant | Techno | Port | Unité systemd (user) |
|---|---|---|---|
| Dashboard web | Next.js (dev, Turbopack) | 3000 | `pacadev-web.service` |
| WebSocket | Socket.io (Node, `index.mjs`) | 3003 | `pacadev-ws.service` |
| Reverse proxy | Traefik (Docker) | 80/443 local | conteneur `traefik` |
| Base de données | SQLite via Prisma | — | `web/db/custom.db` |
| État clients | `versions.json` | — | `~/.pacadev/state/versions.json` |

Routes Traefik :
- `http://pacadev.local` → `web:3000`
- `http://web.pacadev.local` → `web:3000`
- `ws://ws.pacadev.local` → `web:3003` (Socket.io, **`path: '/'`**)

## 2. Structure web/ (points clés)

```
web/
├── src/app/                 # Next.js App Router (routes + pages du dashboard)
├── src/app/api/             # 49 routes API (clients, dashboard, services, session…)
├── mini-services/
│   └── ws-service/
│       ├── index.mjs        # ⚙ runtime Node (Socket.io) — LE fichier exécuté
│       └── index.ts         # source Bun équivalente (à garder synchronisée)
├── prisma/schema.prisma     # schéma Prisma
├── db/custom.db             # base SQLite (hors git)
└── package.json
```

Le ws-service lit `~/.pacadev/state/versions.json` (`PACADEV_HOME`) pour connaître
les clients réels, et interroge Docker (`{{.CPUPerc}}` / `{{.MemPerc}}`) sur chaque
conteneur `<slug>_odoo`. Depuis 2026-08-07, ces appels Docker sont **asynchrones**
(`exec` promisifié + `Promise.all`) : l'event loop n'est plus bloquée ~1,5 s/cycle.

## 3. Prérequis serveur (spécifiques à cette machine)

- **Node.js v20.19.6** via nvm (défaut nvm), npm 10.8.2.
- **bun baseline 1.3.14** (`~/.bun/bin/bun`). ⚠ Le bun **standard** crashe sur ce
  Xeon E5-2670 (Sandy Bridge, **pas d'AVX2**) → `Illegal instruction`. Seul le
  build `bun-linux-x64-baseline` fonctionne. Extraction via `python3` (le zip
  fourni contient aussi un `.tar.gz` ; `unzip` est absent, `sudo` demande un mot
  de passe). Bun sert au **développement** (`bun --hot index.ts`) ; le runtime
  systemd de ws utilise `node index.mjs` → pas besoin de Bun en production.
- Outils absents sur ce serveur : `unzip`. Présents : `python3`, `xmllint`.

## 4. Installation / mise en route

```bash
ssh pacadev
cd ~/pacadev/web
npm install
npx prisma db push            # crée/maj db/custom.db depuis prisma/schema.prisma
# .env du web : DATABASE_URL=file:/home/pacadev/pacadev/web/db/custom.db
# (+ autres secrets, jamais commités)
```

## 5. Services systemd (user, linger activé)

Units : `~/.config/systemd/user/pacadev-web.service` et `pacadev-ws.service`
(linger `loginctl enable-linger pacadev`).

```bash
export XDG_RUNTIME_DIR=/run/user/1000
systemctl --user status  pacadev-web pacadev-ws
systemctl --user restart pacadev-web pacadev-ws
journalctl --user -u pacadev-ws   -f     # logs ws
journalctl --user -u pacadev-web  -f     # logs next dev
```

- `pacadev-web.service` : `ExecStartPre=/bin/rm -f web/.next/dev/lock` puis
  `next dev --port 3000` (Turbopack, HTTP 200).
- `pacadev-ws.service` : `node index.mjs` (Socket.io, port 3003, `path: '/'`).

## 6. Vérifications de santé

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://pacadev.local
curl -s -o /dev/null -w '%{http_code}\n' http://web.pacadev.local
curl -s http://localhost:3000/api/clients        # → JSON, 4 clients réels
curl -s http://localhost:3000/api/dashboard
curl -s "http://localhost:3003/?EIO=4&transport=polling"   # → "0{...}"
```

## 7. Points de vigilance (IMPORTANT)

- **Conflit gitlink `web/` — RÉSOLU** : la branche parallèle
  `dev/cli/gestion-modules` portait `web/` comme **gitlink** (une seule entrée)
  alors que `main` suit le code réel (181 fichiers). Un checkout dessus
  **supprimait les fichiers web/ du disque**. Le 2026-08-07, `origin/main` a été
  **mergé dans `dev/cli/gestion-modules`** (merge `9f8908a`) avec `web/` résolu
  vers le code réel → plus aucun risque de suppression au checkout. Procédure de
  restauration conservée au cas où le cas se reproduirait :
  ```bash
  git archive dev/web/restore-dashboard web | tar -x -C ~/pacadev
  # puis ré-écrire web/.env + web/db/custom.db (hors git)
  ```
- **Ne pas redémarrer `next` après un tel checkout** tant que les fichiers disque
  ne sont pas restaurés : le cache compilé sert encore les pages (HTTP 200)
  jusqu'au restart, qui échouerait ensuite.
- **`versions.json`** est la source des clients affichés (afrequip, mecafric,
  mecafric_water, sofetelec — maxelec retiré volontairement). Il est déjà à jour.
- `web/.env` et `web/db/custom.db` sont **hors git** (ignorés) : à restaurer
  manuellement après un clone/checkout frais.

## 8. Améliorations possibles (non faites)

- Passer `next dev` → `next build` + `start` (standalone) pour la prod.
- Précharger `db/custom.db` et `.env` dans le repo via un bootstrap script
  (aujourd'hui restaurés manuellement après un checkout gitlink).
