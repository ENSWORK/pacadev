# 📚 RUNBOOK PACADEV Phase A + B

Guide opérationnel complet du workflow verrouillé.

---

## 🎯 Vue d'ensemble

Phase A + B créent un **workflow verrouillé** avec :
- ✅ **Machine à états stricte (FSM)** — chaque étape validée
- ✅ **Audit immuable** — logs avec hash chaîné
- ✅ **RBAC** — permissions par rôle (admin, lead, dev, viewer)
- ✅ **Tokens d'approbation** — signatures HMAC 15min
- ✅ **Secrets masqués** — jamais en clair dans les logs

---

## 👥 Rôles et Permissions

### Admin
```
abdelali = admin
→ Accès total à toutes les commandes et clients
→ Peut approuver les déploiements prod
→ Voit tous les logs
```

### Lead
```
alice = lead
→ Développement + Tests + Staging + Production
→ Peut générer et utiliser tokens d'approbation
→ Peut voir et approuver les déploiements
```

### Dev
```
bob, charlie = dev
→ Développement + Tests + Staging seulement
→ ❌ Pas d'accès prod
→ ❌ Pas d'approbations
```

### Viewer
```
viewer = viewer
→ ❌ Lecture seule
→ ❌ Pas d'actions
```

---

## 🚀 Workflows Opérationnels

### Workflow 1: Développement + Staging (Dev)

**Acteurs:** bob (dev)  
**Environnement:** staging  
**Approbation:** Non requise

```bash
# 1. Démarrer le travail sur un ticket
$ pacadev work start --issue 145 --client acmecorp

✅ Permission OK: bob = dev (work_start autorisé)
✅ FSM: INIT → DEV
✅ Audit: work_start logged
✅ Branche créée: dev/acmecorp/145-feature-name

# 2. Développer, tester localement
$ cd /path/to/acmecorp
$ git add .
$ git commit -m "Feature #145: ..."
$ git push

# 3. Tester en staging (optionnel)
$ pacadev test --client acmecorp --module sale

✅ Permission OK: bob = dev (test autorisé)
✅ Tests lancés sur staging

# 4. Déployer en staging
$ pacadev deploy --env staging --client acmecorp --reason "Feature test"

✅ Permission OK: bob = dev (deploy_staging autorisé)
✅ FSM: STAGING_DEPLOYED → STAGING_VALIDATED
✅ Audit: deploy_staging logged
✅ Code en staging, prêt pour validation
```

---

### Workflow 2: Déploiement Production avec Approbation (Lead)

**Acteurs:** alice (lead) — approuve, bob (dev) ou autre — exécute  
**Environnement:** production  
**Approbation:** ✅ Requise (token HMAC 15min)

#### Step 1: Lead génère un token d'approbation

```bash
# Alice (lead) génère l'approbation
$ pacadev approve --generate \
  --client acmecorp \
  --action deploy_prod \
  --reason "Hotfix #145: Payment module critical bug"

✅ Permission OK: alice = lead (approve_prod autorisé)

# Output:
# ════════════════════════════════════════════════════════════════════════════
# 🔐 Token d'Approbation Généré
# ════════════════════════════════════════════════════════════════════════════
# token_1778634491.55344d7d.8f68568bab45ff91063f256c...
# ════════════════════════════════════════════════════════════════════════════
# ⏱️  Expire dans 15 minutes
# Client: acmecorp
# Action: deploy_prod
# Motif: Hotfix #145: Payment module critical bug
# Généré par: alice
#
# Utilisation:
# pacadev deploy --env prod --client acmecorp --approve-token token_...
# ════════════════════════════════════════════════════════════════════════════

# Alice envoie le token à bob via Slack/Email/etc
```

#### Step 2: Utilisateur exécute le déploiement avec le token

