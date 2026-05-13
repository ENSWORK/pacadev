# Phase A : FSM + Audit + Pré-flight Checks — Guide d'Intégration

## Architecture Implémentée ✅

### 1. **FSM (Finite State Machine)**
```
/core/workflow/fsm.py
```
- Machine à états stricte avec 11 états possibles
- Transitions validées avant chaque passage d'état
- Historique complet des transitions
- Gestion des états d'erreur avec rollback

**États disponibles:**
- `INIT` → `DEV` → `CI_RUNNING` → `CI_PASSED` → `MERGED`
- `STAGING_DEPLOYED` → `STAGING_VALIDATED` → `PROD_APPROVED` → `PROD_DEPLOYED` → `CLOSED`
- `ERROR` (état de récupération avec rollback possible)

### 2. **Validations Pré-vol**
```
/core/workflow/validators.py
```
- ✅ Vérification GitHub Issue (existe + ouverte)
- ✅ Validation nom de branche (pattern strict: `dev/client/123-feature`)
- ✅ Vérification dépôt Git
- ✅ Tests locaux avant push
- ✅ Backup récent existant (< 24h)
- ✅ Checks CI passant
- ✅ Secrets chiffrés

### 3. **Audit Immuable**
```
/core/audit/logger.py
/core/audit/verifier.py
```
- 📊 Enregistrement de toutes les actions dans `~/.pacadev/audit-log.jsonl`
- 🔗 Chaînage hash SHA256 pour intégrité
- ✅ Vérification automatique d'intégrité
- 📋 Historique complet traçable par client

### 4. **Décorateurs CLI**
```
/core/cli/decorators.py
```
Prêts à utiliser dans les commandes :
- `@require_github_issue` — exige issue valide
- `@require_valid_branch_name` — valide format branche
- `@require_git_repo` — exige dépôt Git
- `@require_backup` — exige backup récent
- `@validate_and_log` — valide + enregistre dans audit
- `@fsm_transition` — gère transition FSM

---

## Comment Intégrer aux Commandes Existantes

### Exemple 1 : Intégrer à `work.py`

**Avant:**
```python
@app.command()
def start(
    issue: int = typer.Option(..., "--issue", "-i"),
    client: str = typer.Option(..., "--client", "-c"),
    module: str = typer.Option(None, "--module", "-m"),
):
    # ... code ...
```

**Après:**
```python
from workflow import WorkflowFSM, TransitionEvent
from workflow.validators import validate_work_start
from audit import AuditLogger

@app.command()
def start(
    issue: int = typer.Option(..., "--issue", "-i"),
    client: str = typer.Option(..., "--client", "-c"),
    module: str = typer.Option(None, "--module", "-m"),
    repo: str = typer.Option(..., "--repo", "-r"),  # GitHub repo
):
    """Démarre un environnement de travail pour un ticket"""
    
    # Pré-flight checks
    result = validate_work_start(client, issue, repo, branch, path)
    console.print(result)  # Affiche les vérifications
    
    if not result.passed:
        raise typer.Exit(1)
    
    # FSM transition
    fsm = WorkflowFSM(client)
    fsm.transition(TransitionEvent.WORK_START_VALID, metadata={"issue": issue, "module": module})
    
    # Audit log
    logger = AuditLogger()
    logger.log_action("work_start", client, issue=issue, module=module)
    
    # ... code existant ...
```

### Exemple 2 : Intégrer à `deploy.py`

**Pour staging:**
```python
from workflow.validators import validate_deploy_staging

@app.command()
def approve(
    client: str = typer.Option(...),
    env: str = typer.Option("staging"),
):
    # Validations
    result = validate_deploy_staging(client, module=None)
    console.print(result)
    if not result.passed:
        raise typer.Exit(1)
    
    # FSM transition
    fsm = WorkflowFSM(client)
    if env == "staging":
        fsm.transition(TransitionEvent.TAG_CREATED)  # ou autre selon l'état
    
    # ... déploiement ...
```

