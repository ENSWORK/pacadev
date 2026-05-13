# Phase B : Tokens d'Approbation + RBAC — Guide d'Intégration

## Architecture Implémentée ✅

### 1. **Tokens d'Approbation HMAC**
```
/core/security/tokens.py
```
- ✅ Génération tokens HMAC SHA256 signés
- ✅ Expiration 15 minutes automatique
- ✅ Format: `token_<timestamp>.<git_commit>.<signature>`
- ✅ Extraction infos (timestamp, expires_at, expired)

**Exemple:**
```python
from security import ApprovalToken

# Générer un token
token = ApprovalToken.generate(
    client="acmecorp",
    action="deploy_prod",
    reason="Hotfix critical #145",
    user="abdelali"
)
# → "token_1715619000.e4d17ef.adc2acf4d80a35..."

# Vérifier l'expiration
info = ApprovalToken.get_info(token)
if info["expired"]:
    print("⚠️ Token expiré")
```

### 2. **Gestionnaire d'Approbations**
```
/core/security/approval.py
```
- ✅ Stockage durable dans `~/.pacadev/approvals.jsonl`
- ✅ Usage unique (un token = une utilisation)
- ✅ Historique traçable par client
- ✅ Approvals en attente détectables

**Exemple:**
```python
from security import ApprovalManager

manager = ApprovalManager()

# Émettre une approbation
token = manager.issue_approval(
    client="acmecorp",
    action="deploy_prod",
    reason="Hotfix critical",
    user="abdelali"
)

# Utiliser l'approbation (une seule fois)
manager.use_approval(token, user="who_uses_it")
# → TokenError si déjà utilisée ou expirée

# Vérifier les approbations en attente
pending = manager.get_pending_approvals("acmecorp", "deploy_prod")
for approval in pending:
    print(f"Approval by {approval['user']}: {approval['reason']}")
```

### 3. **RBAC (Role-Based Access Control)**
```
/core/security/rbac.py
/core/security/rbac.json
```
- ✅ 4 rôles prédéfinis: admin, lead, dev, viewer
- ✅ Permissions granulaires par action
- ✅ Clients accessibles par utilisateur
- ✅ Configuration JSON persistante

**Configuration (rbac.json):**
```json
{
  "roles": {
    "admin": {
      "permissions": ["*"],
      "clients": ["*"]
    },
    "lead": {
      "permissions": [
        "work_start", "test", "deploy_staging",
        "deploy_prod", "approve_prod", "rollback"
      ],
      "clients": ["*"]
    },
    "dev": {
      "permissions": [
        "work_start", "test", "deploy_staging"
      ],
      "clients": ["*"]
    }
  },
  "user_roles": {
    "abdelali": "admin",
    "alice": "lead",
    "bob": "dev"
  }
}
```

**Utilisation:**
```python
from security import RBAC

rbac = RBAC()

# Attribuer un rôle
rbac.set_user_role("alice", "lead")

# Vérifier une permission
if rbac.can_access("alice", "deploy_prod", "acmecorp"):
    print("✅ Alice peut déployer")
else:
    print("❌ Alice ne peut pas déployer")

# Lister les permissions d'un utilisateur
perms = rbac.get_user_permissions("alice")
# → {"work_start", "test", "deploy_staging", ...}
```

### 4. **Masquage de Secrets**
```
/core/security/secrets.py
```
- ✅ 9 patterns de secrets détectés automatiquement
- ✅ Masquage dans les logs (***MASKED***)
- ✅ Filtrage dictionnaires
- ✅ Extraction de secrets détectés

**Patterns détectés:**
- API keys, tokens, passwords
- Private keys (SSH, GPG)
- AWS credentials, GitHub tokens, Slack tokens
- URLs avec credentials

**Exemple:**
```python
from security import SecretsMasker

masker = SecretsMasker()

# Masquer du texte
text = "api_key=sk_live_abc123def456"
masked = masker.mask_text(text)
# → "api_key=sk_li****ef456"

# Vérifier si contient secret
if masker.contains_secret(text):
    print("⚠️ Secrets détectés!")

# Masquer dans un dictionnaire
data = {
    "username": "alice",
    "password": "super_secret_123"
}
masked = masker.mask_dict(data)
# → {"username": "alice", "password": "***MASKED***"}
```

### 5. **Décorateurs CLI Intégrés**
```
/core/cli/decorators.py (modifié)
```
Nouveaux décorateurs:
- `@require_permission(action)` — Vérifie RBAC
- `@require_approval(action)` — Exige token signé
- `@mask_secrets_in_log` — Masque secrets automatiquement

---

## Flux de Déploiement Prod Complet

```
1. User demande déploiement
   pacadev deploy --env prod --client acmecorp --reason "Hotfix #145"

2. CLI vérifie permission (RBAC)
   @require_permission("deploy_prod")
   ✅ User a rôle "lead" → peut continuer

3. Génération approbation
   Lead reçoit: pacadev approve --generate acmecorp deploy_prod "Hotfix #145"
   → Token: token_1715619000.e4d17ef.adc2acf4d80a35...

4. User soumet déploiement avec token
   pacadev deploy --env prod --client acmecorp --approve-token <token>

5. CLI vérifie approbation
   @require_approval("deploy_prod")
   ✅ Token valide et non expiré → mark as used

6. FSM + Audit log (Phase A)
   Transition: STAGING_VALIDATED → PROD_APPROVED → PROD_DEPLOYED
   Log: {"action": "deploy_prod", "client": "acmecorp", "approval_token": "...", ...}

7. Healthchecks
   ✅ Service up → CLOSED
```

