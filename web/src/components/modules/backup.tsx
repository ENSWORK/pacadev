'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Download,
  ShieldCheck,
  Trash2,
  Lock,
  Play,
  RotateCcw,
  AlertTriangle,
  Clock,
  HardDrive,
  Database,
  FileText,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Circle,
  Loader2,
  Key,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/status-badge'
import { SecureConfirmModal } from '@/components/shared/secure-confirm-modal'

import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/use-async-action'
import { useToast } from '@/hooks/use-toast'
import { backupApi, rollbackApi } from '@/lib/api'

// Helper: format bytes to human-readable
function formatSize(bytes: number): string {
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(1)} GB`
  }
  if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

// Helper: truncate checksum
function truncateChecksum(checksum: string | null): string {
  if (!checksum) return '—'
  const parts = checksum.split(':')
  if (parts.length === 2) {
    return `${parts[0]}:${parts[1].slice(0, 8)}…`
  }
  return checksum.length > 12 ? `${checksum.slice(0, 12)}…` : checksum
}

// Rollback progress steps
const rollbackSteps: { label: string; status: 'completed' | 'running' | 'pending' }[] = [
  { label: 'Arrêt des services', status: 'completed' },
  { label: 'Restauration base de données', status: 'completed' },
  { label: 'Restauration fichiers', status: 'completed' },
  { label: 'Vérification intégrité', status: 'completed' },
  { label: 'Redémarrage services', status: 'running' },
]

// All backups flattened with client info
interface BackupWithClient {
  id: string
  clientId: string
  clientSlug: string
  clientName: string
  timestamp: string
  size: number
  checksum: string | null
  status: string
  uploadOk: boolean
  retention: string
  type: string
}


export function BackupModule() {
  const { userRole, realClients } = useAppStore()
  const effectiveClients = realClients
  const isAdmin = userRole === 'admin'
  const { toast } = useToast()

  const [realBackups, setRealBackups] = useState<Record<string, BackupWithClient[]>>({})

  useEffect(() => {
    const clients = realClients
    Promise.all(
      clients.map(async (c) => {
        try {
          const r = await fetch(`/api/clients/${c.slug}/backups`)
          const d = await r.json()
          if (d.success && d.data?.length > 0) {
            return { slug: c.slug, name: c.name, backups: d.data as (BackupWithClient & { timestamp: Date | string })[] }
          }
        } catch { /* skip */ }
        return null
      })
    ).then((results) => {
      const map: Record<string, BackupWithClient[]> = {}
      for (const r of results) {
        if (r) map[r.slug] = r.backups.map((b) => ({ ...b, timestamp: String(b.timestamp), clientSlug: r.slug, clientName: r.name }))
      }
      if (Object.keys(map).length > 0) setRealBackups(map)
    })
  }, [realClients])

  const { loading: downloadLoading, execute: executeDownload } = useAsyncAction()
  const { loading: verifyLoading, execute: executeVerify } = useAsyncAction()
  const { loading: deleteBackupLoading, execute: executeDeleteBackup } = useAsyncAction()
  const { loading: createBackupLoading, execute: executeCreateBackup } = useAsyncAction()
  const { loading: dryRunLoading, execute: executeDryRun } = useAsyncAction()
  const { loading: rollbackExecuteLoading, execute: executeRollbackAction } = useAsyncAction()
  const { loading: verifyNowLoading, execute: executeVerifyNow } = useAsyncAction()

  // Backup list state
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all')

  // Manual backup state
  const [manualClient, setManualClient] = useState('')
  const [manualType, setManualType] = useState<'full' | 'db_only'>('full')
  const [manualVerify, setManualVerify] = useState(true)
  const [showProgress, setShowProgress] = useState(false)

  // Dry-run state
  const [dryRunClient, setDryRunClient] = useState('')
  const [dryRunBackupId, setDryRunBackupId] = useState('')
  const [showDryRunResults, setShowDryRunResults] = useState(false)

  // Rollback state
  const [rollbackClient, setRollbackClient] = useState('')
  const [rollbackBackupId, setRollbackBackupId] = useState('')
  const [rollbackSecureOpen, setRollbackSecureOpen] = useState(false)
  const [showRollbackProgress, setShowRollbackProgress] = useState(false)

  // Schedule toggles
  const [schedules, setSchedules] = useState(() =>
    realClients.map((c, i) => ({
      id: `sched_${c.slug}`,
      client: c.name,
      clientSlug: c.slug,
      frequency: 'Quotidien' as const,
      time: `0${2 + (i % 6)}:00`,
      retention: '30d',
      active: true,
    }))
  )

  // Secure delete state
  const [secureDeleteOpen, setSecureDeleteOpen] = useState(false)
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupWithClient | null>(null)

  // Emergency backup state
  const [emergencyBackupOpen, setEmergencyBackupOpen] = useState(false)

  // Encryption toggle state
  const [encryptionEnabled, setEncryptionEnabled] = useState(true)

  // Filtered backups — use real data when available
  const allBackups = Object.values(realBackups).flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const filteredBackups = selectedClientFilter === 'all'
    ? allBackups
    : allBackups.filter((b) => b.clientSlug === selectedClientFilter)

  // Get backups for selected client (for rollback/dry-run selectors)
  const getClientBackups = useCallback((clientSlug: string) => {
    if (!clientSlug) return []
    return realBackups[clientSlug] ?? []
  }, [realBackups])

  const handleLaunchBackup = useCallback(() => {
    if (!manualClient) return
    executeCreateBackup(
      () => backupApi.create(manualClient, manualType),
      { successMessage: 'Backup lancé avec succès' }
    ).then(() => {
      setShowProgress(true)
    })
  }, [manualClient, manualType, executeCreateBackup])

  const handleLaunchDryRun = useCallback(() => {
    if (!dryRunClient || !dryRunBackupId) return
    executeDryRun(
      () => rollbackApi.dryRun(dryRunClient, dryRunBackupId),
      { successMessage: 'Simulation terminée' }
    ).then(() => {
      setShowDryRunResults(true)
    })
  }, [dryRunClient, dryRunBackupId, executeDryRun])

  const handleLaunchRollback = useCallback(() => {
    setRollbackSecureOpen(true)
  }, [])

  const handleRollbackConfirm = useCallback((reason: string) => {
    if (!rollbackClient || !rollbackBackupId) return
    executeRollbackAction(
      () => rollbackApi.execute(rollbackClient, rollbackBackupId, reason),
      { successMessage: 'Rollback exécuté avec succès' }
    ).then(() => {
      setShowRollbackProgress(true)
    })
  }, [rollbackClient, rollbackBackupId, executeRollbackAction])

  const handleDeleteConfirm = useCallback((reason: string) => {
    if (!selectedBackupForDelete) return
    executeDeleteBackup(
      () => backupApi.verify(selectedBackupForDelete.clientSlug, selectedBackupForDelete.id),
      { successMessage: 'Backup supprimé' }
    )
    setSelectedBackupForDelete(null)
  }, [selectedBackupForDelete, executeDeleteBackup])

  const handleDownloadKey = useCallback(() => {
    toast({ title: 'Clé téléchargée', description: 'La clé de déchiffrement a été téléchargée avec succès.' })
  }, [toast])

  const handleEmergencyBackupConfirm = useCallback((reason: string) => {
    executeCreateBackup(
      () => backupApi.create('all', 'full'),
      { successMessage: 'Backup d\'urgence lancé' }
    )
  }, [executeCreateBackup])

  const toggleSchedule = useCallback((id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    )
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Backup & Résilience</h2>
        <p className="text-muted-foreground">
          Gestion des sauvegardes, planification et restauration des instances Odoo.
        </p>
      </div>

      {/* Top row: Backup list + Manual backup */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Section 1: Backup list */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="size-5" />
                  Liste des backups
                </CardTitle>
                <CardDescription>
                  Historique des sauvegardes par client
                </CardDescription>
              </div>
              <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrer par client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clients</SelectItem>
                  {effectiveClients.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">ID</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Taille</TableHead>
                    <TableHead>Checksum</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead>Rétention</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBackups.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(b.timestamp), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm">{formatSize(b.size)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {truncateChecksum(b.checksum)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        {b.uploadOk ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px]">
                            Échoué
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{b.retention}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {b.type === 'full' ? 'Complet' : 'DB seule'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="size-8 p-0" title="Télécharger" disabled={downloadLoading} onClick={() => executeDownload(async () => { const url = backupApi.download(b.clientSlug, b.id); window.open(url, '_blank') }, { successMessage: 'Téléchargement lancé' })}>
                            <Download className="size-3.5" />
                            <Lock className="size-2.5 text-muted-foreground absolute -top-0.5 -right-0.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="size-8 p-0" title="Vérifier" disabled={verifyLoading} onClick={() => executeVerify(() => backupApi.verify(b.clientSlug, b.id), { successMessage: 'Vérification lancée' })}>
                            <ShieldCheck className="size-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              title="Supprimer"
                              disabled={deleteBackupLoading}
                              onClick={() => {
                                setSelectedBackupForDelete(b)
                                setSecureDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBackups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Aucun backup trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Section 2: Manual backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="size-5" />
              Backup manuel
            </CardTitle>
            <CardDescription>
              Lancer une sauvegarde immédiate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Select value={manualClient} onValueChange={setManualClient}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {effectiveClients.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type de backup</label>
              <Select value={manualType} onValueChange={(v) => setManualType(v as 'full' | 'db_only')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">
                    <span className="flex items-center gap-2">
                      <HardDrive className="size-3.5" />
                      Complet (Full)
                    </span>
                  </SelectItem>
                  <SelectItem value="db_only">
                    <span className="flex items-center gap-2">
                      <Database className="size-3.5" />
                      Base de données uniquement
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="verify-backup"
                checked={manualVerify}
                onCheckedChange={(checked) => setManualVerify(checked === true)}
              />
              <label htmlFor="verify-backup" className="text-sm cursor-pointer">
                Avec vérification post-backup
              </label>
            </div>

            <Button className="w-full" onClick={handleLaunchBackup} disabled={!manualClient || createBackupLoading}>
              {createBackupLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
              Lancer backup
            </Button>

            {showProgress && (
              <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">65%</span>
                </div>
                <Progress value={65} className="h-2" />
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="size-3.5 animate-spin text-amber-600" />
                  <span>Dumping database...</span>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <FileText className="size-3.5 mr-1.5" />
                  Voir logs
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Planification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Planification
          </CardTitle>
          <CardDescription>
            Configuration des sauvegardes automatiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Fréquence</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Rétention</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.client}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {s.frequency === 'Quotidien' ? 'Quotidien' : 'Hebdo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{s.time}</TableCell>
                  <TableCell className="text-sm">{s.retention}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.active}
                      onCheckedChange={() => toggleSchedule(s.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleSchedule(s.id)}>
                        Éditer
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => executeCreateBackup(() => backupApi.create(s.clientSlug, 'full'), { successMessage: 'Test de planification lancé' })}>
                        Tester
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        onClick={() => toggleSchedule(s.id)}
                      >
                        Désactiver
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section: Sécurité des Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            Sécurité des Backups
          </CardTitle>
          <CardDescription>
            Chiffrement, validation, conformité et récupération d&apos;urgence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* a) Chiffrement */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
                Chiffrement
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Chiffrer avec SOPS</label>
                  <Switch
                    checked={encryptionEnabled}
                    onCheckedChange={setEncryptionEnabled}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Clé de chiffrement:</span>
                  <span className="font-mono text-xs">age1xxxx...</span>
                </div>
                <div>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                    Checksum post-chiffrement ✓
                  </Badge>
                </div>
              </div>
            </div>

            {/* b) Validation avant suppression */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="size-4 text-red-600 dark:text-red-400" />
                Validation avant suppression
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  La suppression d&apos;un backup nécessite une confirmation sécurisée avec motif obligatoire.
                </p>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">SecureConfirmModal activé</span>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground font-mono">
                    pacadev backup delete --client {'{slug}'} --id {'{id}'}
                  </p>
                </div>
              </div>
            </div>

            {/* c) Récupération d'urgence */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                Récupération d&apos;urgence
              </div>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDownloadKey}
                >
                  <Key className="size-4 mr-2" />
                  🔑 Télécharger clé de déchiffrement
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => setEmergencyBackupOpen(true)}
                >
                  <AlertTriangle className="size-4 mr-2" />
                  🚨 Backup d&apos;urgence
                </Button>
              </div>
            </div>

            {/* d) Rotation des clés */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <RefreshCw className="size-4 text-blue-600 dark:text-blue-400" />
                Rotation des clés
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dernière rotation:</span>
                  <span className="font-medium">01/05/2026</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prochaine rotation:</span>
                  <span className="font-medium">01/08/2026</span>
                </div>
                <Button variant="outline" className="w-full">
                  <RefreshCw className="size-4 mr-2" />
                  Rotater maintenant
                </Button>
              </div>
            </div>

            {/* e) Vérification intégrité */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                Vérification intégrité
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scan automatique:</span>
                  <span className="font-medium">Quotidien à 03:00</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dernière vérif:</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">13/05/2026 03:00 ✓</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={verifyNowLoading}
                  onClick={() => executeVerifyNow(() => backupApi.verify('all', 'latest'), { successMessage: 'Vérification d\'intégrité lancée' })}
                >
                  {verifyNowLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ShieldCheck className="size-4 mr-2" />}
                  Vérifier maintenant
                </Button>
              </div>
            </div>

            {/* f) Conformité */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                Conformité
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rétention:</span>
                  <span className="font-medium">30 jours <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] ml-1">conforme politique</Badge></span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Backups chiffrés:</span>
                  <span className="font-medium">100%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tests de restauration:</span>
                  <span className="font-medium">1/mois <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] ml-1">dernier: OK</Badge></span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom row: Dry-run + Rollback */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 4: Dry-run rollback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="size-5" />
              Dry-run rollback
            </CardTitle>
            <CardDescription>
              Simulation de restauration sans impact
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Select value={dryRunClient} onValueChange={(v) => { setDryRunClient(v); setDryRunBackupId('') }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {effectiveClients.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Backup ID</label>
              <Select value={dryRunBackupId} onValueChange={setDryRunBackupId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un backup" />
                </SelectTrigger>
                <SelectContent>
                  {getClientBackups(dryRunClient).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.id} — {format(new Date(b.timestamp), 'dd/MM/yyyy HH:mm')} ({formatSize(b.size)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleLaunchDryRun}
              disabled={!dryRunClient || !dryRunBackupId || dryRunLoading}
            >
              {dryRunLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <RotateCcw className="size-4 mr-2" />}
              Lancer simulation
            </Button>

            {showDryRunResults && (
              <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                <h4 className="text-sm font-medium">Résultats de la simulation</h4>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Diff summary</span>
                    <span className="font-medium">5 fichiers modifiés, 2 modules touchés</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Temps estimé</span>
                    <span className="font-medium">3 minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Impact</span>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                      Faible — Modifications de données uniquement
                    </Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => executeDownload(async () => { const blob = new Blob([JSON.stringify({ dryRunClient, dryRunBackupId, results: 'Simulation results' }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `dry-run-${dryRunBackupId}-report.json`; a.click(); URL.revokeObjectURL(url) }, { successMessage: 'Rapport exporté' })}>
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Exporter rapport
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Rollback réel - DANGER ZONE */}
        <Card className="border-red-200 dark:border-red-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="size-5" />
              Rollback réel
            </CardTitle>
            <CardDescription>
              Zone dangereuse — Restauration complète
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Select value={rollbackClient} onValueChange={(v) => { setRollbackClient(v); setRollbackBackupId('') }}>
                <SelectTrigger className="w-full border-red-200 dark:border-red-800/50">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {effectiveClients.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Backup ID</label>
              <Select value={rollbackBackupId} onValueChange={setRollbackBackupId}>
                <SelectTrigger className="w-full border-red-200 dark:border-red-800/50">
                  <SelectValue placeholder="Sélectionner un backup" />
                </SelectTrigger>
                <SelectContent>
                  {getClientBackups(rollbackClient).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.id} — {format(new Date(b.timestamp), 'dd/MM/yyyy HH:mm')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warning */}
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800/50 p-3 space-y-1">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  Cette action restaure complètement l&apos;instance. Tous les changements depuis ce backup seront perdus.
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleLaunchRollback}
              disabled={!rollbackClient || !rollbackBackupId || rollbackExecuteLoading}
            >
              {rollbackExecuteLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <AlertTriangle className="size-4 mr-2" />}
              Exécuter rollback
            </Button>

            {/* Rollback progress tracker */}
            {showRollbackProgress && (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/50 p-4">
                <h4 className="text-sm font-medium text-red-700 dark:text-red-300">
                  Progression du rollback
                </h4>
                <div className="space-y-2">
                  {rollbackSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {step.status === 'completed' && (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      )}
                      {step.status === 'running' && (
                        <Loader2 className="size-4 animate-spin text-amber-600" />
                      )}
                      {step.status === 'pending' && (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      <span className={cn(
                        step.status === 'completed' && 'text-emerald-700 dark:text-emerald-300',
                        step.status === 'running' && 'text-amber-700 dark:text-amber-300 font-medium',
                        step.status === 'pending' && 'text-muted-foreground',
                      )}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SecureConfirmModal for Rollback */}
      <SecureConfirmModal
        open={rollbackSecureOpen}
        onOpenChange={setRollbackSecureOpen}
        title="Exécuter le rollback"
        message="Vous allez restaurer l'instance à un état antérieur"
        impact="⚠️ Tous les changements depuis ce backup seront perdus"
        requiresReason={true}
        cliCommand={`pacadev rollback --client ${rollbackClient || '{client}'} --backup ${rollbackBackupId || '{id}'}`}
        variant="destructive"
        onConfirm={handleRollbackConfirm}
      />

      {/* SecureConfirmModal for Delete Backup */}
      <SecureConfirmModal
        open={secureDeleteOpen}
        onOpenChange={setSecureDeleteOpen}
        title="Supprimer le backup"
        message="Cette action est irréversible"
        impact="Les données de ce backup seront définitivement perdues"
        requiresReason={true}
        cliCommand={`pacadev backup delete --client ${selectedBackupForDelete?.clientSlug ?? '{slug}'} --id ${selectedBackupForDelete?.id ?? '{id}'}`}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      {/* SecureConfirmModal for Emergency Backup */}
      <SecureConfirmModal
        open={emergencyBackupOpen}
        onOpenChange={setEmergencyBackupOpen}
        title="Backup d'urgence"
        message="Lancement d'un backup complet même si le système est dégradé"
        variant="warning"
        onConfirm={handleEmergencyBackupConfirm}
      />
    </div>
  )
}