**Pour prod (strict):**
```python
from workflow.validators import validate_deploy_prod

@app.command()
def approve(client: str, env: str = "prod"):
    # Validations strictes
    result = validate_deploy_prod(client)
    console.print(result)
    if not result.passed:
        raise typer.Exit(1)
    
    # FSM PROD_APPROVED
    fsm = WorkflowFSM(client)
    fsm.transition(TransitionEvent.BACKUP_OK)  # Backup déjà fait
    fsm.transition(TransitionEvent.HEALTHCHECKS_OK)
    
    # Audit log
    logger = AuditLogger()
    logger.log_action("deploy_prod", client, env=env, status="success")
```

---

## Utilisation Directe (sans décorateurs)

### FSM Simple
```python
from workflow import WorkflowFSM, TransitionEvent

fsm = WorkflowFSM("acmecorp")
print(f"État actuel: {fsm.state.value}")  # → "init"

# Transitions
fsm.transition(TransitionEvent.WORK_START_VALID)
print(fsm.state.value)  # → "dev"

# Vérifier transitions autorisées
allowed = fsm.get_allowed_transitions()
for event, next_state in allowed:
    print(f"  {event.value} → {next_state.value}")
```

### Validations Pré-vol
```python
from workflow.validators import PreFlightChecker

# Vérifier issue GitHub
check = PreFlightChecker.check_github_issue("enswork/acmecorp", 42)
print(f"✅ {check.message}" if check.passed else f"❌ {check.message}")

# Vérifier backup
check = PreFlightChecker.check_backup_exists("acmecorp")
if not check.passed:
    print(f"❌ Créer un backup d'abord")
```

### Audit Log
```python
from audit import AuditLogger, AuditVerifier

logger = AuditLogger()

# Enregistrer une action
logger.log_action("deploy_prod", "acmecorp", 
                  tag="acmecorp/v17/2026.05.13-1",
                  user="abdelali")

# Vérifier l'intégrité
result = AuditVerifier.verify_log_integrity()
print(result)  # ✅ Audit log valide (15 entrées)

# Historique d'un client
history = logger.get_client_history("acmecorp")
for entry in history:
    print(f"{entry['timestamp']} — {entry['action']}")
```

---

## Tests

### Test FSM
```bash
cd /home/abdelali/pacadev
python -c "
import sys
sys.path.insert(0, 'core')
from workflow.fsm import WorkflowFSM, TransitionEvent

fsm = WorkflowFSM('test')
fsm.transition(TransitionEvent.WORK_START_VALID)
print(f'✅ FSM OK: {fsm.state.value}')
"
```

### Test Audit
```bash
python -c "
import sys
sys.path.insert(0, 'core')
from audit import AuditLogger, AuditVerifier

logger = AuditLogger()
logger.log_action('test', 'client1')
result = AuditVerifier.verify_log_integrity()
print(f'✅ Audit OK: {result}')
"
```

---

## Checklist d'Intégration Complète

- [ ] Intégrer `@require_github_issue` à `work.py`
- [ ] Intégrer FSM transition à `work.py` (INIT → DEV)
- [ ] Intégrer validations à `deploy.py` (staging)
- [ ] Intégrer FSM + audit à `deploy.py` (STAGING → PROD)
- [ ] Intégrer validations à `test.py`
- [ ] Intégrer audit log à `rollback.py`
- [ ] Tester chemin complet: work → push → CI → merge → staging → prod
- [ ] Vérifier intégrité logs après 10+ actions
- [ ] Documenter commandes CLI dans RUNBOOK

---

## Prochaines Étapes (Phase B)

Une fois Phase A intégrée aux commandes :

1. **Phase B.1: Tokens d'Approbation**
   - Implémentation HMAC + expiration 15min
   - Endpoint CLI: `pacadev deploy --approve --token <signed>`

2. **Phase B.2: RBAC**
   - Rôles: admin, lead, dev
   - Permissions par client + action

3. **Phase C: Dashboard + Alertes**
   - État clients en temps réel
   - Gates en attente
   - Notifications Slack/Email

---

**État:** ✅ Phase A prête à l'emploi  
**Prochaines lignes:** Intégrer aux commandes CLI existantes

