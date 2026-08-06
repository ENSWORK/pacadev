# PACADEV v1.0 — Architecture

## Arborescence

```
/home/pacadev/pacadev/
├── core/
│   ├── cli/                     # CLI Typer — pacadev
│   │   └── cli/
│   │       ├── main.py          # Entry point + init/list/health/version
│   │       ├── commands/
│   │       │   ├── work.py      # work start/stop/status
│   │       │   ├── deploy.py    # deploy approve [--dry-run]
│   │       │   ├── backup.py    # backup create/list
│   │       │   ├── rollback.py  # rollback [--auto/--backup]
│   │       │   ├── test.py      # test run --module
│   │       │   ├── secrets.py   # secrets show/init/edit
│   │       │   ├── generate.py  # generate devcontainer/ci
│   │       │   └── monitor.py   # monitor start/stop/status/logs
│   │       └── utils/
│   │           ├── state.py     # versions.json, audit-log
│   │           ├── git.py       # branches, status
│   │           ├── docker.py    # compose, healthcheck
│   │           └── secrets.py   # SOPS/age decrypt
│   ├── ci-templates/
│   │   ├── pipeline-base.yml    # lint→test→security→IA→tag
│   │   └── deploy.yml           # deploy + rollback auto
│   ├── templates/devcontainer/
│   │   ├── docker-compose.dev.yml
│   │   ├── devcontainer.json
│   │   ├── continue.json        # Continue.dev (Claude)
│   │   ├── odoo.conf
│   │   └── .aiignore
│   ├── secrets/
│   │   ├── .sops.yaml           # règles chiffrement age
│   │   ├── .env.template.yaml   # template secrets
│   │   └── <client>.enc.yaml    # secrets chiffrés par client
│   └── monitoring/ (référence)  # configs copiées dans ~/.pacadev/monitoring/
│
├── v14/clients/<slug>/          # Projets Odoo 14
├── v17/clients/<slug>/          # Projets Odoo 17
│   └── acmecorp/
│       ├── addons/custom/       # Modules rw
│       ├── addons/oca/          # Submodules OCA (ro)
│       ├── config/odoo.conf
│       ├── .devcontainer/
│       ├── .github/workflows/   # CI/CD généré
│       ├── .vscode/continue.json
│       ├── .aiignore
│       ├── .env.example
│       ├── docker-compose.dev.yml
│       └── .pacadev/metadata.json
├── v19/clients/
├── migration/
└── docs/
    ├── RUNBOOK.md               # Ce fichier
    └── ARCHITECTURE.md

~/.pacadev/                      # État global (ext4)
├── config.yaml
├── state/
│   ├── versions.json            # Source de vérité clients
│   └── audit-log.jsonl          # Historique actions
├── secrets/ (vide — dans core/secrets/)
├── logs/
└── monitoring/                  # Configs Docker (ext4 requis)
    ├── docker-compose.yml
    ├── prometheus/
    ├── grafana/
    ├── loki/
    └── promtail/
```

## Flux de Travail

```
GitHub Issue #XYZ
      ↓
pacadev work start --client acmecorp --issue XYZ
      ↓
Branche: dev/acmecorp/XYZ-feature
Dev dans VS Code + Devcontainer Odoo
      ↓
git push → GitHub Actions
  ├── Lint (ruff, black, pylint-odoo)
  ├── Tests (pytest-odoo, DB isolée)
  ├── Security (bandit, safety, trivy)
  └── IA Risk Score (Claude Haiku 0.0–1.0)
        ↓
Score < 0.5 → Auto-merge + Tag auto
Score ≥ 0.5 → Review humaine requise
        ↓
pacadev deploy approve --client acmecorp --env prod
  ├── Backup atomique (DB + filestore + config)
  ├── Déploiement code
  ├── Healthchecks
  └── Rollback auto si échec
        ↓
Monitoring passif (Grafana + Loki)
```

## Décisions Techniques

| Décision | Raison |
|----------|--------|
| Configs monitoring dans `~/.pacadev/` | `/home/pacadev/pacadev` sur FS local — Docker bind-mount OK |
| SOPS + age (pas GPG) | Plus simple, pas de serveur de clés, clés dans fichier local |
| Claude Haiku pour risk score | Rapide et peu coûteux pour l'analyse de diff |
| Typer pour le CLI | Auto-help, typage Python, completion shell |
| Jinja2 pour les templates | Standard Python, pas de dépendance externe lourde |
