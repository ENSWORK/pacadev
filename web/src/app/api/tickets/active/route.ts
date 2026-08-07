import { NextResponse } from 'next/server';
import { readVersionsJSON, getGitHubIssues } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  const versions = readVersionsJSON();
  const repos = new Set<string>();

  for (const client of Object.values(versions.clients)) {
    if (client.current_repo) repos.add(client.current_repo);
  }

  if (repos.size === 0) repos.add('ENSWORK/pacadev');

  const allIssues: ReturnType<typeof getGitHubIssues> = [];
  for (const repo of repos) {
    const issues = getGitHubIssues(repo, 'open', 20);
    allIssues.push(...issues);
  }

  const data = {
    tickets: allIssues,
    total: allIssues.length,
    byStatus: {
      open: allIssues.filter(i => i.state === 'open').length,
      in_progress: allIssues.filter(i => i.labels.includes('status:in-progress')).length,
      review: allIssues.filter(i => i.labels.includes('status:review')).length,
      staging: allIssues.filter(i => i.labels.includes('status:staging')).length,
    },
    source: 'github',
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      cli_equivalent: 'gh issue list --state open',
    },
  };

  return NextResponse.json(response);
}
