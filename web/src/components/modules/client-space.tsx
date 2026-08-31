'use client'

import { useMemo, useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Globe,
  Lock,
  Network,
  ShieldCheck,
  Users,
  Pencil,
  Eye,
  Power,
  PowerOff,
  FileCode,
  ArrowUpCircle,
  GitBranch,
  Plus,
  Merge,
  Trash2,
  Ticket,
  MessageSquare,
  RefreshCw,
  Rocket,
  Copy,
  ChevronRight,
  Loader2,
  X,
  HeartPulse,
  CircleCheck,
  CircleX,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { GateModal } from '@/components/shared/gate-modal'
import type { GitBranch as GitBranchType, Ticket as TicketType } from '@/lib/mock-data'
import { useAppStore, type ClientTab } from '@/lib/store'
import type { ClientData, ClientModule, Deployment, UserRole, HealthCheck } from '@/lib/types'
import { useAsyncAction } from '@/hooks/use-async-action'
import { deployApi, rollbackApi, workApi, issueApi, clientsApi } from '@/lib/api'

// ── Client selection grid ─────────────────────────────────────────────────
function ClientSelectionGrid() {
  const { setSelectedClientSlug, realClients } = useAppStore()
  const effectiveClients = realClients

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Espace Client</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Sélectionnez un client pour accéder à ses détails, modules, branches et tickets.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {effectiveClients.map((client) => (
          <Card
            key={client.id}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
            onClick={() => setSelectedClientSlug(client.slug)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-muted-foreground" />
                {client.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="-mt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">v{client.odooVersion}</Badge>
                <StatusBadge status={client.status} size="sm" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(client.lastActivity), { addSuffix: true, locale: fr })}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Tab 1: Fiche Client ───────────────────────────────────────────────────
function FicheClient({ client, userRole }: { client: ClientData; userRole: UserRole }) {
  const { setSelectedClientSlug, setCurrentView } = useAppStore()
  const [accessOpen, setAccessOpen] = useState(false)
  const contacts = useMemo(() => {
    try {
      return client.contacts ? JSON.parse(client.contacts) : { dev: [], client: [], ops: [] }
    } catch {
      return { dev: [], client: [], ops: [] }
    }
  }, [client.contacts])

  return (
    <div className="space-y-4">
      {/* Metadata card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Slug</p>
              <p className="text-sm font-medium font-mono">{client.slug}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Version Odoo</p>
              <p className="text-sm font-medium">v{client.odooVersion}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Statut</p>
              <StatusBadge status={client.status} size="md" showIcon />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">URL Staging</p>
              {client.stagingUrl ? (
                <a
                  href={client.stagingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Globe className="size-3" />
                  Staging
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">URL Production</p>
              {client.prodUrl ? (
                <a
                  href={client.prodUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Globe className="size-3" />
                  Production
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">IP Tailscale</p>
              <p className="text-sm font-mono flex items-center gap-1.5">
                <Network className="size-3 text-muted-foreground" />
                {client.tailscaleIp ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Groupe ACL</p>
              <p className="text-sm font-mono flex items-center gap-1.5">
                <ShieldCheck className="size-3 text-muted-foreground" />
                {client.aclGroup ?? '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Équipe Dev</p>
              <div className="space-y-1">
                {(contacts.dev as string[]).map((email: string) => (
                  <p key={email} className="text-sm font-mono">{email}</p>
                ))}
                {contacts.dev.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Contact Client</p>
              <div className="space-y-1">
                {(contacts.client as string[]).map((email: string) => (
                  <p key={email} className="text-sm font-mono">{email}</p>
                ))}
                {contacts.client.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Équipe Ops</p>
              <div className="space-y-1">
                {(contacts.ops as string[]).map((email: string) => (
                  <p key={email} className="text-sm font-mono">{email}</p>
                ))}
                {contacts.ops.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={userRole === 'client'} onClick={() => { setSelectedClientSlug(client.slug); setCurrentView('workspace') }}>
          <Pencil className="size-3.5" />
          Éditer config
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSelectedClientSlug(client.slug); setCurrentView('observability') }}>
          <Network className="size-3.5" />
          Voir réseau
        </Button>
        {userRole === 'admin' && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAccessOpen(true)}>
            <ShieldCheck className="size-3.5" />
            Gérer accès
          </Button>
        )}
      </div>

      {/* Gérer accès dialog */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              Accès — {client.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Groupe ACL</p>
              <p className="font-mono">{client.aclGroup ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Équipe Dev</p>
              <div className="space-y-1">
                {contacts.dev.map((email: string) => (
                  <p key={email} className="font-mono">{email}</p>
                ))}
                {contacts.dev.length === 0 && <p className="text-muted-foreground">—</p>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Équipe Ops</p>
              <div className="space-y-1">
                {contacts.ops.map((email: string) => (
                  <p key={email} className="font-mono">{email}</p>
                ))}
                {contacts.ops.length === 0 && <p className="text-muted-foreground">—</p>}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <X className="size-3.5" />
                Fermer
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tab 2: Modules Installés ──────────────────────────────────────────────
function ModulesTab({ clientSlug }: { clientSlug: string }) {
  const [modules, setModules] = useState<{ id?: string; name: string; technicalName?: string; version?: string | null; source?: string; status?: string | null; lastUpdated?: string | null }[]>([])
  const [modulesLoading, setModulesLoading] = useState(true)
  const { loading: toggleLoading, execute: executeToggle } = useAsyncAction()
  const { loading: diffLoading, execute: executeDiff } = useAsyncAction()
  const { loading: upgradeLoading, execute: executeUpgrade } = useAsyncAction()

  useEffect(() => {
    queueMicrotask(() => setModulesLoading(true))
    fetch(`/api/clients/${clientSlug}/modules`)
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data.length > 0) setModules(d.data) })
      .catch(() => {})
      .finally(() => setModulesLoading(false))
  }, [clientSlug])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="size-4 text-muted-foreground" />
          Modules installés
          <Badge variant="secondary" className="text-xs ml-2">
            {modulesLoading ? <Loader2 className="size-3 animate-spin" /> : modules.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Dernière MAJ</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun module installé
                  </TableCell>
                </TableRow>
              ) : (
                modules.map((mod) => (
                  <TableRow key={mod.technicalName ?? `${mod.source ?? ''}-${mod.name}`}>
                    <TableCell className="font-medium font-mono text-sm">{mod.name}</TableCell>
                    <TableCell className="text-xs">{mod.version ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          mod.source === 'oca'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]'
                        }
                      >
                        {mod.source === 'oca' ? 'OCA' : 'Custom'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={mod.status ?? 'installed'} size="sm" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {mod.lastUpdated && !isNaN(new Date(mod.lastUpdated).getTime()) ? formatDistanceToNow(new Date(mod.lastUpdated), { addSuffix: true, locale: fr }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {mod.status === 'installed' ? (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={toggleLoading}
                            onClick={() => executeToggle(
                              () => fetch(`/api/clients/${clientSlug}/work/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: mod.name, issue: 0, dryRun: true }) }).then(r => r.json()),
                              { successMessage: `Module ${mod.name} — action enregistrée` }
                            )}>
                            <PowerOff className="size-3" />
                            Désactiver
                          </Button>
                        ) : mod.status === 'disabled' ? (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={toggleLoading}
                            onClick={() => executeToggle(
                              () => fetch(`/api/clients/${clientSlug}/work/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: mod.name, issue: 0, dryRun: true }) }).then(r => r.json()),
                              { successMessage: `Module ${mod.name} — activation enregistrée` }
                            )}>
                            <Power className="size-3" />
                            Activer
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={diffLoading}
                          onClick={() => executeDiff(
                            () => fetch(`/api/clients/${clientSlug}/modules`).then(r => r.json()),
                            { successMessage: `Modules ${clientSlug} rechargés` }
                          )}>
                          <Eye className="size-3" />
                          Diff
                        </Button>
                        {mod.status === 'upgrade_available' && (
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-amber-600" disabled={upgradeLoading}
                            onClick={() => executeUpgrade(
                              () => fetch(`/api/clients/${clientSlug}/work/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: mod.name, issue: 0 }) }).then(r => r.json()),
                              { successMessage: `Upgrade ${mod.name} initié via work/start` }
                            )}>
                            {upgradeLoading ? <Loader2 className="size-3 animate-spin" /> : <ArrowUpCircle className="size-3" />}
                            Upgrade
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Tab 3: Branches Git ───────────────────────────────────────────────────
function BranchesTab({ clientSlug, clientName }: { clientSlug: string; clientName: string }) {
  const [branches, setBranches] = useState<GitBranchType[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [gateOpen, setGateOpen] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setBranchesLoading(true))
    fetch(`/api/clients/${clientSlug}/branches`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.length > 0) {
          setBranches(d.data.map((b: { name: string; lastCommitAuthor: string | null; lastCommitDate: string | null; upstream: string | null; current: boolean; type: string; ciStatus?: string; protected?: boolean }) => ({
            name: b.name,
            author: b.lastCommitAuthor || '—',
            date: b.lastCommitDate || new Date().toISOString(),
            status: b.upstream ? 'synced' : 'ahead',
            ciStatus: b.ciStatus && b.ciStatus !== 'unknown' ? b.ciStatus : (b.current ? 'running' : 'pending'),
            isProtected: b.type === 'protected' || b.protected === true,
          } as GitBranchType)))
        }
      })
      .catch(() => {})
      .finally(() => setBranchesLoading(false))
  }, [clientSlug])
  const [gateAction, setGateAction] = useState('')
  const [gateBranch, setGateBranch] = useState('')
  const { loading: mergeLoading, execute: executeMerge } = useAsyncAction()
  const { loading: deleteLoading, execute: executeDelete } = useAsyncAction()
  const { loading: branchLoading, execute: executeCreateBranch } = useAsyncAction()

  const handleDeleteBranch = (branchName: string) => {
    setGateAction(`Supprimer la branche "${branchName}"`)
    setGateBranch(branchName)
    setGateOpen(true)
  }

  const handleMergeBranch = (branchName: string) => {
    setGateAction(`Merge la branche "${branchName}"`)
    setGateBranch(branchName)
    setGateOpen(true)
  }

  const syncStatusLabel: Record<string, string> = {
    ahead: 'En avance',
    behind: 'En retard',
    synced: 'Synchronisé',
    diverged: 'Divergé',
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            Branches Git
            <Badge variant="secondary" className="text-xs ml-2">
              {branchesLoading ? <Loader2 className="size-3 animate-spin" /> : branches.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Auteur</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead>Sync</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune branche
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((branch) => (
                    <TableRow key={branch.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{branch.name}</span>
                          {branch.isProtected && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0 h-4 gap-0.5">
                              <Lock className="size-2.5" />
                              Protégée
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {branch.author}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(branch.date), { addSuffix: true, locale: fr })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={branch.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={branch.ciStatus} size="sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!branch.isProtected && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={mergeLoading} onClick={() => handleMergeBranch(branch.name)}>
                              {mergeLoading ? <Loader2 className="size-3 animate-spin" /> : <Merge className="size-3" />}
                              Merge
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700"
                            disabled={branch.isProtected}
                            onClick={() => handleDeleteBranch(branch.name)}
                          >
                            <Trash2 className="size-3" />
                            <span className="hidden xl:inline">Supprimer</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pt-4">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={branchLoading} onClick={() => executeCreateBranch(() => workApi.start(clientSlug, 0, ''), { successMessage: 'Ouvrir Work Starter pour créer une branche' })}>
              {branchLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Créer branche
            </Button>
          </div>
        </CardContent>
      </Card>

      <GateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        action={gateAction}
        client={clientName}
        environment="staging"
        impact="Suppression d'une branche Git — les données non mergées seront perdues"
        onConfirm={(reason) => {
          if (gateAction.includes('Supprimer')) {
            executeDelete(
              () => fetch(`/api/clients/${clientSlug}/branches`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branch: gateBranch, reason }),
              }).then(r => r.json()),
              { successMessage: `Branche "${gateBranch}" supprimée` }
            )
          } else if (gateAction.includes('Merge')) {
            executeMerge(
              () => fetch(`/api/clients/${clientSlug}/branches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branch: gateBranch, action: 'merge', reason }),
              }).then(r => r.json()),
              { successMessage: `Branche "${gateBranch}" mergée dans main` }
            )
          }
          setGateOpen(false)
        }}
      />
    </>
  )
}

// ── Tab 4: Tickets Liés ──────────────────────────────────────────────────
function TicketsTab({ clientSlug }: { clientSlug: string }) {
  const { realTickets } = useAppStore()
  const tickets = realTickets[clientSlug] ?? []
  const { loading: commentLoading, execute: executeComment } = useAsyncAction()
  const { loading: statusLoading, execute: executeStatus } = useAsyncAction()
  const { loading: issueLoading, execute: executeCreateIssue } = useAsyncAction()

  const labelColors: Record<string, string> = {
    feature: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    bug: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    performance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    integration: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    v17: 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300',
    security: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="size-4 text-muted-foreground" />
          Tickets liés
          <Badge variant="secondary" className="text-xs ml-2">{tickets.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Assigné</TableHead>
                <TableHead className="hidden lg:table-cell">Labels</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun ticket
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm">#{ticket.id}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {ticket.title}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} size="sm" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {ticket.assignee ?? '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {ticket.labels.map((label) => (
                          <Badge
                            key={label}
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 h-4 ${labelColors[label] ?? ''}`}
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={commentLoading} onClick={() => executeComment(() => issueApi.update(clientSlug, Number(ticket.id), { comment: 'Commentaire via PACADEV UI' }), { successMessage: 'Commentaire ajouté' })}>
                          {commentLoading ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />}
                          Commenter
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={statusLoading} onClick={() => executeStatus(() => issueApi.update(clientSlug, Number(ticket.id), { label: 'reviewed' }), { successMessage: 'Statut mis à jour' })}>
                          {statusLoading ? <Loader2 className="size-3 animate-spin" /> : null}
                          Statut
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 pt-4">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={issueLoading} onClick={() => executeCreateIssue(() => issueApi.create(clientSlug, 'general', 'Nouvelle issue'), { successMessage: 'Issue créée' })}>
            {issueLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Créer issue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Tab 5: Versions Déployées ─────────────────────────────────────────────
function VersionsTab({ client, clientName }: { client: ClientData; clientName: string }) {
  interface VersionData {
    currentBranch: string | null;
    currentIssue: string | null;
    currentRepo: string | null;
    odooVersion: string | null;
    status: string;
    history: { id: string; action: string; timestamp: string; user: string; details: string | null }[];
  }
  const [versionData, setVersionData] = useState<VersionData | null>(null)
  const [versionsLoading, setVersionsLoading] = useState(true)
  const [gateOpen, setGateOpen] = useState(false)
  const [gateTag, setGateTag] = useState('')
  const { loading: rollbackLoading, execute: executeRollback } = useAsyncAction()

  useEffect(() => {
    queueMicrotask(() => setVersionsLoading(true))
    fetch(`/api/clients/${client.slug}/versions`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setVersionData(d.data) })
      .catch(() => {})
      .finally(() => setVersionsLoading(false))
  }, [client.slug])

  const handleRollback = (tag: string) => {
    setGateTag(tag)
    setGateOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-muted-foreground" />
            État & Historique déploiements
            {versionsLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {versionData && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Branche active</p>
                <p className="font-mono text-xs font-medium truncate">{versionData.currentBranch ?? '—'}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Issue en cours</p>
                <p className="font-mono text-xs font-medium">{versionData.currentIssue ?? '—'}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Version Odoo</p>
                <p className="font-mono text-xs font-medium">{versionData.odooVersion ?? '—'}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Statut</p>
                <Badge variant="secondary" className="text-[10px]">{versionData.status}</Badge>
              </div>
            </div>
          )}
        </CardContent>
        <CardContent className="px-0">
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead>Détails</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!versionData || versionData.history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun événement de déploiement
                    </TableCell>
                  </TableRow>
                ) : (
                  versionData.history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-mono">{h.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.user}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(h.timestamp), { addSuffix: true, locale: fr })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {h.details ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-orange-600 hover:text-orange-700"
                          onClick={() => handleRollback(h.id)}
                        >
                          <RefreshCw className="size-3" />
                          Rollback
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <GateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        action={`Rollback vers le tag "${gateTag}"`}
        client={clientName}
        environment="prod"
        impact="Restauration d'une version antérieure — les données post-déploiement peuvent être affectées"
        onConfirm={(reason) => {
          executeRollback(() => rollbackApi.execute(client.slug, gateTag, reason), { successMessage: 'Rollback lancé' })
          setGateOpen(false)
        }}
      />
    </>
  )
}

// ── Tab 6: Health Check ───────────────────────────────────────────────────
function HealthTab({ clientSlug }: { clientSlug: string }) {
  const [health, setHealth] = useState<HealthCheck | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`/api/clients/${clientSlug}/validate`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setHealth(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [clientSlug])

  const checkLabels: Record<string, string> = {
    docker: 'Conteneur Docker',
    config: 'Configuration (odoo.conf)',
    filestore: 'Filestore',
    odoo_http: 'Réponse HTTP Odoo',
    db: 'Base de données',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="size-4 text-muted-foreground" />
          Health Check
          {health && (
            <span className="ml-2">
              <StatusBadge status={health.overall} size="sm" />
            </span>
          )}
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs gap-1" disabled={loading} onClick={load}>
            {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Actualiser
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !health ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !health ? (
          <p className="text-center text-muted-foreground py-10">Impossible de récupérer le health check.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {health.checks.map((c) => (
                <div
                  key={c.name}
                  className={`rounded-lg border p-3 space-y-1.5 ${c.ok ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-red-200 dark:border-red-900/40'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{checkLabels[c.name] ?? c.name}</p>
                    {c.ok ? (
                      <CircleCheck className="size-4 text-emerald-500" />
                    ) : (
                      <CircleX className="size-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{c.detail}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
              <span>
                Conteneur : <span className="font-mono">{health.dockerStatus}</span>
              </span>
              <span>Dernière vérification : {format(new Date(health.lastCheck), 'HH:mm:ss')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Espace Client ────────────────────────────────────────────────────
export function EspaceClient() {
  const { selectedClientSlug, setSelectedClientSlug, clientTab, setClientTab, userRole, realClients } = useAppStore()
  const effectiveClients = realClients

  // No client selected → show selection grid
  if (!selectedClientSlug) {
    return <ClientSelectionGrid />
  }

  const client = effectiveClients.find((c) => c.slug === selectedClientSlug)

  // Client not found → show selection grid with message
  if (!client) {
    return <ClientSelectionGrid />
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setSelectedClientSlug(null)}
        >
          <ArrowLeft className="size-3.5" />
          Retour
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{client.name}</h2>
          <p className="text-muted-foreground text-sm">
            {client.slug} &middot; Odoo v{client.odooVersion}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={clientTab} onValueChange={(v) => setClientTab(v as ClientTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="fiche" className="gap-1.5">
            <Building2 className="size-3.5" />
            <span className="hidden sm:inline">Fiche Client</span>
            <span className="sm:hidden">Fiche</span>
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-1.5">
            <FileCode className="size-3.5" />
            <span className="hidden sm:inline">Modules</span>
            <span className="sm:hidden">Modules</span>
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-1.5">
            <GitBranch className="size-3.5" />
            <span className="hidden sm:inline">Branches Git</span>
            <span className="sm:hidden">Branches</span>
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="size-3.5" />
            <span className="hidden sm:inline">Tickets</span>
            <span className="sm:hidden">Tickets</span>
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <Rocket className="size-3.5" />
            <span className="hidden sm:inline">Versions</span>
            <span className="sm:hidden">Versions</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <HeartPulse className="size-3.5" />
            <span className="hidden sm:inline">Health</span>
            <span className="sm:hidden">Health</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fiche">
          <FicheClient client={client} userRole={userRole} />
        </TabsContent>

        <TabsContent value="modules">
          <ModulesTab clientSlug={client.slug} />
        </TabsContent>

        <TabsContent value="branches">
          <BranchesTab clientSlug={client.slug} clientName={client.name} />
        </TabsContent>

        <TabsContent value="tickets">
          <TicketsTab clientSlug={client.slug} />
        </TabsContent>

        <TabsContent value="versions">
          <VersionsTab client={client} clientName={client.name} />
        </TabsContent>

        <TabsContent value="health">
          <HealthTab clientSlug={client.slug} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
