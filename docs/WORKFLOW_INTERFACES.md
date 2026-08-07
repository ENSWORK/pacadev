# Travailler sur opencode et VS Code — Méthode multi-interface

> Ce document est la **référence de la méthode de travail** : comment passer d'une
> interface à l'autre (opencode ici, opencode sur le serveur, VS Code) sans perdre
> la traçabilité ni l'historique, et comment **reprendre exactement au même point**.

## 1. Principe fondamental : UNE seule source de vérité

Tout le travail vit dans **le repo git sur le serveur** `pacadev` (`~/pacadev`).
Peu importe l'interface utilisée, on touche **les mêmes fichiers, le même git,
la même mémoire**. Il n'existe aucune copie de travail séparée → aucune divergence
possible.

**Règle d'or : ne JAMAIS travailler sur le lecteur `M:` comme copie de travail.**
La vue `M:` est un cache périmé (fichiers fantômes observés). Tout passe par le
serveur, via SSH.

Le dashboard web PACADEV suit la même règle : le code vit dans `web/` sur `main`.
Voir `docs/WEB_DEPLOYMENT.md` pour son déploiement et sa maintenance.

## 2. Les 3 interfaces d'accès au serveur

| Interface | Connexion | Usage recommandé |
|---|---|---|
| **opencode (PC)** | opencode sur le PC + `ssh pacadev "cd ~/pacadev && ..."` | Pilotage IA / CLI depuis le PC |
| **opencode (serveur)** | Terminal SSH → `cd ~/pacadev && opencode` | Pilotage IA / CLI directement sur la machine |
| **VS Code** | Extension **Remote-SSH** → `pacadev` → ouvrir `/home/pacadev/pacadev` | Édition manuelle + terminal intégré |

Les trois pointent vers `/home/pacadev/pacadev` : le même working tree, le même
état git, la même configuration opencode (`opencode.json`, `AGENTS.md`,
`.opencode/` — le tout versionné dans le repo).

## 3. Traçabilité et reprise = 3 mécanismes complémentaires

1. **FSM (machine à états)** — `pacadev work status` indique pour chaque client :
   statut (dev/review/done), branche, issue. C'est le **point de reprise officiel**.
2. **Git** — historique complet : branches, commits, et `git status` pour les
   modifications en cours. Rien n'est perdu à l'arrêt : les fichiers sont déjà sur
   le serveur.
3. **Mémoire Mem0** — contexte IA partagé (règles Odoo, 6 clients, historique des
   corrections), stockée sur le serveur (`~/.pacadev/memory/`) et visible par
   toutes les interfaces via `pacadev memory search`.

## 4. Procédure d'arrêt / reprise

### À l'arrêt (peu importe l'interface)

- Aucune action nécessaire : tout est déjà sur le serveur (fichiers + git).
- Optionnel : mettre à jour l'état FSM (`pacadev work status` reflète le travail
  en cours).

### À la reprise (sur n'importe quelle interface)

```bash
ssh pacadev "cd ~/pacadev && pacadev work status"   # 1. où on en est (client/issue/branche)
ssh pacadev "cd ~/pacadev && git status"            # 2. modifications en cours
ssh pacadev "cd ~/pacadev && git log --oneline -5"  # 3. dernier travail effectué
```

Puis poursuivre le travail au même endroit (branche = point de reprise).

## 5. Bascule d'interface en cours de travail

1. Vérifier que l'autre interface n'a **pas** de session ouverte sur le serveur
   (une seule interface travaille à la fois sur le repo — pas de concurrence
   d'écriture).
2. Reprendre sur l'autre interface avec la procédure de reprise (section 4).
3. L'état (working tree, branches, mémoire) est identique partout.

## 6. Conventions de travail

- L'orchestration IA reste **opencode + CLI `pacadev`** (FSM, deploy, backup).
- VS Code sert à l'**édition manuelle** et au **terminal SSH intégré** (qui est
  déjà connecté au serveur : on peut y lancer `pacadev` directement).
- Toute action infra/client passe par la CLI `pacadev`, jamais en direct
  (`docker exec`, etc.).
- Préférer les commandes slash : `/work`, `/review`, `/commit`, `/deploy`,
  `/health`, `/ai`.
- Vérifier la santé avant/après chaque déploiement : `pacadev health --all`.
- Ne jamais committer de secrets (`.env`, tokens) — `gitleaks` est actif en CI.
- Toute nouvelle commande/option de la CLI doit être reportée dans
  `docs/CLI_REFERENCE.md` (régénération depuis `pacadev --help`).

## 7. Points de vigilance

- **M: périmé** : ne pas utiliser comme copie de travail.
- **Une seule interface écrivante à la fois** : éviter deux sessions en parallèle
  sur le repo.
- **Branches** : travailler sur une branche `dev/<client>/<issue>-<slug>` et
  ouvrir une PR vers `main` ; ne pas merger tant que le pipeline n'est pas vert.
- **CI Lint** ne scanne que `v17/clients/*/addons/ens_core/**` (ruff `--select
  E,F,W` + xmllint) : tout module nouveau dans `ens_core` doit passer `ruff check`
  et avoir un manifest `17.0.x.x.x` valide avant push.
- **⚠ Gitlink `web/` sur `dev/cli/gestion-modules`** : sur cette branche `web/`
  est un gitlink (une entrée) alors que `main` suit le code réel. Un checkout sur
  le gitlink **efface les fichiers web/ du disque** — restaurer via
  `git archive dev/web/restore-dashboard web | tar -x -C ~/pacadev` (+ `web/.env`
  et `web/db/custom.db`) et ne pas redémarrer `next` avant la restauration.

## 8. Web PACADEV (dashboard)

Déployé sur le serveur (Next.js :3000 + WebSocket :3003, derrière Traefik).
Documentation complète : **`docs/WEB_DEPLOYMENT.md`** (architecture, prérequis
serveur, units systemd, santé, points de vigilance).

État au 2026-08-07 : restauré sur `main` (PR #14), pipeline vert (PR #15),
ws-service avec collecte Docker **asynchrone** (event loop non bloquée).
