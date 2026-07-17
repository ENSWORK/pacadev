# Task 2-b: Client Space Button Wiring

## Summary
Wired up all 13 inactive buttons in the Client Space module (`src/components/modules/client-space.tsx`) with proper onClick handlers, toast feedback, dialogs, and local state management.

## Changes Made

### Imports Added
- `import { toast } from 'sonner'`
- Dialog components (Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle)
- Input component

### Imports Cleaned Up
- Removed unused type imports: GitBranchType, TicketType, Deployment
- Removed unused `format` from date-fns import
- Removed unused `syncStatusLabel` variable
- Removed unused `gateBranch` state variable

### Button Wiring Details

| # | Tab | Button | Handler |
|---|-----|--------|---------|
| 1 | FicheClient | Éditer config | toast("Fonctionnalité en cours de développement") |
| 2 | FicheClient | Voir réseau | Opens Dialog with Tailscale network info (IP, ACL, status) |
| 3 | FicheClient | Gérer accès | toast("Gestion des accès - Fonctionnalité en cours de développement") |
| 4 | Modules | Désactiver | toast + toggle status to 'disabled' in local state |
| 5 | Modules | Activer | toast.success + toggle status to 'installed' in local state |
| 6 | Modules | Diff | toast("Diff du module [name] - Fonctionnalité en cours de développement") |
| 7 | Modules | Upgrade | toast.success("Mise à jour lancée pour [name]") |
| 8 | Branches | Merge | Opens merge confirmation Dialog → toast.success("Branche mergée avec succès") |
| 9 | Branches | Créer branche | Opens Dialog with Input for name → toast.success("Branche créée") |
| 10 | Tickets | Commenter | toast("Commentaire ajouté") |
| 11 | Tickets | Statut | Cycles: open→in_progress→review→closed, updates local state |
| 12 | Tickets | Créer issue | toast.success("Issue créée avec succès") |
| 13 | Versions | Comparer | toast("Comparaison des versions en cours") |

### New State Variables
- FicheClient: `networkDialogOpen`
- ModulesTab: `localModules` (useState<ClientModule[]>)
- BranchesTab: `mergeDialogOpen`, `mergeBranchName`, `createBranchDialogOpen`, `newBranchName`
- TicketsTab: `localTickets` (useState), ExtendedTicketStatus type

### New Dialogs
1. **Network info dialog** — Shows Tailscale IP, ACL group, connection status
2. **Merge confirmation dialog** — Shows branch name, confirm/cancel
3. **Create branch dialog** — Input field for branch name, create/cancel

## Lint & Build
- ESLint: ✅ Zero errors
- Dev server: ✅ Compiles successfully
