'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Shield,
  Brain,
  FileCode2,
  Eye,
  Wrench,
  Bug,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Settings,
  History,
  Filter,
  Save,
  Code2,
  FolderOpen,
  FileX2,
  BookOpen,
  BarChart3,
  Loader2,
  Lock,
  Key,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/shared/status-badge'
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
import { RiskGauge } from '@/components/shared/risk-gauge'
import { AuditTable } from '@/components/shared/audit-table'
import type { SuggestionType, SuggestionStatus, AuditLog, AIConfig } from '@/lib/types'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/use-async-action'
import { useToast } from '@/hooks/use-toast'
import { aiApi } from '@/lib/api'

// ============ Risk factors config ============
const riskFactorLabels: Record<string, string> = {
  schemaChanges: 'Changements schéma',
  securityPatterns: 'Patterns sécurité',
  depChanges: 'Changements dépendances',
  bizLogicChanges: 'Logique métier',
}

const riskFactorColors: Record<string, string> = {
  schemaChanges: 'bg-red-500',
  securityPatterns: 'bg-orange-500',
  depChanges: 'bg-amber-500',
  bizLogicChanges: 'bg-emerald-500',
}

// ============ Suggestion type config ============
const suggestionTypeConfig: Record<SuggestionType, { label: string; color: string; icon: React.ElementType }> = {
  fix_lint: {
    label: 'Lint',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: Code2,
  },
  migration: {
    label: 'Migration',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    icon: ArrowRight,
  },
  missing_test: {
    label: 'Test manquant',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: Bug,
  },
  refactor: {
    label: 'Refactor',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: Wrench,
  },
  security: {
    label: 'Sécurité',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: Shield,
  },
}

// ============ Mock data for Context IA section ============
const mockFilesInScope = [
  'addons/acmecorp_custom/controllers/sale_order.py',
  'addons/acmecorp_custom/models/sale_order.py',
  'addons/acmecorp_custom/views/sale_order_views.xml',
  'addons/acmecorp_reports/report/sale_report.py',
  'addons/acmecorp_reports/__manifest__.py',
  'requirements.txt',
  'odoo/conf/deploy.yml',
  '.github/workflows/deploy.yml',
]

const mockAiIgnoreRules = [
  '*.pyc',
  '__pycache__/',
  '*.pot',
  'i18n/*.po',
]

const mockConventions = [
  'OCA guidelines v17',
  'Pas de SQL direct dans les contrôleurs',
  'Tests unitaires obligatoires pour les modèles custom',
]