```bash
# Alice (ou autre lead) déploie avec le token
$ pacadev deploy \
  --env prod \
  --client acmecorp \
  --approve-token token_1778634491.55344d7d.8f68568bab45ff91063f256c... \
  --reason "Hotfix #145: Payment module critical bug"

# Vérifications automatiques:
✅ Permission OK: alice = lead (deploy_prod autorisé)
✅ Token valide et non expiré
✅ Token marqué comme utilisé (usage unique)
✅ FSM: STAGING_VALIDATED → PROD_APPROVED → PROD_DEPLOYED → CLOSED
✅ Backup préalable OK
✅ Healthchecks OK
✅ Audit: deploy_prod logged avec token (masqué)
✅ Issue GitHub #145 fermée

# Output:
# 🚀 Déploiement: acmecorp/v17/2026.05.13-1 → prod
# 🔄 Backup pré-deploy...
#    ✅ Backup atomique
# 🔄 Déploiement code...
#    ✅ Code déployé
# 🔄 Healthchecks...
#    ✅ Container running
# 
# 🎉 Déploiement réussi! Tag: acmecorp/v17/2026.05.13-1
```

---

### Workflow 3: Refus d'Accès (Bob essaie prod)

```bash
# Bob (dev) essaie de déployer en prod
$ pacadev deploy --env prod --client acmecorp

❌ Permission refusée pour bob
💡 Vous avez besoin du rôle 'lead' pour prod

# Sortie de la commande: EXIT 1
```

---

### Workflow 4: Token Expiré

```bash
# Alice génère un token
$ pacadev approve --generate --client acmecorp --action deploy_prod --reason "..."
# Token: token_1778634491.55344d7d.8f68568bab45ff91063f256c...

# ⏱️ Attend 16 minutes (token expire après 15 min)

# Alice essaie de déployer
$ pacadev deploy --env prod --approve-token token_1778634491... --client acmecorp

❌ Token expiré (généré à 2026-05-13T02:18:11)
💡 Demandez une nouvelle approbation: pacadev approve --generate ...

# Sortie de la commande: EXIT 1
```

---

### Workflow 5: Double-Use Blocked

```bash
# Alice génère un token et l'utilise
$ pacadev approve --generate ... 
# Token: token_1778634491.55344d7d.8f68568bab45ff91063f256c...

$ pacadev deploy --env prod --approve-token token_... --client acmecorp
✅ Déploiement réussi

# Alice réutilise le même token (tentative)
$ pacadev deploy --env prod --approve-token token_... --client acmecorp

❌ Approbation déjà utilisée
💡 Demandez une nouvelle approbation

# Sortie de la commande: EXIT 1
```

---

## 🔐 Sécurité

### Secrets Masqués dans les Logs

Les secrets suivants sont **automatiquement masqués** dans audit-log:
- API keys: `sk_***...***`
- Tokens: `ghp_**...***`
- Passwords: `***...***`
- Private keys: `***MASKED***`

```bash
# Exemple: Bob déploie avec secrets dans les variables
$ pacadev deploy --env staging --client acmecorp \
  --env-var "ODOO_API_KEY=sk_live_123456789"

# Audit log:
# {"action": "deploy_staging", "env_var": "ODOO_API_KEY=sk_***...***", ...}
```

### Audit Log Immuable

Chaque action est enregistrée avec:
- Timestamp ISO
- User
- Client
- Action
- Metadata
- **Hash chaîné** pour intégrité

```json
{
  "timestamp": "2026-05-13T02:23:11.123456",
  "action": "deploy_prod",
  "client": "acmecorp",
  "user": "alice",
  "git_commit": "55344d7d",
  "approval_token": "token_1778634491...",
  "reason": "Hotfix #145",
  "prev_hash": "8f68568bab45ff91063f256c...",
  "hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4..."
}
```

---

## 📋 Commandes Disponibles

### Phase A (FSM + Audit)

```bash
# Commandes existantes (modifiées avec RBAC + FSM + Audit)
pacadev work start --issue <N> --client <slug>
pacadev work stop --client <slug>
pacadev test --client <slug> --module <name>
pacadev deploy --env staging --client <slug>
```

### Phase B (Tokens + RBAC)

