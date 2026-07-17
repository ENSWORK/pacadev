# Task 8-9: Module 3 (Pipeline & Déploiements) + Module 4 (Centre IA & Risque)

## Work Record

### Files Created
1. **`src/components/modules/pipeline.tsx`** — Module 3: Pipeline & Déploiements
2. **`src/components/modules/ai-center.tsx`** — Module 4: Centre IA & Risque

### Files Modified
1. **`src/app/page.tsx`** — Replaced PipelinePlaceholder and AIPlaceholder with actual module components

### Module 3: Pipeline & Déploiements (`pipeline.tsx`)
5 sections implemented:
1. **Pipeline en cours** — Displays running pipelines (pipe_002, pipe_004) using PipelineTimeline component, with expandable live logs section showing mock log output, and per-step "Relancer étape" buttons. Shows "Aucun pipeline en cours" when none running.
2. **Historique pipelines** — Full table of all mockPipelines showing Commit, Branche, Déclencheur, Étapes (as mini StatusBadges), Durée, Statut, with Replay/Export action buttons.
3. **Boutons d'automatisation** — 3 toggle switches (Auto-merge, Auto-deploy staging, Auto-rollback) using shadcn Switch component with icons and descriptions. Defaults from mockAIConfig.
4. **Gate de validation** — 2 pending approvals with client name, environment, version tag, triggered by. "Approuver" opens GateModal, "Rejeter" opens dialog with reason field.
5. **Lien validation client** — Shows generated validation URL, expiry date, active/revoked status. Buttons: Générer lien, Révoquer, Voir statut. Copy URL functionality.

### Module 4: Centre IA & Risque (`ai-center.tsx`)
5 sections implemented:
1. **Score risque en temps réel** — RiskGauge component for selected client (default: acmecorp). Client selector dropdown. Risk factors shown as horizontal progress bars (schema, security, deps, business logic). Recommendation badge. Override button for Lead+ roles. Explanation text.
2. **Suggestions IA** — Cards for each mockSuggestions with type badges (color-coded), title, description, scrollable code diff with syntax-like highlighting (red for removed, green for added, amber for @@), impact assessment. Three action buttons: Appliquer (with PR warning dialog), Ignorer, Modifier prompt. Filter by status (pending/applied/ignored).
3. **Contexte envoyé à l'IA** — 3-column grid: Files in scope (8 mock paths), .aiignore rules (4 patterns), Conventions (3 rules). Edit scope dialog and prompt history dialog.
4. **Historique décisions IA** — AuditTable component filtered to AI-related actions (deploy, ai_config, approve, rollback).
5. **Configuration modèles** — Form with Model selector (Claude 3.5 Sonnet, GPT-4o, Ollama local), Max tokens input, Fallback model dropdown, Cost threshold input, Token usage progress bar. Save button.

### Design Decisions
- All text in French
- No indigo/blue colors — used emerald, amber, red, orange throughout
- Responsive grid layouts (lg:grid-cols-2 for side-by-side sections)
- Used all 5 shared components: StatusBadge, RiskGauge, PipelineTimeline, GateModal, AuditTable
- Custom scrollbar styling class for code/log areas
- Proper TypeScript typing throughout
- Used date-fns with French locale for date formatting

### Quality Checks
- ESLint: ✅ No errors
- Dev server: ✅ Compiled successfully, no errors