// ============ Score risque en temps réel ============
function ScoreRisqueTempsReel() {
  const { userRole, realClients } = useAppStore()
  const defaultClient = realClients[0]?.slug ?? ''
  const [selectedClient, setSelectedClient] = useState(defaultClient)
  const [realRisk, setRealRisk] = useState<{ score: number; schemaChanges: number; securityPatterns: number; depChanges: number; bizLogicChanges: number; recommendation: string | null; explanation: string | null } | null>(null)
  const [riskLoading, setRiskLoading] = useState(false)

  useEffect(() => {
    setRiskLoading(true)
    fetch(`/api/clients/${selectedClient}/ai/risk`)
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data) setRealRisk(d.data) })
      .catch(() => {})
      .finally(() => setRiskLoading(false))
  }, [selectedClient])

  const risk = realRisk

  const riskFactors = risk
    ? [
        { key: 'schemaChanges', value: risk.schemaChanges },
        { key: 'securityPatterns', value: risk.securityPatterns },
        { key: 'depChanges', value: risk.depChanges },
        { key: 'bizLogicChanges', value: risk.bizLogicChanges },
      ]
    : []

  const maxFactorValue = Math.max(...riskFactors.map((f) => f.value), 1)

  const { loading: overrideLoading, execute: executeOverride } = useAsyncAction()

  const handleOverride = useCallback((_reason: string) => {
    executeOverride(() => aiApi.updateConfig({ riskOverride: true }), { successMessage: 'Risk override enregistré' })
  }, [executeOverride])

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="size-5 text-emerald-600 dark:text-emerald-400" />
            Score risque en temps réel
          </CardTitle>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {realClients.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {riskLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> Chargement score risque…
          </div>
        ) : risk ? (
          <>
            <RiskGauge
              score={risk.score}
              explanation={risk.explanation ?? undefined}
              onOverride={handleOverride}
              userRole={userRole}
            />

            {/* Recommendation badge */}
            <div className="flex items-center justify-center">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  risk.recommendation === 'auto_merge'
                    ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                    : risk.recommendation === 'review_required'
                      ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                      : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300',
                )}
              >
                {risk.recommendation === 'auto_merge'
                  ? '✓ Auto-merge possible'
                  : risk.recommendation === 'review_required'
                    ? '⚠ Review requise'
                    : '⊘ Manuel uniquement'}
              </Badge>
            </div>

            {/* Risk factors */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Facteurs de risque
              </p>
              {riskFactors.map((factor) => (
                <div key={factor.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{riskFactorLabels[factor.key]}</span>
                    <span className="font-mono font-medium">{factor.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', riskFactorColors[factor.key])}
                      style={{ width: `${(factor.value / maxFactorValue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Explanation */}
            {risk.explanation && (
              <div className="rounded-md border bg-muted/30 p-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <Brain className="size-3 inline mr-1" />
                  {risk.explanation}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Shield className="size-8 mb-2 opacity-40" />
            <p className="text-sm">Aucune donnée de risque</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ Suggestions IA ============
function SuggestionsIA() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [applyWarningOpen, setApplyWarningOpen] = useState(false)
  const [sensitivePromptOpen, setSensitivePromptOpen] = useState(false)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null)
  const { loading: applyLoading, execute: executeApply } = useAsyncAction()
  const { loading: ignoreLoading, execute: executeIgnore } = useAsyncAction()
  const { toast } = useToast()

  const [allSuggestions, setAllSuggestions] = useState<{ id: string; type: SuggestionType; title: string; description: string | null; status: SuggestionStatus; codeDiff: string | null; impact: string | null }[]>([])

  const filteredSuggestions = useMemo(() => {
    if (statusFilter === 'all') return allSuggestions
    return allSuggestions.filter((s) => s.status === statusFilter)
  }, [statusFilter, allSuggestions])

  const handleApply = (id: string) => {
    setSelectedSuggestionId(id)
    setApplyWarningOpen(true)
  }

  const handleConfirmApply = () => {
    if (!selectedSuggestionId) return
    const slug = 'acmecorp'
    executeApply(
      () => aiApi.applySuggestion(slug, selectedSuggestionId),
      { successMessage: 'Suggestion appliquée — PR créée' }
    )
    setApplyWarningOpen(false)
    setSelectedSuggestionId(null)
  }

  const handleModifierPrompt = (id: string) => {
    setSelectedSuggestionId(id)
    setSensitivePromptOpen(true)
  }

  const handleConfirmSensitivePrompt = () => {
    setSensitivePromptOpen(false)
    setSelectedSuggestionId(null)
    toast({ title: 'Succès', description: 'Prompt envoyé à l\'IA externe' })
  }

  const handleUseLocalModel = () => {
    setSensitivePromptOpen(false)
    setSelectedSuggestionId(null)
    toast({ title: 'Modèle local', description: 'Basculé vers Ollama (local) pour ce prompt' })
  }

  const selectedSuggestion = allSuggestions.find((s) => s.id === selectedSuggestionId)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-amber-600 dark:text-amber-400" />
            Suggestions IA
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="w-[130px]">
              <Filter className="size-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="applied">Appliquées</SelectItem>
              <SelectItem value="ignored">Ignorées</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          {filteredSuggestions.length} suggestion{filteredSuggestions.length !== 1 ? 's' : ''} IA
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-[480px] pr-3">
          <div className="space-y-3">
            {filteredSuggestions.map((suggestion) => {
              const typeConf = suggestionTypeConfig[suggestion.type]
              const TypeIcon = typeConf.icon

              return (
                <div
                  key={suggestion.id}
                  className="rounded-lg border p-3 space-y-2.5 hover:bg-muted/20 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className={cn('text-[10px] h-5 gap-1', typeConf.color)}>
                        <TypeIcon className="size-3" />
                        {typeConf.label}
                      </Badge>
                      <StatusBadge status={suggestion.status} size="sm" />
                    </div>
                  </div>

                  {/* Title and description */}
                  <div>
                    <p className="font-medium text-sm">{suggestion.title}</p>
                    {suggestion.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {suggestion.description}
                      </p>
                    )}
                  </div>

                  {/* Code diff */}
                  {suggestion.codeDiff && (
                    <div className="rounded-md border bg-muted/40 overflow-hidden">
                      <div className="px-2 py-1 border-b bg-muted/60 flex items-center gap-1.5">
                        <FileCode2 className="size-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-medium">Diff</span>
                      </div>
                      <pre className="p-2 text-[11px] font-mono overflow-x-auto custom-scrollbar max-h-24">
                        <code>
                          {suggestion.codeDiff.split('\n').map((line, i) => (
                            <div
                              key={i}
                              className={cn(
                                line.startsWith('-') && 'text-red-600 dark:text-red-400',
                                line.startsWith('+') && 'text-emerald-600 dark:text-emerald-400',
                                line.startsWith('@@') && 'text-amber-600 dark:text-amber-400',
                              )}
                            >
                              {line}
                            </div>
                          ))}
                        </code>
                      </pre>
                    </div>
                  )}

                  {/* Impact */}
                  {suggestion.impact && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BarChart3 className="size-3" />
                      <span>Impact : {suggestion.impact}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={suggestion.status !== 'pending' || applyLoading}
                      onClick={() => handleApply(suggestion.id)}
                    >
                      {applyLoading ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                      Appliquer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      disabled={suggestion.status !== 'pending' || ignoreLoading}
                      onClick={() => executeIgnore(() => aiApi.updateConfig({ ignoredSuggestion: suggestion.id }), { successMessage: 'Suggestion ignorée' })}
                    >
                      <XCircle className="size-3" />
                      Ignorer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={suggestion.status !== 'pending'}
                      onClick={() => handleModifierPrompt(suggestion.id)}
                    >
                      <Settings className="size-3" />
                      Modifier prompt
                    </Button>
                  </div>
                </div>
              )
            })}

            {filteredSuggestions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Sparkles className="size-8 mb-2 opacity-40" />
                <p className="text-sm">Aucune suggestion pour ce filtre</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Apply warning dialog */}
      <Dialog open={applyWarningOpen} onOpenChange={setApplyWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Confirmer l&apos;application
            </DialogTitle>
            <DialogDescription>
              Cette action générera une Pull Request et nécessitera une review avant merge.
            </DialogDescription>
          </DialogHeader>
          {selectedSuggestion && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suggestion</span>
                <span className="font-medium">{selectedSuggestion.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {suggestionTypeConfig[selectedSuggestion.type].label}
                </Badge>
              </div>
              {selectedSuggestion.impact && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impact</span>
                  <span className="text-xs">{selectedSuggestion.impact}</span>
                </div>
              )}
            </div>
          )}
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
            <div className="flex gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Cette action va :
                </p>
                <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-0.5">
                  <li>Générer une Pull Request avec les modifications proposées</li>
                  <li>Exiger une review avant tout merge</li>
                  <li>Déclencher le pipeline CI/CD automatiquement</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApplyWarningOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmApply} className="gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Confirmer et créer la PR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sensitive prompt warning dialog */}
      <Dialog open={sensitivePromptOpen} onOpenChange={setSensitivePromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Prompt sensible détecté
            </DialogTitle>
            <DialogDescription>
              Ce prompt contient du code métier sensible
            </DialogDescription>
          </DialogHeader>
          {selectedSuggestion && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suggestion</span>
                <span className="font-medium">{selectedSuggestion.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {suggestionTypeConfig[selectedSuggestion.type].label}
                </Badge>
              </div>
            </div>
          )}
          <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3">
            <div className="flex gap-2">
              <Shield className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-red-800 dark:text-red-200">
                  Ce prompt contient du code métier sensible
                </p>
                <ul className="list-disc list-inside text-red-700 dark:text-red-300 space-y-0.5">
                  <li>Des patterns métier critiques ont été détectés</li>
                  <li>L&apos;envoi à une IA externe peut exposer des données sensibles</li>
                  <li>Un modèle local est recommandé pour ce type de contenu</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
            <div className="flex gap-2">
              <Lock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">Action requise</p>
                <p className="text-amber-700 dark:text-amber-300">
                  Confirmez l&apos;envoi à l&apos;IA externe ou utilisez un modèle local pour protéger vos données.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSensitivePromptOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="outline"
              onClick={handleUseLocalModel}
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
            >
              <Lock className="size-3.5" />
              Utiliser modèle local (Ollama)
            </Button>
            <Button
              onClick={handleConfirmSensitivePrompt}
              className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              <AlertTriangle className="size-3.5" />
              Confirmer l&apos;envoi à l&apos;IA externe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============ Contexte envoyé à l'IA ============
function ContexteIA() {
  const [scopeEditOpen, setScopeEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const { loading: scopeLoading, execute: executeScopeUpdate } = useAsyncAction()
  const { loading: historyLoading, execute: executeHistoryFetch } = useAsyncAction()

  const handleEditScope = () => {
    setScopeEditOpen(true)
  }

  const handleViewHistory = () => {
    executeHistoryFetch(() => aiApi.getUsage(), { successMessage: 'Historique chargé' })
    setHistoryOpen(true)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="size-5 text-amber-600 dark:text-amber-400" />
            Contexte envoyé à l&apos;IA
          </CardTitle>
        </div>
        <CardDescription>Fichiers, règles et conventions inclus dans le prompt IA</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Files in scope */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <FolderOpen className="size-3" />
              Fichiers en scope ({mockFilesInScope.length})
            </div>
            <div className="rounded-md border bg-muted/20 p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              {mockFilesInScope.map((file) => (
                <div key={file} className="flex items-center gap-1.5 text-xs font-mono text-foreground/80 py-0.5">
                  <FileCode2 className="size-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{file}</span>
                </div>
              ))}
            </div>
          </div>

          {/* .aiignore rules */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <FileX2 className="size-3" />
              .aiignore ({mockAiIgnoreRules.length})
            </div>
            <div className="rounded-md border bg-muted/20 p-2 space-y-1">
              {mockAiIgnoreRules.map((rule) => (
                <div key={rule} className="flex items-center gap-1.5 text-xs font-mono text-red-600/70 dark:text-red-400/70 py-0.5">
                  <XCircle className="size-3 shrink-0" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conventions */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <BookOpen className="size-3" />
              Conventions ({mockConventions.length})
            </div>
            <div className="rounded-md border bg-muted/20 p-2 space-y-1.5">
              {mockConventions.map((conv) => (
                <div key={conv} className="flex items-start gap-1.5 text-xs text-foreground/80 py-0.5">
                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{conv}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={scopeLoading}
            onClick={handleEditScope}
          >
            <FolderOpen className="size-3.5" />
            Éditer scope
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={historyLoading}
            onClick={handleViewHistory}
          >
            <History className="size-3.5" />
            Voir historique prompts
          </Button>
        </div>

        {/* Edit scope dialog */}
        <Dialog open={scopeEditOpen} onOpenChange={setScopeEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Éditer le scope IA</DialogTitle>
              <DialogDescription>
                Modifier les fichiers et dossiers inclus dans le contexte envoyé à l&apos;IA.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Fichiers en scope</Label>
                <div className="rounded-md border bg-muted/20 p-2 space-y-1 max-h-40 overflow-y-auto">
                  {mockFilesInScope.map((file) => (
                    <div key={file} className="flex items-center gap-2 text-xs font-mono py-0.5">
                      <FileCode2 className="size-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{file}</span>
                      <Button variant="ghost" size="sm" className="size-5 h-auto p-0 text-red-500">
                        <XCircle className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ajouter un fichier</Label>
                <Input placeholder="chemin/vers/le/fichier.py" className="h-8 text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScopeEditOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => { executeScopeUpdate(() => aiApi.updateConfig({ scope: mockFilesInScope }), { successMessage: 'Scope sauvegardé' }); setScopeEditOpen(false) }}>
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Historique des prompts</DialogTitle>
              <DialogDescription>
                Derniers prompts envoyés à l&apos;IA pour ce client.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {[
                  { time: '13/05/2026 14:30', prompt: 'Analyse du risque pour acmecorp commit abc123', tokens: 2450 },
                  { time: '13/05/2026 12:15', prompt: 'Suggestions d\'amélioration pour acmecorp_custom', tokens: 3200 },
                  { time: '12/05/2026 18:45', prompt: 'Vérification sécurité module reports', tokens: 1800 },
                  { time: '12/05/2026 10:00', prompt: 'Review des changements schema pour globex', tokens: 4100 },
                ].map((entry, i) => (
                  <div key={i} className="rounded-md border p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{entry.time}</span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {entry.tokens} tokens
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/80">{entry.prompt}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// ============ Sécurité IA ============
function SecuriteIA() {
  const [filteringEnabled, setFilteringEnabled] = useState(true)
  const [testFilteringOpen, setTestFilteringOpen] = useState(false)
  const [configRulesOpen, setConfigRulesOpen] = useState(false)
  const { toast } = useToast()

  const handleGenerateReport = () => {
    toast({ title: 'Succès', description: 'Rapport généré' })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="size-5 text-emerald-600 dark:text-emerald-400" />
          Sécurité IA
        </CardTitle>
        <CardDescription>Filtrage des secrets, validation des prompts et audit des décisions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 1. Filtrage des secrets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium">Filtrage des secrets</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filtering-toggle" className="text-xs text-muted-foreground cursor-pointer">
                Filtrage automatique activé
              </Label>
              <Switch
                id="filtering-toggle"
                checked={filteringEnabled}
                onCheckedChange={setFilteringEnabled}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-2.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-medium">Mots de passe</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">0 bloqués</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-2.5">
              <Key className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-medium">Clés API</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">0 bloquées</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-2.5">
              <Eye className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-medium">Tokens</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">0 bloqués</p>
              </div>
            </div>
          </div>

          <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 text-[10px]">
            ℹ️ 3 tentatives de fuite bloquées ce mois
          </Badge>
        </div>

        <Separator />

        {/* 2. Validation prompts sensibles */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium">Validation prompts sensibles</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Les prompts contenant du code métier sensible nécessitent une confirmation avant envoi à l&apos;IA externe.
            Un avertissement s&apos;affichera lors de la modification d&apos;un prompt sensible dans les suggestions IA.
          </p>
        </div>

        <Separator />

        {/* 3. Audit des décisions IA */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">Audit des décisions IA</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              12 décisions ce mois —{' '}
              <span className="text-emerald-600 dark:text-emerald-400 underline decoration-dotted underline-offset-2 cursor-pointer hover:decoration-solid">
                voir détails
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleGenerateReport}
              >
                📊 Rapport mensuel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setConfigRulesOpen(true)}
              >
                ⚙️ Configurer règles
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* 4. Test filtering */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">Test de filtrage</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setTestFilteringOpen(true)}
          >
            🔒 Tester filtrage
          </Button>
        </div>

        {/* Test filtering dialog */}
        <Dialog open={testFilteringOpen} onOpenChange={setTestFilteringOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="size-5 text-emerald-600 dark:text-emerald-400" />
                Test de filtrage des secrets
              </DialogTitle>
              <DialogDescription>
                Simulation de l&apos;envoi de code contenant des secrets vers l&apos;IA externe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {/* Password test */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ Secret détecté et bloqué
                  </span>
                </div>
                <div className="rounded-md bg-muted/60 p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">Input :</p>
                  <code className="text-xs font-mono text-red-600 dark:text-red-400">
                    DB_PASSWORD = &quot;super_secret_123&quot;
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pattern : <span className="font-mono font-medium">password assignment</span>
                </p>
              </div>

              {/* API key test */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ Secret détecté et bloqué
                  </span>
                </div>
                <div className="rounded-md bg-muted/60 p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">Input :</p>
                  <code className="text-xs font-mono text-red-600 dark:text-red-400">
                    API_KEY = &quot;sk-abc123xyz456&quot;
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pattern : <span className="font-mono font-medium">API key assignment</span>
                </p>
              </div>

              {/* Token test */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ Secret détecté et bloqué
                  </span>
                </div>
                <div className="rounded-md bg-muted/60 p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">Input :</p>
                  <code className="text-xs font-mono text-red-600 dark:text-red-400">
                    AUTH_TOKEN = &quot;eyJhbGciOiJIUzI1NiJ9...&quot;
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pattern : <span className="font-mono font-medium">token/JWT assignment</span>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestFilteringOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Config rules dialog */}
        <Dialog open={configRulesOpen} onOpenChange={setConfigRulesOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurer les règles de sécurité</DialogTitle>
              <DialogDescription>
                Modifier les règles de filtrage et les patterns de détection des secrets.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Patterns de détection actifs</Label>
                <div className="rounded-md border bg-muted/20 p-2 space-y-1.5">
                  {[
                    { pattern: 'password\\s*=\\s*["\']', label: 'Mots de passe' },
                    { pattern: 'api_key\\s*=\\s*["\']', label: 'Clés API' },
                    { pattern: 'token\\s*=\\s*["\']', label: 'Tokens' },
                    { pattern: 'secret\\s*=\\s*["\']', label: 'Secrets' },
                  ].map((rule) => (
                    <div key={rule.pattern} className="flex items-center gap-2 text-xs font-mono py-0.5">
                      <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                      <span className="flex-1 truncate text-foreground/80">{rule.pattern}</span>
                      <Badge variant="secondary" className="text-[10px] h-4">{rule.label}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ajouter un pattern</Label>
                <Input placeholder="regex pattern" className="h-8 text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigRulesOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  setConfigRulesOpen(false)
                  toast({ title: 'Succès', description: 'Règles sauvegardées' })
                }}
              >
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// ============ Historique décisions IA ============
function HistoriqueDecisionsIA() {
  const aiActionFilter = ['deploy', 'ai_config', 'approve', 'rollback']
  const [aiLogs, setAiLogs] = useState<AuditLog[]>([])
  useEffect(() => {
    fetch('/api/audit?action=deploy')
      .then(r => r.json())
      .then(d => { if (d.success) setAiLogs(d.data.filter((l: AuditLog) => aiActionFilter.includes(l.action))) })
      .catch(() => {})
  }, [])

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="size-5 text-emerald-600 dark:text-emerald-400" />
          Historique décisions IA
        </CardTitle>
        <CardDescription>
          Journal des actions liées à l&apos;IA et aux déploiements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuditTable logs={aiLogs} />
      </CardContent>
    </Card>
  )
}

// ============ Configuration modèles ============
function ConfigurationModeles() {
  const [model, setModel] = useState('claude-3.5-sonnet')
  const [maxTokens, setMaxTokens] = useState('4000')
  const [fallbackModel, setFallbackModel] = useState('gpt-4o')
  const [costThreshold, setCostThreshold] = useState('50')
  useEffect(() => {
    fetch('/api/ai/config')
      .then(r => r.json())
      .then((d: { success: boolean; data: AIConfig }) => {
        if (d.success && d.data) {
          setModel(d.data.model)
          setMaxTokens(String(d.data.maxTokens))
          setFallbackModel(d.data.fallbackModel ?? 'gpt-4o')
          setCostThreshold(String(d.data.costThreshold ?? 50))
        }
      })
      .catch(() => {})
  }, [])
  const [saved, setSaved] = useState(false)
  const { loading: saveLoading, execute: executeSave } = useAsyncAction()

  const currentTokensUsed = 245000
  const tokenThreshold = parseInt(maxTokens) * 100
  const tokenUsagePercent = Math.min((currentTokensUsed / (parseInt(costThreshold) * 5000)) * 100, 100)

  const handleSave = () => {
    executeSave(
      () => aiApi.updateConfig({ model, maxTokens: parseInt(maxTokens), fallbackModel, costThreshold: parseFloat(costThreshold) }),
      { successMessage: 'Configuration sauvegardée' }
    ).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="size-5 text-amber-600 dark:text-amber-400" />
          Configuration modèles
        </CardTitle>
        <CardDescription>Paramètres du modèle IA et seuils de coût</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model selector */}
        <div className="space-y-2">
          <Label htmlFor="model-select" className="text-xs">Modèle principal</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="model-select" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="ollama-local">Ollama (local)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max tokens */}
        <div className="space-y-2">
          <Label htmlFor="max-tokens" className="text-xs">Max tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Fallback model */}
        <div className="space-y-2">
          <Label htmlFor="fallback-model" className="text-xs">Modèle de fallback</Label>
          <Select value={fallbackModel} onValueChange={setFallbackModel}>
            <SelectTrigger id="fallback-model" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
              <SelectItem value="ollama-local">Ollama (local)</SelectItem>
              <SelectItem value="none">Aucun</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cost threshold */}
        <div className="space-y-2">
          <Label htmlFor="cost-threshold" className="text-xs">Seuil de coût ($)</Label>
          <Input
            id="cost-threshold"
            type="number"
            value={costThreshold}
            onChange={(e) => setCostThreshold(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Token usage bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Utilisation tokens</Label>
            <span className="text-xs text-muted-foreground">
              {currentTokensUsed.toLocaleString('fr-FR')} / {parseInt(costThreshold) * 5000 > 0 ? (parseInt(costThreshold) * 5000).toLocaleString('fr-FR') : '—'}
            </span>
          </div>
          <Progress
            value={tokenUsagePercent}
            className="h-2"
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span className={cn(
              tokenUsagePercent > 80 ? 'text-red-500' : tokenUsagePercent > 60 ? 'text-amber-500' : 'text-emerald-500',
            )}>
              {tokenUsagePercent.toFixed(0)}%
            </span>
            <span>100%</span>
          </div>
        </div>

        <Separator />

        {/* Save button */}
        <Button
          className="w-full gap-1.5"
          onClick={handleSave}
          disabled={saveLoading}
        >
          {saveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ============ Main AI Center Module ============
export function AICenterModule() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="size-6 text-amber-600 dark:text-amber-400" />
          Centre IA & Risque
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Transparence IA, analyse de risque et configuration des modèles
        </p>
      </div>

      {/* Section 1+2: Score risque + Suggestions IA */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreRisqueTempsReel />
        <SuggestionsIA />
      </div>

      {/* Section 3: Contexte envoyé à l'IA */}
      <ContexteIA />

      {/* Section 4: Sécurité IA */}
      <SecuriteIA />

      {/* Section 5+6: Historique décisions IA + Configuration modèles */}
      <div className="grid gap-6 lg:grid-cols-2">
        <HistoriqueDecisionsIA />
        <ConfigurationModeles />
      </div>
    </div>
  )
}
