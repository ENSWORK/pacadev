'use client'

import { LayoutDashboard, Building2, Briefcase, GitBranch, Brain, Shield, Activity, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type AppView } from '@/lib/store'
import type { UserRole } from '@/lib/types'

const navItems: { key: AppView; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'clients', label: 'Clients', icon: Building2 },
  { key: 'workspace', label: 'Workspace', icon: Briefcase },
  { key: 'pipeline', label: 'Pipeline CI/CD', icon: GitBranch },
  { key: 'ai', label: 'IA & Risque', icon: Brain },
  { key: 'backup', label: 'Backup', icon: Shield },
  { key: 'observability', label: 'Observabilité', icon: Activity },
  { key: 'audit', label: 'Audit', icon: ShieldCheck },
]

const roleLabels: Record<UserRole, string> = {
  dev: 'Développeur',
  lead: 'Tech Lead',
  admin: 'Administrateur',
  client: 'Client',
}

const roleColors: Record<UserRole, string> = {
  dev: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  lead: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  admin: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  client: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
}

export function AppSidebar() {
  const { currentView, setCurrentView, wsConnected, unreadAlerts, userRole } = useAppStore()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
            P
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight">PACADEV</span>
            <span className="text-[10px] text-muted-foreground">Centre de commande Odoo</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={currentView === item.key}
                    onClick={() => setCurrentView(item.key)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.key === 'dashboard' && unreadAlerts > 0 && (
                    <SidebarMenuBadge>{unreadAlerts}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              AD
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium truncate">Admin PACADEV</span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-4 w-fit ${roleColors[userRole]}`}
            >
              {roleLabels[userRole]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 pb-1 group-data-[collapsible=icon]:hidden">
          {wsConnected ? (
            <>
              <Wifi className="size-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">WebSocket connecté</span>
            </>
          ) : (
            <>
              <WifiOff className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Déconnecté</span>
            </>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
