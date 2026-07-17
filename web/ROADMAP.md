# PACADEV Web UI — Feuille de route d'intégration réelle
**Version**: 1.1 | **Basé sur**: PACADEV_Specifications_Techniques.docx + état du code

---

## État actuel (15 mai 2026)

| Module | API réelle | Données UI | Boutons |
|--------|-----------|-----------|---------|
| Dashboard | ✅ | ⚠️ partiellement (services mock) | ⚠️ |
| Espace Client — Fiche | ✅ | ✅ | ⚠️ |
| Espace Client — Modules | ✅ | ❌ (mock statique) | ❌ mauvais endpoint |
| Espace Client — Branches | ❌ endpoint manquant | ❌ | ❌ |
| Espace Client — Tickets | ✅ | ✅ | ⚠️ |
| Espace Client — Versions | ✅ | ❌ (mock deployments) | ⚠️ |
| Workspace — Tickets | ✅ | ✅ | ⚠️ |
| Workspace — Work Starter | ✅ | ✅ | ⚠️ |
| Workspace — Workflow | ✅ | ✅ | — |
| Pipeline CI/CD | ✅ | ❌ (mock pipelines) | ⚠️ |
| IA & Risque | ✅ | ❌ (mock) | ⚠️ |
| Backup | ✅ | ❌ (mock) | ⚠️ |
| Observabilité | ✅ | ⚠️ | ⚠️ |
| Audit | ✅ | ✅ | ✅ |
| WebSocket | ⚠️ timeout (Caddy absent) | — | — |

---

## PHASE A — Correctifs critiques (bloquants)

### A1 — WebSocket : corriger l'URL de connexion
**Fix**: connexion directe `http://localhost:3003` en dev, gateway Caddy en prod.
**Fichier**: `src/hooks/use-websocket.ts`
**Status**: ✅ Fait

### A2 — Espace Client Modules : afficher les vrais modules
**Fix**: `useEffect` + `useState` + fetch `/api/clients/{slug}/modules` dans `ModulesTab`.
**Résultat**: 108 modules OCA + 1 ens_core affichés pour afrequip.
**Status**: ✅ Fait

### A3 — Espace Client Branches : endpoint + affichage
**Fix**: `getClientBranches(slug)` + `/api/clients/[slug]/branches/route.ts` + fetch dans `BranchesTab`.
**Résultat**: 4 branches réelles (dev/afrequip/3-*, dev/afrequip/4-*, main, staging).
**Status**: ✅ Fait

### A4 — Espace Client Versions : remplacer mockDeployments
**Fix**: `useEffect` + fetch `/api/clients/{slug}/versions` + nouveau layout (cards état + table historique).
**Status**: ✅ Fait

---

## PHASE B — Données manquantes dans les vues principales

### B1 — Dashboard Services : vrais containers Docker
**Fix**: `useState` + fetch `/api/services` au mount dans `DashboardGlobal`.
**Résultat**: 15 containers Docker réels affichés.
**Status**: ✅ Fait

### B2 — Pipeline CI/CD : vrais pipelines GitHub Actions
**Fix**: fetch global multi-clients dans `DataLoader` (page.tsx) + store Zustand `realPipelines`.
**Status**: ✅ Fait

### B3 — IA & Risque : données réelles CI
**Fix**: `ScoreRisqueTempsReel` fetch `/api/clients/{slug}/ai/risk` à chaque changement de client. Spinner loading + fallback mock.
**Status**: ✅ Fait

### B4 — Backup : vrais backups PACADEV
**Fix**: `BackupModule` fetch par client au mount, `realBackups` state remplace `mockBackups` quand dispo.
**Status**: ✅ Fait

---

## PHASE C — Boutons et actions

### C1 — ModulesTab : corriger les boutons d'action
**Fix**: fetch `/api/clients/{slug}/modules/action` pour Activer/Désactiver, Diff, Upgrade via `/work/start`.
**Status**: ✅ Fait

### C2 — BranchesTab : corriger les boutons Merge / Supprimer
**Fix**: Gate modal → `POST /branches` (merge) et `DELETE /branches` (delete).
**Status**: ✅ Fait

### C3 — WorkStarterTab : wirer "Démarrer la session"
**Fix**: fetch modules réels au changement de ticket, `realModules: ClientModule[]`.
**Status**: ✅ Fait

### C4 — Pipeline : boutons Retrigger / Annuler
**Status**: ✅ Déjà branché sur `pipelineApi.retrigger` + endpoint `/pipeline/retrigger` existe.

---

## PHASE D — WebSocket événements temps réel

### D1 — Dashboard : abonnement alertes en temps réel
**Fix**: `WebSocketProvider` subscribe `alert:new` → `useAppStore.setState` incrémente `unreadAlerts`.
**Status**: ✅ Fait

### D2 — Observabilité : logs SSE
**Fix**: `EventSource` sur `/api/clients/{slug}/logs/stream` quand client sélectionné, badge LIVE, 200 entrées max.
**Status**: ✅ Fait

### D3 — Métriques temps réel
L'endpoint SSE `/api/clients/{slug}/metrics/stream` existe.
Brancher les graphiques Recharts sur le stream.
**Status**: ☐ Optionnel (métriques actuellement statiques)

---

## Ordre d'exécution recommandé

```
A1 → A2 → A3 → A4 → B1 → B2 → C1 → C2 → C3 → D1 → D2 → B3 → B4 → C4 → D3
```

Les phases A sont bloquantes pour la démonstration client.
Les phases B/C/D sont des améliorations progressives.
