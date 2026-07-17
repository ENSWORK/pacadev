'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Ticket,
  Plus,
  Minus,
  Play,
  Terminal,
  RotateCcw,
  GitBranch,
  GitPullRequest,
  Eye,
  MessageSquare,
  RefreshCw,
  XCircle,
  CheckCircle2,
  ShieldCheck,
  Link2,
  Copy,
  Save,
  FileText,
  Search,
  Rocket,
  Loader2,
  Database,
  Code2,
  Shield,
  Gauge,
  ChevronDown,
  ExternalLink,
  Clock,
  User,
  FolderGit2,
  Zap,
  Bell,
  AlertTriangle,
  Send,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkflowProgressBar } from '@/components/shared/workflow-progress-bar'
import { PermissionGuard } from '@/components/shared/permission-guard'
import { useAppStore } from '@/lib/store'
import type { RealTicket } from '@/lib/store'
import type { Ticket as MockTicketType } from '@/lib/mock-data'
import type { TicketType as TicketKind, WorkflowStepStatus, ClientModule } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/use-async-action'
import { issueApi, workApi } from '@/lib/api'

type TicketType = RealTicket | MockTicketType

// ============ Constants ============

const DESCRIPTION_TEMPLATE = `## Contexte
[Décrire le contexte]

## Comportement attendu
[Décrire le comportement attendu]

## Étapes pour reproduire
1. 

## Impact technique
- [ ] Base de données
- [ ] XML/Views
- [ ] Sécurité
- [ ] Performance`

const TICKET_TYPES: { value: TicketKind; label: string; color: string }[] = [
  { value: 'feature', label: 'Feature', color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'bug', label: 'Bug', color: 'text-red-600 dark:text-red-400' },
  { value: 'hotfix', label: 'Hotfix', color: 'text-amber-600 dark:text-amber-400' },
  { value: 'refacto', label: 'Refacto', color: 'text-violet-600 dark:text-violet-400' },
]

const WORKFLOW_STEPS_DEF = [
  { id: 'ticket', label: '🎫 Ticket créé', emoji: '🎫' },
  { id: 'development', label: '💻 Développement', emoji: '💻' },
  { id: 'cicd', label: '🔄 CI/CD', emoji: '🔄' },
  { id: 'staging', label: '🚀 Staging', emoji: '🚀' },
  { id: 'validation', label: '✅ Validation', emoji: '✅' },
  { id: 'production', label: '📦 Production', emoji: '📦' },
] as const

// ============ Mock workflow states per ticket ============
const mockWorkflowStates: Record<number, { id: string; label: string; status: WorkflowStepStatus; details?: string; responsible?: string; since?: string }[]> = {
  142: [
    { id: 'ticket', label: '🎫 Ticket créé', status: 'completed', details: 'Ticket créé par dev@enswork.com', responsible: 'dev@enswork.com', since: '2026-05-01T10:00:00Z' },
    { id: 'development', label: '💻 Développement', status: 'completed', details: 'Branche dev/feature-142 fusionnée', responsible: 'dev@enswork.com', since: '2026-05-02T09:00:00Z' },
    { id: 'cicd', label: '🔄 CI/CD', status: 'completed', details: 'Pipeline pipe_001 réussi (4m 05s)', responsible: 'Système CI', since: '2026-05-13T12:00:00Z' },
    { id: 'staging', label: '🚀 Staging', status: 'completed', details: 'Déployé sur staging acmecorp-staging.enswork.local', responsible: 'admin@enswork.com', since: '2026-05-13T13:00:00Z' },
    { id: 'validation', label: '✅ Validation', status: 'completed', details: 'Validé par contact@acmecorp.com', responsible: 'contact@acmecorp.com', since: '2026-05-13T14:00:00Z' },
    { id: 'production', label: '📦 Production', status: 'in_progress', details: 'Déploiement en cours...', responsible: 'admin@enswork.com', since: '2026-05-13T14:30:00Z' },
  ],
  143: [
    { id: 'ticket', label: '🎫 Ticket créé', status: 'completed', details: 'Ticket créé par dev@enswork.com', responsible: 'dev@enswork.com', since: '2026-05-12T09:00:00Z' },
    { id: 'development', label: '💻 Développement', status: 'in_progress', details: 'Branche dev/fix-143 en cours', responsible: 'dev@enswork.com', since: '2026-05-12T10:00:00Z' },
    { id: 'cicd', label: '🔄 CI/CD', status: 'pending', details: 'En attente de push', responsible: '—', since: undefined },
    { id: 'staging', label: '🚀 Staging', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'validation', label: '✅ Validation', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'production', label: '📦 Production', status: 'pending', details: undefined, responsible: '—', since: undefined },
  ],
  144: [
    { id: 'ticket', label: '🎫 Ticket créé', status: 'completed', details: 'Ticket créé', responsible: '—', since: '2026-05-13T08:00:00Z' },
    { id: 'development', label: '💻 Développement', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'cicd', label: '🔄 CI/CD', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'staging', label: '🚀 Staging', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'validation', label: '✅ Validation', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'production', label: '📦 Production', status: 'pending', details: undefined, responsible: '—', since: undefined },
  ],
  56: [
    { id: 'ticket', label: '🎫 Ticket créé', status: 'completed', details: 'Ticket créé par lead@enswork.com', responsible: 'lead@enswork.com', since: '2026-05-05T14:00:00Z' },
    { id: 'development', label: '💻 Développement', status: 'in_progress', details: 'Branche dev/integration active', responsible: 'lead@enswork.com', since: '2026-05-06T09:00:00Z' },
    { id: 'cicd', label: '🔄 CI/CD', status: 'failed', details: 'Étape de sécurité échouée — CVE détecté', responsible: 'Système CI', since: '2026-05-12T16:00:00Z' },
    { id: 'staging', label: '🚀 Staging', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'validation', label: '✅ Validation', status: 'pending', details: undefined, responsible: '—', since: undefined },
    { id: 'production', label: '📦 Production', status: 'pending', details: undefined, responsible: '—', since: undefined },
  ],
}