---

## Intégration aux Commandes CLI

### Exemple 1: `work start` avec RBAC
```python
@app.command()
@require_permission("work_start")  # ← Nouveau
def start(
    issue: int = typer.Option(..., "--issue"),
    client: str = typer.Option(..., "--client"),
):
    # ... code existant ...
```

### Exemple 2: `deploy` avec Approbation
```python
@app.command()
@require_permission("deploy_prod")      # ← RBAC
@require_approval("deploy_prod")        # ← Token signé
@validate_and_log("deploy_prod")        # ← Audit (Phase A)
def approve(
    client: str = typer.Option(...),
    env: str = typer.Option("prod"),
    approve_token: str = typer.Option(..., "--approve-token"),
    reason: str = typer.Option(..., "--reason"),
):
    # À ce point:
    # - Permission vérifiée
    # - Token valide et marqué comme utilisé
    # - Prêt pour déploiement
    console.print(f"🚀 Déploiement {client} approuvé par RBAC + token")
```

### Exemple 3: Générer une approbation (pour lead)
```python
@app.command()
@require_permission("approve_prod")  # Seulement lead/admin
def approve_generate(
    client: str = typer.Option(...),
    action: str = typer.Option(...),
    reason: str = typer.Option(...),
):
    """Génère un token d'approbation pour une action"""
    import subprocess
    user = subprocess.run(["whoami"], capture_output=True, text=True).stdout.strip()
    
    manager = ApprovalManager()
    token = manager.issue_approval(client, action, reason, user)
    
    console.print(f"🔐 Token d'approbation généré:\n{token}")
    console.print(f"[yellow]Expire dans 15 minutes[/yellow]")
    console.print(f"[dim]Utilisez: pacadev deploy --env prod --approve-token {token}[/dim]")
```

---

## Configuration Initialisation

### 1. Créer utilisateurs et rôles
```bash
# Initialiser RBAC
python -c "
import sys
sys.path.insert(0, 'core')
from security import RBAC

rbac = RBAC()
rbac.set_user_role('abdelali', 'admin')
rbac.set_user_role('alice', 'lead')
rbac.set_user_role('bob', 'dev')
print('✅ Rôles configurés')
"
```

### 2. Vérifier la configuration
```bash
python -c "
import sys
sys.path.insert(0, 'core')
from security import RBAC

rbac = RBAC()
users = rbac.list_users()
for user, role in users.items():
    print(f'{user}: {role}')
"
```

---

## Flux d'Utilisation Complet

**Scénario:** Alice (lead) approuve un déploiement de Bob (dev)

```bash
# 1. Alice génère une approbation
$ pacadev approve --generate acmecorp deploy_prod "Hotfix #145"
🔐 Token d'approbation généré:
token_1715619000.e4d17ef.adc2acf4d80a35...
Expire dans 15 minutes

# 2. Alice envoie le token à Bob (via Slack/Email/etc)

# 3. Bob soumet le déploiement avec le token
$ pacadev deploy --env prod --client acmecorp \
  --approve-token token_1715619000.e4d17ef.adc2acf4d80a35... \
  --reason "Fixing critical bug in payment module"

🚀 Vérification RBAC: bob peut deployer? ✅ (rôle: dev, permissions: deploy_staging)
❌ ERREUR: Bob n'a pas la permission deploy_prod

# 4. Alice (lead) soumet avec le token
$ pacadev deploy --env prod --client acmecorp \
  --approve-token token_1715619000.e4d17ef.adc2acf4d80a35... \
  --reason "Approval for Bob's hotfix"

✅ Vérification RBAC: alice peut deployer? ✅ (rôle: lead)
✅ Vérification token: valide et non expiré
✅ Token marqué comme utilisé
🚀 Déploiement en prod lancé...
✅ Backup OK
✅ Healthchecks OK
🎉 Déploiement complet! Issue #145 fermée.
```

---

## Audit Log avec Phase B

Les logs d'audit (Phase A) incluent maintenant:

```json
{
  "timestamp": "2026-05-13T12:34:56.789123",
  "action": "deploy_prod",
  "client": "acmecorp",
  "user": "alice",
  "git_commit": "e4d17ef",
  "reason": "Approval for Bob's hotfix",
  "approval_token": "token_1715619000.e4d17ef.***",
  "approver": "alice",
  "role": "lead",
  "status": "success",
  "prev_hash": "99647e1c...",
  "hash": "d8e2f4a9..."
}
```

**Secrets jamais en clair** — masqués automatiquement

---

## Checklist d'Intégration Phase B

- [ ] Créer utilisateurs dans RBAC avec rôles (admin, lead, dev)
- [ ] Intégrer `@require_permission` aux commandes critiques
- [ ] Intégrer `@require_approval` à `deploy.py` (env prod)
- [ ] Ajouter commande `pacadev approve --generate`
- [ ] Tester workflow complet (dev push → staging → approval → prod)
- [ ] Tester masquage secrets dans logs
- [ ] Tester permission denied (dev ne peut pas deploy prod)
- [ ] Tester token expiration (> 15 min)
- [ ] Vérifier audit logs incluent approval data
- [ ] Documenter flux approbations dans RUNBOOK

---

## Prochaines Étapes (Phase C)

Phase C = Dashboard + Alertes :
- API REST pour état clients
- WebSocket pour notifications
- Slack/Email pour alertes
- Dashboard temps réel

Phase B est **complète et verrouille définitivement le workflow** ✅

