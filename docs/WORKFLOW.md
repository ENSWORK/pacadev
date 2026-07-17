# PACADEV — Workflow Complet

---

## Cycle de vie d'un ticket

```
1. GitHub Issue créé
   └─ tag: client:<slug>, type:feature|bug, priority:P0-P3

2. Démarrage du travail
   pacadev work start --client <slug> --issue <N>
   └─ FSM: IDLE → DEV
   └─ Branche créée: dev/<slug>/<N>-<description>
   └─ Audit log: work_start

3. Développement
   └─ coder dans v17/clients/<slug>/addons/
   └─ incréments de version dans __manifest__.py
   └─ commit: pacadev work commit --client <slug> --module <m>

4. Review auto
   pacadev work review --client <slug>
   └─ FSM: DEV → SELF_REVIEW
   └─ Vérifications: lint, structure, secrets

5. Tests manuels
   pacadev work test-manual --client <slug>
   └─ FSM: SELF_REVIEW → TEST_MANUAL
   └─ Upgrade module dans container Docker

6. Push
   pacadev work commit --client <slug> --push
   └─ FSM: TEST_MANUAL → CI_PENDING
   └─ Push vers GitHub

7. CI/CD GitHub Actions
   └─ Lint (ruff, xmllint)
   └─ Tests (py_compile, ast.walk)
   └─ Security (bandit, gitleaks)
   └─ AI Risk Score (si PR)
   └─ FSM: CI_PENDING → STAGING

8. Staging
   pacadev deploy approve --client <slug> --env staging --dry-run
   └─ FSM: STAGING → PROD_APPROVAL

9. Production
   pacadev deploy approve --client <slug> --env prod
   └─ Backup atomique (DB + filestore)
   └─ Déploiement code
   └─ Healthchecks
   └─ Rollback auto si échec
   └─ FSM: PROD_APPROVAL → PROD_DEPLOYED → CLOSED

10. Fermeture
    └─ Audit log: work_done
    └─ GitHub Issue fermée
```

---

## FSM — États et transitions

```
IDLE ──── work_start ────→ DEV
                              │
                    work_review (passed)
                              │
                              ▼
                        SELF_REVIEW
                              │
                    work_test (passed)
                              │
                              ▼
                        TEST_MANUAL
                              │
                    work_commit (push)
                              │
                              ▼
                        CI_PENDING
                              │
                    ci_passed
                              │
                              ▼
                          STAGING
                              │
                    deploy_approve (dry-run)
                              │
                              ▼
                        PROD_APPROVAL
                              │
                    deploy_approve (prod)
                              │
                              ▼
                        PROD_DEPLOYED
                              │
                    close
                              │
                              ▼
                          CLOSED

Loop: SELF_REVIEW.failed → DEV
Loop: TEST_MANUAL.failed → DEV
```

---

## Upgrade module (procédure)

```bash
cd v17/clients/<client>

# 1. Incrémenter version dans __manifest__.py
# Patch: 17.0.X.Y.Z → 17.0.X.Y.(Z+1)
# Minor: 17.0.X.Y.Z → 17.0.X.(Y+1).0

# 2. Upgrade + clear cache
docker exec <client>_odoo odoo -c /odoo.conf -d <db> -u <module> --stop-after-init

# 3. Redémarrer Odoo
docker exec <client>_odoo pkill -f odoo
sleep 5
docker-compose -f docker-compose.dev.yml start odoo

# 4. Test local puis git commit
```

---

## Sécurité

### Tokens d'approbation

```bash
# Générer un token (TTL 15 min, usage unique)
pacadev deploy generate-approval --client <slug> --reason "Déploiement feature X"

# Utiliser le token
pacadev deploy approve --client <slug> --env prod --approve-token <TOKEN>

# Le token est vérifié:
# - Format valide (token_<ts>.<commit>.<sig>)
# - Non expiré (< 15 min)
# - Client correct
# - Signature HMAC-SHA256 validée
# - Non déjà utilisé (single-use)
```

### RBAC

| Rôle | Permissions |
|------|------------|
| admin | Tout (init, deploy, secrets, rbac) |
| lead | Deploy, review, approve |
| dev | Work start/stop, commit |
| viewer | Lecture seule |

### Audit log

Chaque action est loggée dans `~/.pacadev/state/audit-log.jsonl` avec hash SHA256 chaîné. L'intégrité est vérifiable via `AuditVerifier`.

---

## Déploiement

### Déploiement standard

```bash
# 1. Backup
pacadev backup create --client <slug>

# 2. Dry-run
pacadev deploy approve --client <slug> --env prod --dry-run

# 3. Deploy
pacadev deploy approve --client <slug> --env prod
```

### Rollback

```bash
# Dernier backup
pacadev rollback --client <slug>

# Backup spécifique
pacadev backup list --client <slug>
pacadev rollback --client <slug> --backup bk-YYYYMMDD-HHMM
```

---

## Monitoring

```bash
# Démarrer le monitoring
pacadev monitor start

# Vérifier
pacadev infra status
pacadev health --all

# Dashboard web
# http://localhost:3000
```
