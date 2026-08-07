# Task 2-e: Wire up inactive buttons in Pipeline module

## Summary
Wired all inactive/partially-wired buttons in `/home/z/my-project/src/components/modules/pipeline.tsx` with proper onClick handlers and toast feedback using `sonner`.

## Changes Made

1. **Added toast import**: `import { toast } from 'sonner'` at line 4

2. **HistoriquePipelines section**:
   - `handleReplay(pipeline)` → shows toast `Pipeline replay lancé pour [commitHash]`
   - `handleExport(pipeline)` → shows toast `Rapport exporté pour pipeline [commitHash]`

3. **LienValidationClient section**:
   - `handleCopy()` → uses `navigator.clipboard.writeText(mockUrl)` then shows toast `Lien copié dans le presse-papier`
   - "Voir statut / Masquer statut" — already working, verified

4. **SecurityGate section**:
   - "🔐 Voir Audit Log" — already working with `setCurrentView('audit')`, verified
   - `handleSecurityScan` → added `toast.success('Scan de sécurité terminé')` callback inside the setTimeout (after scanning completes at 2000ms)

5. **GateValidation section**:
   - `handleGateConfirm` → added `toast.success("Déploiement approuvé et enregistré dans l'audit")`
   - `handleRejectConfirm` → added `toast.success("Validation rejetée — action enregistrée dans l'audit")`

## Verification
- ESLint: ✅ Zero errors
- Dev server: ✅ Compiles successfully
- All existing code preserved, only added handlers and toast calls
