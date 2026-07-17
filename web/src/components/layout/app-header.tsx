'use client'

import { Bell, Moon, Search, Sun, ChevronRight, User, Ticket, Play, Activity, AlertTriangle } from 'lucide-react'
import { useTheme } from 'next-themes'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type AppView } from '@/lib/store'
import type { UserRole } from '@/lib/types'

const viewLabels: Record<AppView, string> = {
  dashboard: 'Tableau de bord',
  clients: 'Clients',
  workspace: 'Workspace',
  pipeline: 'Pipeline CI/CD',
  ai: 'IA & Risque',
  backup: 'Backup',
  observability: 'Observabilité',
  audit: 'Audit',
}

const roleItems: { value: UserRole; label: string }[] = [
  { value: 'dev', label: 'Développeur' },
  { value: 'lead', label: 'Tech Lead' },
  { value: 'admin', label: 'Administrateur' },
  { value: 'client', label: 'Client' },
]

const roleBadgeColors: Record<UserRole, string> = {
  dev: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  lead: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  admin: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  client: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
}

export function AppHeader() {
  const { currentView, setUserRole, userRole, unreadAlerts, setCommandPaletteOpen, setTicketCreatorOpen, setCurrentView } = useAppStore()
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb className="hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" onClick={(e) => e.preventDefault()}>
              PACADEV
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="size-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{viewLabels[currentView]}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        {/* Quick Action Buttons */}
        <div className="hidden md:flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  setTicketCreatorOpen(true)
                  setCurrentView('workspace')
                }}
              >
                <Ticket className="size-3.5" />
                <span className="hidden lg:inline">Nouveau Ticket</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Créer un nouveau ticket</p>
              <p className="text-xs text-muted-foreground">Ctrl+N</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setCurrentView('workspace')}
              >
                <Play className="size-3.5" />
                <span className="hidden lg:inline">Démarrer Work</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Démarrer un environnement de travail</p>
              <p className="text-xs text-muted-foreground">Ctrl+W</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setCurrentView('observability')}
              >
                <Activity className="size-3.5" />
                <span className="hidden lg:inline">Logs</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ouvrir les logs</p>
              <p className="text-xs text-muted-foreground">Ctrl+L</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4 hidden md:block" />

        {/* Search Button */}
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex gap-2 text-muted-foreground h-8"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="size-3.5" />
          <span className="text-xs">Rechercher</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden size-8"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="size-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Role Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 h-8">
              <User className="size-3.5" />
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 h-4 ${roleBadgeColors[userRole]}`}
              >
                {roleItems.find((r) => r.value === userRole)?.label}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Changer de rôle</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {roleItems.map((role) => (
              <DropdownMenuItem
                key={role.value}
                onClick={() => setUserRole(role.value)}
                className={userRole === role.value ? 'bg-accent' : ''}
              >
                {role.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative size-8" onClick={() => setCurrentView('audit')}>
              <Bell className="size-4" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {unreadAlerts}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{unreadAlerts} alerte{unreadAlerts > 1 ? 's' : ''} non lue{unreadAlerts > 1 ? 's' : ''}</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Basculer le thème</span>
        </Button>
      </div>
    </header>
  )
}
