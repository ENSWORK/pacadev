# 🔐 PACADEV — Workflow Verrouillé (Phase A)

## Quick Start

### Importer la FSM
```python
from workflow import WorkflowFSM, TransitionEvent, WorkflowState

fsm = WorkflowFSM("acmecorp")
fsm.transition(TransitionEvent.WORK_START_VALID)
print(fsm.state)  # WorkflowState.DEV
```

### Valider avant une action
```python
from workflow.validators import validate_work_start

result = validate_work_start("acmecorp", 142, "enswork/acmecorp", "dev/acmecorp/142-feature", Path("/repo"))
if not result.passed:
    print(result)  # Affiche toutes les vérifications échouées
    exit(1)
```

### Enregistrer dans l'audit
```python
from audit import AuditLogger

logger = AuditLogger()
logger.log_action("deploy_prod", "acmecorp", tag="acmecorp/v17/2026.05.13-1")
```

### Vérifier l'intégrité
```python
from audit import AuditVerifier

result = AuditVerifier.verify_log_integrity()
print(result)  # ✅ Audit log valide (47 entrées)
```

---

## Fichiers Clés

| Fichier | Responsabilité |
|---------|----------------|
| `workflow/fsm.py` | Machine à états (11 états, transitions strictes) |
| `workflow/validators.py` | 8 validateurs pré-vol réutilisables |
| `audit/logger.py` | Enregistrement immuable avec hash chaîné |
| `audit/verifier.py` | Vérification d'intégrité audit log |
| `cli/decorators.py` | 7 décorateurs CLI prêts à l'emploi |
| `PHASE_A_INTEGRATION.md` | Guide complet d'intégration |

---

## États du Workflow

```
INIT
 ↓ (work_start_valid)
DEV
 ↓ (push_detected)
CI_RUNNING
 ├→ (all_checks_pass) → CI_PASSED → MERGED
 └→ (check_failed) → DEV
 
MERGED
 ↓ (tag_created)
STAGING_DEPLOYED
 ↓ (smoke_ok)
STAGING_VALIDATED
 ↓ (human_approve_prod)
PROD_APPROVED
 ↓ (backup_ok)
PROD_DEPLOYED
 ├→ (healthchecks_ok) → CLOSED
 └→ (healthchecks_failed) → ERROR
 
ERROR
 ↓ (rollback_triggered)
 DEV
```

---

## Validateurs Disponibles

```python
from workflow.validators import PreFlightChecker

# Vérifier une GitHub issue
check = PreFlightChecker.check_github_issue("enswork/acmecorp", 142)

# Vérifier format branche
check = PreFlightChecker.check_branch_name("dev/acmecorp/142-feature")

# Vérifier backup existe
check = PreFlightChecker.check_backup_exists("acmecorp")

# Vérifier dépôt Git
check = PreFlightChecker.check_git_repo(Path.cwd())

# Vérifier tests locaux
check = PreFlightChecker.check_local_tests("sale")

# Vérifier CI passing
check = PreFlightChecker.check_ci_passing("enswork/acmecorp", 123)

# Vérifier secrets chiffrés
check = PreFlightChecker.check_secrets_encrypted(Path("secrets.yaml"))
```

---

## Audit Log

Chaque action est enregistrée dans `~/.pacadev/audit-log.jsonl` :

```json
{
  "timestamp": "2026-05-13T12:34:56.789123",
  "action": "deploy_prod",
  "client": "acmecorp",
  "user": "abdelali",
  "git_commit": "bea4f483",
  "tag": "acmecorp/v17/2026.05.13-1",
  "prev_hash": "88eb3e29...",
  "hash": "99647e1c..."
}
```

**Propriétés:**
- ✅ Immuable (JSONL append-only)
- 🔗 Hash chaîné pour intégrité
- 📋 Historique traceable par client
- 🔒 User/commit capturés automatiquement

---

## Décorateurs CLI

```python
from cli.decorators import (
    require_github_issue,
    require_valid_branch_name,
    require_git_repo,
    require_backup,
    validate_and_log,
    fsm_transition
)

@app.command()
@require_github_issue
@require_valid_branch_name
@fsm_transition(TransitionEvent.WORK_START_VALID)
@validate_and_log("work_start")
def start(issue: int, branch: str, repo: str):
    """Validations + FSM + Audit automatiques"""
    # Code métier seulement
    pass
```

---

## Tests

### Tester la FSM
```bash
cd /home/pacadev/pacadev
python -m pytest core/workflow/test_fsm.py -v
```

### Tester manuellement
```bash
python -c "
import sys
sys.path.insert(0, 'core')
from workflow.fsm import WorkflowFSM, TransitionEvent

fsm = WorkflowFSM('test')
fsm.transition(TransitionEvent.WORK_START_VALID)
print(f'✅ FSM OK: {fsm.state.value}')
"
```

---

## Prochaines Étapes

### Phase B (Tokens d'Approbation)
```python
from security.tokens import ApprovalToken

token = ApprovalToken.generate("acmecorp", "deploy_prod", reason="Hotfix critical")
# → Token HMAC signé, expire dans 15 min

verified = ApprovalToken.verify(token, client="acmecorp")
assert verified  # True si valide et non expiré
```

### Phase C (Dashboard)
```
GET /api/clients/<client>/state
→ {"state": "prod_deployed", "last_action": "...", "gates_pending": []}

GET /api/audit/<client>
→ [{"timestamp": "...", "action": "...", ...}]
```

---

**Documentation complète:** `PHASE_A_INTEGRATION.md`  
**Livraison:** `PHASE_A_DELIVERY.md`

