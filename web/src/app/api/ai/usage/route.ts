import { NextResponse } from 'next/server';
import { mockDashboardStats } from '@/lib/mock-data';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  const data = {
    tokensUsed: mockDashboardStats.iaTokensUsed,
    costEstimated: mockDashboardStats.iaCostEstimated,
    period: '30d',
    breakdown: {
      riskAssessments: { count: 42, tokens: 82000, cost: 12.30 },
      suggestions: { count: 18, tokens: 98000, cost: 13.80 },
      codeReview: { count: 7, tokens: 65000, cost: 8.40 },
    },
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      cli_equivalent: 'pacadev ai usage',
    },
  };

  return NextResponse.json(response);
}