// ============ Mock notifications ============
const mockNotifications = [
  { id: 'n1', message: 'Pipeline #pipe_001 réussi pour acmecorp', time: '14:35', type: 'success' as const },
  { id: 'n2', message: 'Validation client reçue pour ticket #142', time: '14:00', type: 'success' as const },
  { id: 'n3', message: 'CI/CD échoué pour ticket #56 — sécurité', time: '16:00', type: 'error' as const },
  { id: 'n4', message: 'Branche dev/feature-142 fusionnée dans main', time: '12:30', type: 'info' as const },
  { id: 'n5', message: 'Déploiement staging acmecorp en cours', time: '13:05', type: 'info' as const },
]

// ============ Helpers ============
function getClientName(slug: string): string {
  const { realClients } = useAppStore.getState()
  const all = realClients
  return all.find((c) => c.slug === slug)?.name ?? slug
}

function getOdooVersion(slug: string): string {
  const { realClients } = useAppStore.getState()
  const all = realClients
  return all.find((c) => c.slug === slug)?.odooVersion ?? '17'
}

function slugToBranchName(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ============ Tab 1: Ticket Creator ============
function TicketCreatorTab() {
  const { selectedClientSlug, setSelectedClientSlug, realClients, realTickets } = useAppStore()
  const effectiveClients = realClients
  const effectiveTickets = realTickets
  const { loading: createLoading, execute: executeCreate } = useAsyncAction()
  const { loading: draftLoading, execute: executeDraft } = useAsyncAction()

  // Load last draft lazily for initial state
  const loadDraft = useCallback(() => {
    try {
      const drafts = JSON.parse(localStorage.getItem('pacadev_drafts') ?? '[]')
      if (drafts.length > 0) return drafts[drafts.length - 1]
    } catch { /* ignore */ }
    return null
  }, [])

  const lastDraft = useMemo(() => loadDraft(), [loadDraft])

  const [clientSlug, setClientSlug] = useState<string>(lastDraft?.clientSlug ?? selectedClientSlug ?? '')
  const [ticketType, setTicketType] = useState<TicketKind>(lastDraft?.ticketType ?? 'feature')
  const [selectedModule, setSelectedModule] = useState<string>(lastDraft?.selectedModule ?? '')
  const [title, setTitle] = useState<string>(lastDraft?.title ?? '')
  const [description, setDescription] = useState<string>(lastDraft?.description ?? DESCRIPTION_TEMPLATE)
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>(lastDraft?.acceptanceCriteria ?? [''])
  const [impactFlags, setImpactFlags] = useState(lastDraft?.impactFlags ?? { db: false, xml: false, security: false, performance: false })
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)

  // Available modules fetched from API
  const [availableModules, setAvailableModules] = useState<{ id?: string; name: string; technicalName?: string; source?: string; status?: string }[]>([])
  useEffect(() => {
    if (!clientSlug) { setAvailableModules([]); return }
    fetch(`/api/clients/${clientSlug}/modules`)
      .then(r => r.json())
      .then(d => { if (d.success) setAvailableModules(d.data) })
      .catch(() => {})
  }, [clientSlug])

  // Auto-prefix title
  const autoPrefix = useMemo(() => {
    const parts: string[] = []
    if (clientSlug) parts.push(clientSlug.toUpperCase())
    if (selectedModule) parts.push(selectedModule.toUpperCase())
    return parts.length > 0 ? `[${parts.join('][')}] ` : ''
  }, [clientSlug, selectedModule])

  // All tickets for duplicate selection
  const allTickets = useMemo(() => {
    const tickets: (TicketType & { clientSlug: string })[] = []
    for (const [slug, clientTickets] of Object.entries(effectiveTickets)) {
      for (const t of clientTickets) {
        tickets.push({ ...t, clientSlug: slug })
      }
    }
    return tickets
  }, [effectiveTickets])

  const handleClientChange = (slug: string) => {
    setClientSlug(slug)
    setSelectedClientSlug(slug)
    setSelectedModule('')
  }

  const addCriterion = () => setAcceptanceCriteria([...acceptanceCriteria, ''])
  const removeCriterion = (index: number) => {
    if (acceptanceCriteria.length <= 1) return
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== index))
  }
  const updateCriterion = (index: number, value: string) => {
    const updated = [...acceptanceCriteria]
    updated[index] = value
    setAcceptanceCriteria(updated)
  }

  const handleCreateGitHub = () => {
    if (!clientSlug || !title.trim()) return
    executeCreate(
      () => issueApi.create(clientSlug, selectedModule, `${autoPrefix}${title}`, ticketType),
      { successMessage: `Ticket créé sur GitHub pour ${getClientName(clientSlug)}` }
    )
  }

  const handleSaveDraft = () => {
    executeDraft(async () => {
      const draft = {
        clientSlug,
        ticketType,
        selectedModule,
        title,
        description,
        acceptanceCriteria,
        impactFlags,
        savedAt: new Date().toISOString(),
      }
      const existing = JSON.parse(localStorage.getItem('pacadev_drafts') ?? '[]')
      existing.push(draft)
      localStorage.setItem('pacadev_drafts', JSON.stringify(existing))
      return draft
    }, { successMessage: 'Brouillon sauvegardé dans le navigateur' })
  }

  const handleDuplicate = (ticket: TicketType & { clientSlug: string }) => {
    setClientSlug(ticket.clientSlug)
    setSelectedClientSlug(ticket.clientSlug)
    setTitle(ticket.title)
    setDescription(DESCRIPTION_TEMPLATE)
    setDuplicateDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Main form card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ticket className="size-5 text-emerald-600 dark:text-emerald-400" />
            Créer un ticket guidé
          </CardTitle>
          <CardDescription>
            Remplissez le formulaire pour créer un ticket structuré sur GitHub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1: Client + Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-client">Client *</Label>
              <Select value={clientSlug} onValueChange={handleClientChange}>
                <SelectTrigger id="ticket-client">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {effectiveClients.map((client) => (
                    <SelectItem key={client.slug} value={client.slug}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type de ticket *</Label>
              <RadioGroup value={ticketType} onValueChange={(v) => setTicketType(v as TicketKind)} className="flex flex-wrap gap-2 pt-1">
                {TICKET_TYPES.map((type) => (
                  <Label
                    key={type.value}
                    htmlFor={`type-${type.value}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer transition-colors text-sm',
                      ticketType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={type.value} id={`type-${type.value}`} className="sr-only" />
                    <span className={cn('font-medium', type.color)}>{type.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </div>

          {/* Row 2: Module */}
          <div className="space-y-2">
            <Label htmlFor="ticket-module">Module concerné</Label>
            <Select value={selectedModule} onValueChange={setSelectedModule} disabled={!clientSlug}>
              <SelectTrigger id="ticket-module">
                <SelectValue placeholder={clientSlug ? 'Sélectionner un module' : "Sélectionnez d'abord un client"} />
              </SelectTrigger>
              <SelectContent>
                {availableModules.map((mod) => (
                  <SelectItem key={mod.id ?? mod.name} value={mod.name}>
                    <span className="flex items-center gap-2">
                      {mod.name}
                      <Badge variant="outline" className="text-[10px] h-4 ml-1">
                        {mod.source === 'oca' ? 'OCA' : mod.source ?? 'Custom'}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
                {availableModules.length === 0 && clientSlug && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Aucun module disponible
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Title with auto-prefix */}
          <div className="space-y-2">
            <Label htmlFor="ticket-title">Titre *</Label>
            <div className="flex items-center gap-2">
              {autoPrefix && (
                <span className="shrink-0 text-xs font-mono bg-muted px-2 py-2.5 rounded-md border text-muted-foreground">
                  {autoPrefix}
                </span>
              )}
              <Input
                id="ticket-title"
                placeholder="Titre du ticket"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Préfixe auto : {autoPrefix || '(sélectionnez client et module)'}
            </p>
          </div>

          {/* Row 4: Description */}
          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[240px] font-mono text-sm"
              placeholder="Description du ticket en Markdown"
            />
          </div>

          {/* Row 5: Acceptance Criteria */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Critères d&apos;acceptation</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addCriterion}
              >
                <Plus className="size-3" />
                Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {acceptanceCriteria.map((criterion, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                    {index + 1}.
                  </span>
                  <Input
                    value={criterion}
                    onChange={(e) => updateCriterion(index, e.target.value)}
                    placeholder="Critère d'acceptation"
                    className="flex-1 h-9 text-sm"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 shrink-0 text-muted-foreground hover:text-red-500"
                        onClick={() => removeCriterion(index)}
                        disabled={acceptanceCriteria.length <= 1}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer ce critère</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>

          {/* Row 6: Impact checkboxes */}
          <div className="space-y-3">
            <Label>Impact technique</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'db' as const, label: 'Base de données', icon: Database },
                { key: 'xml' as const, label: 'XML/Views', icon: Code2 },
                { key: 'security' as const, label: 'Sécurité', icon: Shield },
                { key: 'performance' as const, label: 'Performance', icon: Gauge },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <Label
                    key={item.key}
                    htmlFor={`impact-${item.key}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2.5 cursor-pointer transition-colors',
                      impactFlags[item.key]
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <Checkbox
                      id={`impact-${item.key}`}
                      checked={impactFlags[item.key]}
                      onCheckedChange={(checked) =>
                        setImpactFlags({ ...impactFlags, [item.key]: !!checked })
                      }
                    />
                    <Icon className={cn(
                      'size-3.5',
                      impactFlags[item.key] ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Label>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <PermissionGuard role="dev" fallback="disable">
              <Button
                className="gap-1.5"
                disabled={createLoading || !clientSlug || !title.trim()}
                onClick={handleCreateGitHub}
              >
                {createLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GitBranch className="size-4" />
                )}
                Créer sur GitHub
              </Button>
            </PermissionGuard>

            <Button
              variant="outline"
              className="gap-1.5"
              disabled={draftLoading}
              onClick={handleSaveDraft}
            >
              {draftLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Sauvegarder brouillon
            </Button>

            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setDuplicateDialogOpen(true)}
            >
              <Copy className="size-4" />
              Dupliquer depuis ticket
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="size-5 text-primary" />
              Dupliquer depuis un ticket existant
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un ticket existant comme modèle. Le titre et la description seront pré-remplis.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar">
            {allTickets.map((ticket) => (
              <button
                key={`${ticket.clientSlug}-${ticket.id}`}
                type="button"
                className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                onClick={() => handleDuplicate(ticket)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">
                    #{ticket.id} — {ticket.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                    {getClientName(ticket.clientSlug)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {ticket.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="text-[10px] h-4">
                      {label}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
            {allTickets.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Aucun ticket disponible
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ Tab 2: Work Starter ============
function WorkStarterTab() {
  const { selectedTicketId, setSelectedTicketId, selectedClientSlug, realClients, realTickets } = useAppStore()
  const effectiveClients = realClients
  const effectiveTickets = realTickets
  const { loading: startLoading, execute: executeStart } = useAsyncAction()
  const { loading: resumeLoading, execute: executeResume } = useAsyncAction()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<(TicketType & { clientSlug: string }) | null>(null)
  const [branchName, setBranchName] = useState('')
  const [cloneDb, setCloneDb] = useState(false)
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [aiContext, setAiContext] = useState(true)
  const [showCli, setShowCli] = useState(false)

  // All tickets flattened
  const allTickets = useMemo(() => {
    const tickets: (TicketType & { clientSlug: string })[] = []
    for (const [slug, clientTickets] of Object.entries(effectiveTickets)) {
      for (const t of clientTickets) {
        tickets.push({ ...t, clientSlug: slug })
      }
    }
    return tickets
  }, [effectiveTickets])

  // Filter tickets by search
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return allTickets
    const q = searchQuery.toLowerCase().replace('#', '')
    return allTickets.filter(
      (t) =>
        String(t.id).includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.clientSlug.toLowerCase().includes(q)
    )
  }, [searchQuery, allTickets])

  // Client modules for the selected ticket (fetched from API)
  const [realModules, setRealModules] = useState<ClientModule[]>([])
  useEffect(() => {
    if (!selectedTicket) return
    fetch(`/api/clients/${selectedTicket.clientSlug}/modules`)
      .then(r => r.json())
      .then(d => { if (d.success) setRealModules(d.data) })
      .catch(() => {})
  }, [selectedTicket?.clientSlug])

  const clientModules = useMemo(() => {
    if (!selectedTicket) return []
    return realModules
  }, [selectedTicket, realModules])

  // Auto-detect Odoo version
  const odooVersion = useMemo(() => {
    if (!selectedTicket) return '—'
    return getOdooVersion(selectedTicket.clientSlug)
  }, [selectedTicket])

  // Auto-suggest branch name (computed from selectedTicket)
  const suggestedBranchName = useMemo(() => {
    if (!selectedTicket) return ''
    const clientPart = slugToBranchName(selectedTicket.clientSlug)
    const titlePart = selectedTicket.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 30)
    return `dev/${clientPart}/${selectedTicket.id}-${titlePart}`
  }, [selectedTicket])

  // Pre-selected modules for the ticket (from API or mock)
  const defaultModules = useMemo(() => {
    if (!selectedTicket) return []
    return realModules.filter((m) => m.status === 'installed').slice(0, 3).map((m) => m.name)
  }, [selectedTicket, realModules])

  const handleSelectTicket = (ticket: TicketType & { clientSlug: string }) => {
    setSelectedTicket(ticket)
    setSelectedTicketId(ticket.id)
    setSearchQuery(`#${ticket.id}`)
    // Set branch name and modules when ticket is selected
    const clientPart = slugToBranchName(ticket.clientSlug)
    const titlePart = ticket.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 30)
    setBranchName(`dev/${clientPart}/${ticket.id}-${titlePart}`)
    setSelectedModules([])
  }

  const toggleModule = (moduleName: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleName)
        ? prev.filter((m) => m !== moduleName)
        : [...prev, moduleName]
    )
  }

  const handleStart = () => {
    if (!selectedTicket) return
    executeStart(
      () => workApi.start(selectedTicket.clientSlug, selectedTicket.id, selectedModules[0]),
      { successMessage: `Environnement démarré pour ${getClientName(selectedTicket.clientSlug)} — ticket #${selectedTicket.id}` }
    )
  }

  const handleResume = () => {
    executeResume(async () => {
      // Simulate restoring last session
      await new Promise((r) => setTimeout(r, 800))
      return { branch: branchName, restored: true }
    }, { successMessage: `Session précédente restaurée — branche ${branchName}` })
  }

  const cliCommand = selectedTicket
    ? `pacadev work start --issue #${selectedTicket.id} --client ${selectedTicket.clientSlug}${selectedModules.length > 0 ? ` --module ${selectedModules[0]}` : ''}`
    : 'pacadev work start --issue #<ticket> --client <slug>'

  return (
    <div className="space-y-6">
      {/* Ticket search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="size-5 text-emerald-600 dark:text-emerald-400" />
            Rechercher un ticket
          </CardTitle>
          <CardDescription>
            Recherchez par numéro (#) ou texte pour sélectionner le ticket à traiter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (#142, bug, acmecorp...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Ticket list */}
          {searchQuery.trim() && !selectedTicket && (
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y custom-scrollbar">
              {filteredTickets.map((ticket) => (
                <button
                  key={`${ticket.clientSlug}-${ticket.id}`}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectTicket(ticket)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      #{ticket.id} — {ticket.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                      {getClientName(ticket.clientSlug)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] h-4',
                        ticket.status === 'in_progress' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                        ticket.status === 'open' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                        ticket.status === 'closed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                      )}
                    >
                      {ticket.status === 'in_progress' ? 'En cours' : ticket.status === 'open' ? 'Ouvert' : 'Fermé'}
                    </Badge>
                    {ticket.assignee && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="size-3" />
                        {ticket.assignee}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {filteredTickets.length === 0 && (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  Aucun ticket trouvé
                </div>
              )}
            </div>
          )}

          {/* Selected ticket details */}
          {selectedTicket && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  #{selectedTicket.id} — {selectedTicket.title}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 text-muted-foreground"
                  onClick={() => {
                    setSelectedTicket(null)
                    setSearchQuery('')
                    setSelectedTicketId(null)
                    setBranchName('')
                    setSelectedModules([])
                  }}
                >
                  <XCircle className="size-4" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FolderGit2 className="size-3.5" />
                  <span>Client : <span className="font-medium text-foreground">{getClientName(selectedTicket.clientSlug)}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="size-3.5" />
                  <span>Assigné : <span className="font-medium text-foreground">{selectedTicket.assignee ?? 'Non assigné'}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>Créé : <span className="font-medium text-foreground">{formatDate(selectedTicket.createdAt)}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedTicket.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="text-[10px] h-4">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration (shown when ticket selected) */}
      {selectedTicket && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Terminal className="size-5 text-emerald-600 dark:text-emerald-400" />
                Configuration de l&apos;environnement
              </CardTitle>
              <CardDescription>
                Configurez les paramètres de démarrage pour ce ticket
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Branch name */}
              <div className="space-y-2">
                <Label htmlFor="branch-name">Nom de la branche</Label>
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-muted-foreground shrink-0" />
                  <Input
                    id="branch-name"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Convention : dev/&#123;client&#125;/&#123;ticketId&#125;-&#123;feature_name&#125;
                </p>
              </div>

              {/* Odoo version (auto-detected) */}
              <div className="space-y-2">
                <Label>Version Odoo (auto-détectée)</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm h-8 px-3 font-mono">
                    Odoo {odooVersion}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Détectée depuis la configuration client
                  </span>
                </div>
              </div>

              {/* Clone DB */}
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-md bg-muted shrink-0">
                    <Database className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <Label htmlFor="clone-db" className="text-sm font-medium cursor-pointer">
                      Cloner DB de prod
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Copier la base de production vers staging pour des données réalistes
                    </p>
                  </div>
                </div>
                <Switch
                  id="clone-db"
                  checked={cloneDb}
                  onCheckedChange={setCloneDb}
                />
              </div>

              {/* Modules to load */}
              <div className="space-y-2">
                <Label>Modules à charger</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {clientModules.map((mod) => (
                    <Label
                      key={mod.id}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors',
                        selectedModules.includes(mod.name)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <Checkbox
                        checked={selectedModules.includes(mod.name)}
                        onCheckedChange={() => toggleModule(mod.name)}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{mod.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {mod.source === 'oca' ? 'OCA' : 'Custom'} · v{mod.version ?? '?'}
                        </span>
                      </div>
                    </Label>
                  ))}
                  {clientModules.length === 0 && (
                    <div className="col-span-full py-4 text-center text-muted-foreground text-sm">
                      Aucun module disponible pour ce client
                    </div>
                  )}
                </div>
              </div>

              {/* AI Context toggle */}
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-md bg-violet-100 dark:bg-violet-900/30 shrink-0">
                    <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <Label htmlFor="ai-context" className="text-sm font-medium cursor-pointer">
                      Charger contexte projet
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      L&apos;IA analyse le codebase pour proposer des suggestions contextuelles
                    </p>
                  </div>
                </div>
                <Switch
                  id="ai-context"
                  checked={aiContext}
                  onCheckedChange={setAiContext}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <PermissionGuard role="dev" fallback="disable">
                  <Button
                    className="gap-1.5"
                    disabled={startLoading}
                    onClick={handleStart}
                  >
                    {startLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Démarrer Environnement
                  </Button>
                </PermissionGuard>

                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setShowCli(!showCli)}
                >
                  <Terminal className="size-4" />
                  Voir commande CLI
                </Button>

                <PermissionGuard role="dev" fallback="disable">
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    disabled={resumeLoading}
                    onClick={handleResume}
                  >
                    {resumeLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    Reprendre session précédente
                  </Button>
                </PermissionGuard>
              </div>

              {/* CLI command display */}
              {showCli && (
                <div className="mt-4 rounded-lg border bg-zinc-950 dark:bg-zinc-900 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">Commande équivalente</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-6 text-zinc-400 hover:text-zinc-200"
                      onClick={() => navigator.clipboard.writeText(cliCommand)}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                  <code className="text-sm font-mono text-emerald-400">{cliCommand}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!selectedTicket && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Play className="size-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Aucun ticket sélectionné</p>
              <p className="text-xs mt-1">Recherchez et sélectionnez un ticket pour configurer votre environnement de travail</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ Tab 3: Workflow Tracker ============
function WorkflowTrackerTab() {
  const { selectedTicketId, setSelectedTicketId, realClients, realTickets } = useAppStore()
  const effectiveClients = realClients
  const effectiveTickets = realTickets
  const { loading: pushLoading, execute: executePush } = useAsyncAction()
  const { loading: prLoading, execute: executePR } = useAsyncAction()
  const { loading: reviewLoading, execute: executeReview } = useAsyncAction()
  const { loading: logsLoading, execute: executeLogs } = useAsyncAction()
  const { loading: pipelineLoading, execute: executePipeline } = useAsyncAction()
  const { loading: cancelLoading, execute: executeCancel } = useAsyncAction()
  const { loading: approveLoading, execute: executeApprove } = useAsyncAction()
  const { loading: linkLoading, execute: executeLink } = useAsyncAction()
  const { loading: rejectLoading, execute: executeReject } = useAsyncAction()

  const [selectedTicket, setSelectedTicket] = useState<(TicketType & { clientSlug: string }) | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  // All tickets
  const allTickets = useMemo(() => {
    const tickets: (TicketType & { clientSlug: string })[] = []
    for (const [slug, clientTickets] of Object.entries(effectiveTickets)) {
      for (const t of clientTickets) {
        tickets.push({ ...t, clientSlug: slug })
      }
    }
    return tickets
  }, [effectiveTickets])

  // Workflow steps for selected ticket
  const workflowSteps = useMemo(() => {
    if (!selectedTicket) return []
    return mockWorkflowStates[selectedTicket.id] ?? WORKFLOW_STEPS_DEF.map((s) => ({
      ...s,
      status: 'pending' as WorkflowStepStatus,
    }))
  }, [selectedTicket])

  // Find current step
  const currentStepId = useMemo(() => {
    const inProgress = workflowSteps.find((s) => s.status === 'in_progress')
    if (inProgress) return inProgress.id
    const lastCompleted = [...workflowSteps].reverse().find((s) => s.status === 'completed')
    if (lastCompleted) {
      const idx = workflowSteps.findIndex((s) => s.id === lastCompleted.id)
      return idx < workflowSteps.length - 1 ? workflowSteps[idx + 1].id : lastCompleted.id
    }
    return workflowSteps[0]?.id
  }, [workflowSteps])

  const handleSelectTicket = (ticket: TicketType & { clientSlug: string }) => {
    setSelectedTicket(ticket)
    setSelectedTicketId(ticket.id)
  }

  const clientSlug = selectedTicket?.clientSlug ?? ''

  // Action handlers
  const handlePush = () => {
    executePush(
      async () => { await new Promise((r) => setTimeout(r, 600)); return { pushed: true } },
      { successMessage: 'Code poussé vers GitHub avec succès' }
    )
  }

  const handleCreatePR = () => {
    executePR(
      async () => { await new Promise((r) => setTimeout(r, 800)); return { pr: 47 } },
      { successMessage: 'Pull Request #47 créée' }
    )
  }

  const handleRequestReview = () => {
    executeReview(
      async () => { await new Promise((r) => setTimeout(r, 500)); return { requested: true } },
      { successMessage: 'Review demandée à l\'équipe' }
    )
  }

  const handleViewLogs = () => {
    executeLogs(
      async () => { await new Promise((r) => setTimeout(r, 400)); return { logs: true } },
      { successMessage: 'Logs en direct chargés' }
    )
  }

  const handleRetriggerPipeline = () => {
    executePipeline(
      async () => { await new Promise((r) => setTimeout(r, 700)); return { retriggered: true } },
      { successMessage: 'Pipeline relancé avec succès' }
    )
  }

  const handleCancelPipeline = () => {
    executeCancel(
      async () => { await new Promise((r) => setTimeout(r, 500)); return { cancelled: true } },
      { successMessage: 'Pipeline annulé' }
    )
  }

  const handleApproveStaging = () => {
    executeApprove(
      async () => { await new Promise((r) => setTimeout(r, 600)); return { approved: true } },
      { successMessage: 'Staging approuvé — prêt pour validation client' }
    )
  }

  const handleGenerateLink = () => {
    executeLink(
      async () => { await new Promise((r) => setTimeout(r, 700)); return { url: 'https://validate.enswork.local/...' } },
      { successMessage: 'Lien de validation client généré' }
    )
  }

  const handleRejectConfirm = () => {
    executeReject(
      async () => { await new Promise((r) => setTimeout(r, 500)); return { rejected: true } },
      { successMessage: 'Validation rejetée avec commentaire' }
    )
    setRejectDialogOpen(false)
    setRejectComment('')
  }

  // Determine which actions to show based on the current workflow state
  const activeStepId = workflowSteps.find((s) => s.status === 'in_progress')?.id

  return (
    <div className="space-y-6">
      {/* Ticket selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="size-5 text-emerald-600 dark:text-emerald-400" />
            Suivi de workflow
          </CardTitle>
          <CardDescription>
            Sélectionnez un ticket pour suivre sa progression dans le pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {allTickets.map((ticket) => (
              <button
                key={`${ticket.clientSlug}-${ticket.id}`}
                type="button"
                className={cn(
                  'text-left rounded-lg border p-3 transition-colors',
                  selectedTicket?.id === ticket.id && ticket.clientSlug === selectedTicket.clientSlug
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/50'
                )}
                onClick={() => handleSelectTicket(ticket)}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold">#{ticket.id}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] h-4',
                      ticket.status === 'in_progress' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                      ticket.status === 'open' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                      ticket.status === 'closed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                    )}
                  >
                    {ticket.status === 'in_progress' ? 'En cours' : ticket.status === 'open' ? 'Ouvert' : 'Fermé'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{ticket.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{getClientName(ticket.clientSlug)}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress bar + timeline */}
      {selectedTicket && (
        <>
          {/* Workflow progress bar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="size-4 text-emerald-600 dark:text-emerald-400" />
                Progression — #{selectedTicket.id}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-2">
                <WorkflowProgressBar
                  steps={workflowSteps}
                  currentStep={currentStepId}
                  onStepClick={() => {}}
                />
              </div>
            </CardContent>
          </Card>

          {/* Vertical timeline with details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
                Détails du workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-0">
                {workflowSteps.map((step, index) => {
                  const isFirst = index === 0
                  const isLast = index === workflowSteps.length - 1

                  return (
                    <div key={step.id} className="flex gap-4">
                      {/* Timeline line + dot */}
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            'size-4 rounded-full border-2 shrink-0 mt-1.5 transition-colors',
                            step.status === 'completed' && 'border-emerald-500 bg-emerald-500',
                            step.status === 'in_progress' && 'border-blue-500 bg-blue-500/20',
                            step.status === 'failed' && 'border-red-500 bg-red-500',
                            step.status === 'pending' && 'border-gray-300 bg-background dark:border-gray-600',
                          )}
                        >
                          {step.status === 'in_progress' && (
                            <span className="relative flex size-full items-center justify-center">
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-40" />
                            </span>
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className={cn(
                              'w-0.5 flex-1 min-h-[48px]',
                              step.status === 'completed' && workflowSteps[index + 1]?.status === 'completed'
                                ? 'bg-emerald-500'
                                : step.status === 'completed' && workflowSteps[index + 1]?.status === 'in_progress'
                                  ? 'bg-gradient-to-b from-emerald-500 to-blue-500'
                                  : step.status === 'failed'
                                    ? 'bg-red-500'
                                    : 'bg-gray-200 dark:bg-gray-700',
                            )}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{step.label}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5',
                              step.status === 'completed' && 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
                              step.status === 'in_progress' && 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20',
                              step.status === 'failed' && 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20',
                              step.status === 'pending' && 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400',
                            )}
                          >
                            {step.status === 'completed' ? 'Terminé' :
                             step.status === 'in_progress' ? 'En cours' :
                             step.status === 'failed' ? 'Échoué' : 'En attente'}
                          </Badge>
                        </div>
                        {step.details && (
                          <p className="text-xs text-muted-foreground mt-1">{step.details}</p>
                        )}
                        {step.responsible && step.responsible !== '—' && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <User className="size-3" />
                            {step.responsible}
                            {step.since && (
                              <span className="ml-1">· {formatDate(step.since)}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Contextual actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="size-4 text-emerald-600 dark:text-emerald-400" />
                Actions contextuelles
              </CardTitle>
              <CardDescription>
                Actions disponibles selon l&apos;étape en cours du workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Development actions */}
              {activeStepId === 'development' && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Code2 className="size-4 text-blue-500" />
                    Développement
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="h-8 text-xs gap-1.5" disabled={pushLoading} onClick={handlePush}>
                      {pushLoading ? <Loader2 className="size-3 animate-spin" /> : <GitBranch className="size-3" />}
                      Push vers GitHub
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={prLoading} onClick={handleCreatePR}>
                      {prLoading ? <Loader2 className="size-3 animate-spin" /> : <GitPullRequest className="size-3" />}
                      Créer Pull Request
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={reviewLoading} onClick={handleRequestReview}>
                      {reviewLoading ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />}
                      Demander review
                    </Button>
                  </div>
                </div>
              )}

              {/* CI/CD actions */}
              {activeStepId === 'cicd' && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <RefreshCw className="size-4 text-amber-500" />
                    CI/CD
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={logsLoading} onClick={handleViewLogs}>
                      {logsLoading ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
                      Voir logs en direct
                    </Button>
                    <Button size="sm" className="h-8 text-xs gap-1.5" disabled={pipelineLoading} onClick={handleRetriggerPipeline}>
                      {pipelineLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                      Relancer pipeline
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" disabled={cancelLoading} onClick={handleCancelPipeline}>
                      {cancelLoading ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {/* Validation actions */}
              {activeStepId === 'validation' && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    Validation
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <PermissionGuard role="lead" fallback="disable">
                      <Button size="sm" className="h-8 text-xs gap-1.5" disabled={approveLoading} onClick={handleApproveStaging}>
                        {approveLoading ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                        Approuver staging
                      </Button>
                    </PermissionGuard>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={linkLoading} onClick={handleGenerateLink}>
                      {linkLoading ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                      Générer lien client
                    </Button>
                    <PermissionGuard role="lead" fallback="disable">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        onClick={() => setRejectDialogOpen(true)}
                      >
                        <XCircle className="size-3" />
                        Rejeter (avec commentaire)
                      </Button>
                    </PermissionGuard>
                  </div>
                </div>
              )}

              {/* No active step / all completed or pending */}
              {!activeStepId && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <div className="text-center">
                    <CheckCircle2 className="size-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">
                      {workflowSteps.every((s) => s.status === 'completed')
                        ? 'Workflow terminé — ticket déployé en production'
                        : workflowSteps.every((s) => s.status === 'pending')
                          ? 'Workflow en attente — aucune étape active'
                          : 'Sélectionnez un ticket pour voir les actions disponibles'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4 text-emerald-600 dark:text-emerald-400" />
                Notifications récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                {mockNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn(
                        'size-2 rounded-full shrink-0',
                        notif.type === 'success' && 'bg-emerald-500',
                        notif.type === 'error' && 'bg-red-500',
                        notif.type === 'info' && 'bg-blue-500',
                      )}
                    />
                    <span className="text-xs flex-1">{notif.message}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{notif.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!selectedTicket && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Eye className="size-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Aucun ticket sélectionné</p>
              <p className="text-xs mt-1">Sélectionnez un ticket ci-dessus pour suivre son workflow</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rejeter la validation
            </DialogTitle>
            <DialogDescription>
              Cette action sera enregistrée dans les logs d&apos;audit. Le déploiement sera bloqué.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedTicket && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket</span>
                  <span className="font-medium">#{selectedTicket.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{getClientName(selectedTicket.clientSlug)}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reject-comment">Commentaire de rejet *</Label>
              <Textarea
                id="reject-comment"
                placeholder="Expliquez pourquoi cette validation est rejetée..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Annuler
            </Button>
            <PermissionGuard role="lead" fallback="disable">
              <Button
                variant="destructive"
                disabled={!rejectComment.trim() || rejectLoading}
                onClick={handleRejectConfirm}
              >
                {rejectLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Confirmer le rejet
              </Button>
            </PermissionGuard>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ Main Workspace Module ============
export function WorkspaceModule() {
  const { workspaceTab, setWorkspaceTab } = useAppStore()

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderGit2 className="size-6 text-emerald-600 dark:text-emerald-400" />
          Espace de travail
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Création de tickets, démarrage d&apos;environnements et suivi de workflow
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={workspaceTab} onValueChange={(v) => setWorkspaceTab(v as 'tickets' | 'workstarter' | 'workflow')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="size-4" />
            <span className="hidden sm:inline">Ticket Creator</span>
            <span className="sm:hidden">Tickets</span>
          </TabsTrigger>
          <TabsTrigger value="workstarter" className="gap-1.5">
            <Play className="size-4" />
            <span className="hidden sm:inline">Démarrer Work</span>
            <span className="sm:hidden">Work</span>
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-1.5">
            <Zap className="size-4" />
            <span className="hidden sm:inline">Workflow Tracker</span>
            <span className="sm:hidden">Workflow</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-6">
          <TicketCreatorTab />
        </TabsContent>

        <TabsContent value="workstarter" className="mt-6">
          <WorkStarterTab />
        </TabsContent>

        <TabsContent value="workflow" className="mt-6">
          <WorkflowTrackerTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default WorkspaceModule
