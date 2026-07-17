'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

const shortcuts = [
  { keys: 'Ctrl+N', description: 'Nouveau ticket' },
  { keys: 'Ctrl+W', description: 'Démarrer workspace' },
  { keys: 'Ctrl+L', description: 'Ouvrir logs' },
  { keys: 'Ctrl+K', description: 'Recherche globale' },
  { keys: '?', description: 'Aide (cette fenêtre)' },
  { keys: 'g d', description: 'Tableau de bord' },
  { keys: 'g c', description: 'Clients' },
  { keys: 'g w', description: 'Workspace' },
]

const colorLegend = [
  { emoji: '🟢', label: 'OK', description: 'Succès / opérationnel' },
  { emoji: '🟡', label: 'En cours', description: 'En cours d\'exécution / attention' },
  { emoji: '🔴', label: 'Échec', description: 'Erreur / critique' },
  { emoji: '⏸️', label: 'En attente', description: 'En attente / inactif' },
]

export function HelpDialog() {
  const { helpDialogOpen, setHelpDialogOpen } = useAppStore()

  return (
    <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier & Aide</DialogTitle>
          <DialogDescription>
            Raccourcis disponibles dans PACADEV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Keyboard shortcuts */}
          <div>
            <h3 className="text-sm font-semibold mb-3">⌨️ Raccourcis clavier</h3>
            <div className="space-y-1.5">
              {shortcuts.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{s.description}</span>
                  <kbd className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-700 dark:text-slate-300 min-w-[60px] justify-center">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Color legend */}
          <div>
            <h3 className="text-sm font-semibold mb-3">🎨 Légende des couleurs</h3>
            <div className="space-y-1.5">
              {colorLegend.map((c) => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className="text-base">{c.emoji}</span>
                  <span className="text-sm font-medium w-20">{c.label}</span>
                  <span className="text-sm text-muted-foreground">{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setHelpDialogOpen(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
