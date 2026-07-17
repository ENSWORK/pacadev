import { NextResponse } from 'next/server';
import { getDashboardStats, readAuditLog } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  try {
    const stats = getDashboardStats();
    const auditLog = readAuditLog();
    const recentDeployments = auditLog
      .filter((a) => a.action === 'deploy')
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        clientId: a.client || 'unknown',
        environment: 'prod',
        versionTag: null,
        triggeredBy: a.user,
        triggerReason: a.details || a.reason,
        status: 'success' as const,
        startedAt: a.createdAt,
        completedAt: a.createdAt,
        backupId: null,
        healthWeb: null,
        healthDb: null,
        healthCron: null,
        rollbackAvailable: false,
      }));

    const data = {
      stats,
      recentDeployments,
      activeAlerts: [],
      services: [],
    };

    const response: APIResponse<typeof data> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: 'pacadev dashboard',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: [`Failed to load dashboard: ${error}`],
      },
      { status: 500 }
    );
  }
}
