'use client'

import { useEffect } from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { DashboardGlobal } from '@/components/modules/dashboard'
import { EspaceClient } from '@/components/modules/client-space'
import { WorkspaceModule } from '@/components/modules/workspace'
import { PipelineModule } from '@/components/modules/pipeline'
import { AICenterModule } from '@/components/modules/ai-center'
import { BackupModule } from '@/components/modules/backup'
import { ObservabilityModule } from '@/components/modules/observability'
import { AuditModule } from '@/components/modules/audit'
import { useAppStore, type AppView, type RealTicket, type RealPipeline } from '@/lib/store'
import type { ClientData } from '@/lib/types'
import { useWebSocket } from '@/hooks/use-websocket'
import { KeyboardShortcuts } from '@/components/shared/keyboard-shortcuts'

const viewComponents: Record<AppView, React.ComponentType> = {
  dashboard: DashboardGlobal,
  clients: EspaceClient,
  workspace: WorkspaceModule,
  pipeline: PipelineModule,
  ai: AICenterModule,
  backup: BackupModule,
  observability: ObservabilityModule,
  audit: AuditModule,
}

function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { subscribe } = useWebSocket()

  useEffect(() => {
    return subscribe('alert:new', () => {
      const { unreadAlerts, setUnreadAlerts } = useAppStore.getState()
      setUnreadAlerts(unreadAlerts + 1)
    })
  }, [subscribe])

  return <>{children}</>
}

function mapConclusion(c: string | null): string {
  if (c === 'success') return 'success'
  if (c === 'failure') return 'failed'
  if (c === 'skipped') return 'skipped'
  if (c === 'in_progress') return 'running'
  return 'pending'
}

function DataLoader() {
  const { setRealClients, setRealTickets, setRealPipelines, setDataLoaded } = useAppStore()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/clients')
        const data = await res.json()
        if (!data.success) return
        const clients: ClientData[] = data.data
        setRealClients(clients)

        const ticketMap: Record<string, RealTicket[]> = {}
        await Promise.all(
          clients.map(async (c) => {
            try {
              const ir = await fetch(`/api/clients/${c.slug}/issues`)
              const id = await ir.json()
              if (id.success && id.data.length > 0) {
                ticketMap[c.slug] = id.data.map((issue: { number: number; title: string; state: string; labels: string[]; assignees: string[]; createdAt: string; updatedAt: string; url?: string; body?: string; client?: string }) => ({
                  id: issue.number,
                  title: issue.title,
                  status: issue.labels?.includes('in_progress') ? 'in_progress' : (issue.state as 'open' | 'closed'),
                  assignee: issue.assignees?.[0] ?? null,
                  labels: issue.labels ?? [],
                  createdAt: issue.createdAt,
                  updatedAt: issue.updatedAt,
                  url: issue.url,
                  body: issue.body,
                  client: issue.client,
                }))
              }
            } catch { /* skip client */ }
          })
        )
        setRealTickets(ticketMap)

        // Fetch pipelines for clients that have a known repo
        const allPipelines: RealPipeline[] = []
        await Promise.all(
          clients.map(async (c) => {
            try {
              const pr = await fetch(`/api/clients/${c.slug}/pipeline?limit=5`)
              const pd = await pr.json()
              if (pd.success && pd.data.length > 0) {
                for (const run of pd.data) {
                  const jobs: { name: string; conclusion: string | null }[] = run.jobs ?? []
                  const jobStatus = (keyword: string) => {
                    const j = jobs.find((j) => j.name.toLowerCase().includes(keyword.toLowerCase()))
                    return mapConclusion(j?.conclusion ?? null)
                  }
                  allPipelines.push({
                    id: String(run.id),
                    clientId: c.id,
                    clientSlug: c.slug,
                    commitHash: run.commitHash ?? null,
                    branch: run.branch ?? null,
                    trigger: 'push',
                    status: run.conclusion === 'success' ? 'success' : run.conclusion === 'failure' ? 'failed' : run.status === 'in_progress' ? 'running' : 'pending',
                    conclusion: run.conclusion,
                    lintStatus: jobStatus('lint') || jobStatus('check'),
                    testsStatus: jobStatus('test'),
                    securityStatus: jobStatus('security') || jobStatus('secur'),
                    aiRiskStatus: jobStatus('ai') || jobStatus('risk'),
                    deployStatus: jobStatus('deploy'),
                    duration: null,
                    url: run.url ?? null,
                    createdAt: run.createdAt,
                  })
                }
              }
            } catch { /* skip */ }
          })
        )
        if (allPipelines.length > 0) setRealPipelines(allPipelines)
      } catch { /* keep mock data */ } finally {
        setDataLoaded(true)
      }
    }
    load()
  }, [setRealClients, setRealTickets, setDataLoaded])

  return null
}

export default function Home() {
  const { currentView } = useAppStore()
  const ViewComponent = viewComponents[currentView] ?? DashboardGlobal

  return (
    <WebSocketProvider>
      <DataLoader />
      <KeyboardShortcuts />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <main className="flex-1 overflow-auto">
            <ViewComponent />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WebSocketProvider>
  )
}
