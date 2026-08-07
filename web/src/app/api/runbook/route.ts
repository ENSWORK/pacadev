import { NextResponse } from 'next/server';
import type { APIResponse } from '@/lib/types';

const runbookSections: Record<string, { title: string; steps: string[] }> = {
  'p0-down': {
    title: 'P0 - Service Down',
    steps: [
      '1. Vérifier le statut du container Docker: docker ps -a | grep <client>',
      '2. Consulter les logs: docker logs <client>-web --tail 200',
      '3. Vérifier la santé DB: docker exec <client>-db pg_isready',
      '4. Si DB down: docker restart <client>-db && sleep 10',
      '5. Si web down: docker restart <client>-web',
      '6. Vérifier Traefik: curl -s http://localhost:8080/api/http/routers | jq',
      '7. Si rollback nécessaire: pacadev rollback --client <client> --backup <id>',
      '8. Notifier l\'équipe sur #ops-alerts',
    ],
  },
  'p1-degraded': {
    title: 'P1 - Service Dégradé',
    steps: [
      '1. Vérifier les métriques CPU/Memory: docker stats --no-stream',
      '2. Vérifier les logs d\'erreur: pacadev logs --client <client> --level ERROR',
      '3. Vérifier les connexions DB: SELECT count(*) FROM pg_stat_activity',
      '4. Si memory > 90%: docker restart <client>-web',
      '5. Vérifier les cron jobs: docker exec <client>-web odoo cron-status',
      '6. Documenter l\'incident dans le runbook',
    ],
  },
  'p2-deploy-failed': {
    title: 'P2 - Déploiement Échoué',
    steps: [
      '1. Identifier le déploiement: pacadev versions --client <client>',
      '2. Consulter les logs du pipeline: pacadev pipeline --client <client>',
      '3. Identifier l\'étape en échec (lint/tests/security/deploy)',
      '4. Si lint: corriger et repousser',
      '5. Si tests: analyser le rapport de test',
      '6. Si security: consulter le rapport AI risk',
      '7. Si deploy: vérifier le backup pré-déploiement',
      '8. Rollback si nécessaire: pacadev rollback --client <client>',
    ],
  },
  'backup-restore': {
    title: 'Restauration de Backup',
    steps: [
      '1. Lister les backups: pacadev backup list --client <client>',
      '2. Vérifier le backup: pacadev backup verify --id <backup-id>',
      '3. Faire un dry-run: pacadev rollback --client <client> --dry-run --backup <id>',
      '4. Analyser le diff et l\'impact estimé',
      '5. Obtenir l\'approbation (gate obligatoire pour prod)',
      '6. Exécuter le rollback: pacadev rollback --client <client> --backup <id>',
      '7. Vérifier la santé post-rollback: pacadev smoke-test --client <client>',
    ],
  },
  'security-incident': {
    title: 'Incident de Sécurité',
    steps: [
      '1. Isoler le service: docker stop <client>-web',
      '2. Exporter les logs: pacadev logs --client <client> --export',
      '3. Vérifier les accès: tailscale status | grep <client>',
      '4. Rotation des secrets: pacadev secrets edit <client>',
      '5. Scanner les vulnérabilités: pacadev ai risk --client <client>',
      '6. Documenter dans le registre de sécurité',
      '7. Notifier le client si données impactées',
    ],
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  if (section) {
    const runbook = runbookSections[section];

    if (!runbook) {
      const response: APIResponse<null> = {
        success: false,
        data: null,
        errors: [`Runbook section "${section}" not found. Available sections: ${Object.keys(runbookSections).join(', ')}`],
        meta: {
          timestamp: new Date().toISOString(),
          user: 'admin@enswork.com',
          cli_equivalent: `pacadev runbook show ${section}`,
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const data = {
      section,
      title: runbook.title,
      steps: runbook.steps,
    };

    const response: APIResponse<typeof data> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev runbook show ${section}`,
      },
    };

    return NextResponse.json(response);
  }

  // Return all sections overview
  const overview = Object.entries(runbookSections).map(([key, val]) => ({
    section: key,
    title: val.title,
    stepCount: val.steps.length,
  }));

  const data = {
    sections: overview,
    totalSections: overview.length,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      cli_equivalent: 'pacadev runbook show',
    },
  };

  return NextResponse.json(response);
}
