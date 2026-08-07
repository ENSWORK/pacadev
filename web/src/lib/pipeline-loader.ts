import type { RealPipeline } from '@/lib/store'

export function mapConclusion(c: string | null): string {
  if (c === 'success') return 'success'
  if (c === 'failure') return 'failed'
  if (c === 'skipped') return 'skipped'
  if (c === 'in_progress') return 'running'
  return 'pending'
}

export interface ClientWithSlug {
  id: string
  slug: string
}

export async function loadPipelines(clients: ClientWithSlug[]): Promise<RealPipeline[]> {
  const allPipelines: RealPipeline[] = []
  await Promise.all(
    clients.map(async (c) => {
      try {
        const pr = await fetch(`/api/clients/${c.slug}/pipeline?limit=5`)
        const pd = await pr.json()
        if (!pd.success || !pd.data?.length) return
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
            status:
              run.conclusion === 'success'
                ? 'success'
                : run.conclusion === 'failure'
                  ? 'failed'
                  : run.status === 'in_progress'
                    ? 'running'
                    : 'pending',
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
      } catch {
        /* skip client */
      }
    }),
  )
  return allPipelines
}