```bash
# Nouvelle commande: générer token d'approbation
pacadev approve --generate \
  --client <slug> \
  --action deploy_prod \
  --reason "<motif>"

# Modifier: déployer avec token
pacadev deploy --env prod \
  --client <slug> \
  --approve-token <token> \
  --reason "<motif>"
```

---

## 🚨 Procédures d'Urgence

### Rollback Prod

```bash
# Si le déploiement prod cause un problème
$ pacadev rollback \
  --client acmecorp \
  --reason "Critical issue detected post-deploy #145"

✅ Permission OK: lead/admin seulement
✅ Rollback automatique depuis le backup précédent
✅ FSM: PROD_DEPLOYED → ERROR → DEV
✅ Audit: rollback_triggered logged
✅ Alerte Slack: @oncall Rollback exécuté acmecorp
```

### Troubleshooting

**Q: Bob ne peut pas voir les logs**  
A: Rôle viewer. Demandez un changement de rôle à l'admin.

**Q: Token expiré avant que je puisse déployer**  
A: Tokens durent 15 min. Demandez un nouveau token si besoin.

**Q: Double-use de token**  
A: Chaque token ne peut être utilisé qu'une fois. Générez un nouveau.

**Q: Healthchecks échouent en prod**  
A: Rollback automatique. Vérifiez les logs et redéployez.

---

## 📊 Monitoring

### Vérifier l'état d'un client

```bash
$ pacadev work status

# Affiche l'état de tous les clients
# Client | Odoo | Statut   | Branche                  | Issue
# --------|------|----------|--------------------------|-------
# acmecorp| 17   | deployed | dev/acmecorp/145-...     | #145
```

### Consulter l'audit log

```bash
# Voir toutes les actions
$ grep '"client": "acmecorp"' ~/.pacadev/audit-log.jsonl | jq .

# Affiche:
# {"action":"work_start","client":"acmecorp","user":"bob",...}
# {"action":"deploy_staging","client":"acmecorp","user":"bob",...}
# {"action":"deploy_prod","client":"acmecorp","user":"alice",...}
```

### Vérifier l'intégrité de l'audit log

```bash
# Déterminer toute corruption
$ python -c "
import sys
sys.path.insert(0, 'core')
from audit import AuditVerifier
result = AuditVerifier.verify_log_integrity()
print(result)
"

# Output:
# ✅ Audit log valide (47 entrées)
```

---

## 🔄 Processus Complet: De la Feature au Prod

```
[1] DEV PHASE (bob = dev)
    $ pacadev work start --issue 145 --client acmecorp
    → FSM: INIT → DEV
    → Branche: dev/acmecorp/145-feature

[2] TEST PHASE (bob = dev)
    $ pacadev test --client acmecorp --module sale
    → Tests locaux
    $ git push
    → CI triggère automatiquement

[3] STAGING PHASE (bob = dev)
    $ pacadev deploy --env staging --client acmecorp
    → FSM: STAGING_DEPLOYED → STAGING_VALIDATED
    → Smoke tests OK

[4] APPROVAL PHASE (alice = lead)
    $ pacadev approve --generate --client acmecorp --reason "Feature #145"
    → Token généré: token_...
    → Token envoyé à deployer (15 min timeout)

[5] PROD DEPLOY PHASE (alice = lead)
    $ pacadev deploy --env prod --client acmecorp --approve-token token_... --reason "Feature #145"
    → FSM: PROD_APPROVED → PROD_DEPLOYED → CLOSED
    → Backup + Healthchecks
    → Audit: log avec token (masqué)
    → Issue #145 fermée automatiquement

[6] VALIDATION PHASE (client)
    → Email: Feature en production
    → Slack: #acmecorp-notifications
```

---

## 📞 Support & Escalade

**Questions sur RBAC:** Contact admin (abdelali)  
**Issues approbation:** Contact lead (alice)  
**Urgence prod:** Oncall → rollback auto  

---

**RUNBOOK Version:** 1.0  
**Last Updated:** 2026-05-13  
**Phase A + B Status:** ✅ PRODUCTION READY

