# PACADEV RUNBOOK — Procédures d'Urgence

> **Règle d'or :** Backup d'abord, action ensuite. En cas de doute, rollback.

---

## 🚨 Niveaux d'Urgence

| Niveau | Symptôme | SLA réponse |
|--------|----------|-------------|
| **P0 — Critique** | Production down, DB inaccessible | < 15 min |
| **P1 — Majeur** | Fonctionnalité clé cassée, erreurs 500 > 10% | < 1h |
| **P2 — Modéré** | Performance dégradée, feature partielle | < 4h |
| **P3 — Mineur** | Bug non bloquant, cosmétique | Prochain sprint |

---

## 🔴 P0 — Odoo Production Down

### Diagnostic rapide (< 2 min)

```bash
# 1. État des containers
docker ps --filter "name=<client>_" --format "table {{.Names}}\t{{.Status}}"

# 2. Logs récents (50 dernières lignes)
docker logs --tail 50 <client>_odoo_prod

# 3. DB accessible ?
docker exec <client>_db_prod pg_isready -U odoo

# 4. Via CLI PACADEV
source ~/.pacadev-venv/bin/activate
pacadev health --client <client>
```

### Arbre de décision

```
Odoo down ?
├── Container absent → Redémarrage simple (§1.1)
├── Container up mais HTTP 502 → Check mémoire/workers (§1.2)
├── DB down → Restauration DB (§1.3)
└── Crash loop → Rollback immédiat (§1.4)
```

### §1.1 — Redémarrage simple

```bash
docker restart <client>_odoo_prod
sleep 10
curl -sf http://localhost:8069/web/health && echo "OK" || echo "KO"
```

### §1.2 — Saturation mémoire / workers

```bash
# Vérifier mémoire
docker stats <client>_odoo_prod --no-stream

# Si mémoire > 90% → tuer et redémarrer
docker stop <client>_odoo_prod
docker start <client>_odoo_prod

# Si workers bloqués → redémarrage forcé
docker kill -s SIGTERM <client>_odoo_prod
sleep 5
docker start <client>_odoo_prod
```

### §1.3 — DB inaccessible

```bash
# Tenter redémarrage DB
docker restart <client>_db_prod
sleep 15
docker exec <client>_db_prod pg_isready -U odoo

# Si DB corrompue → restauration backup
pacadev rollback --client <client> --auto
```

### §1.4 — Rollback immédiat

```bash
# Rollback vers dernier backup (< 30 sec)
pacadev rollback --client <client> --auto

# Ou vers backup spécifique
pacadev backup list --client <client>
pacadev rollback --client <client> --backup bk-YYYYMMDD-HHMM
```

---

## 🔴 P0 — Corruption Base de Données

### Symptômes
- `ERROR: invalid page in block X of relation`
- `FATAL: could not open file`
- Connexions bloquées indéfiniment

### Procédure

```bash
# 1. Arrêter Odoo immédiatement
docker stop <client>_odoo_prod

# 2. Vérifier intégrité DB
docker exec <client>_db_prod psql -U odoo -c "\l"
docker exec <client>_db_prod psql -U odoo -d <client>_db -c "SELECT count(*) FROM res_users;"

# 3. Si corrompue → restaurer backup
BACKUP=$(ls /tmp/pacadev-backup-bk-*.tar.gz | sort -r | head -1)
pacadev rollback --client <client> --backup $(basename $BACKUP .tar.gz | sed 's/pacadev-backup-//')

# 4. Redémarrer Odoo
docker start <client>_odoo_prod

# 5. Vérifier
curl -sf http://localhost:8069/web/health
```

---

## 🟠 P1 — Erreurs 500 en Masse

### Diagnostic

```bash
# Logs Odoo filtrés sur erreurs
docker logs <client>_odoo_prod 2>&1 | grep "ERROR" | tail -30

# Via Loki (si monitoring actif)
# Grafana → Explore → {job="odoo"} |= "ERROR" | last 1h

# Identifier le module fautif
docker logs <client>_odoo_prod 2>&1 | grep "ERROR" | grep -oP '(?<=odoo\.addons\.)\w+' | sort | uniq -c | sort -rn
```

### Actions

```bash
# Option A — Désactiver le module fautif
docker exec <client>_odoo_prod odoo-bin \
  -d <client>_db \
  --uninstall-module <module_fautif> \
  --stop-after-init

# Option B — Rollback du dernier déploiement
pacadev rollback --client <client> --auto

# Option C — Mode maintenance
cat > /tmp/maintenance.html << 'EOF'
<html><body><h1>Maintenance en cours</h1><p>Retour dans quelques minutes.</p></body></html>
EOF
# Configurer nginx/proxy pour servir cette page
```

---

## 🟠 P1 — Déploiement Échoué

### Pendant le déploiement CI/CD

```bash
# Le pipeline déclenche automatiquement un rollback
# Vérifier les logs GitHub Actions

# Si rollback automatique échoué → rollback manuel
pacadev rollback --client <client> --auto

# Vérifier état post-rollback
pacadev health --client <client>
```

### Après un déploiement manuel raté

```bash
# 1. Trouver le bon backup
pacadev backup list --client <client>

# 2. Rollback
pacadev rollback --client <client> --backup bk-YYYYMMDD-HHMM

# 3. Documenter l'incident
cat >> ~/.pacadev/state/audit-log.jsonl << EOF
{"ts":"$(date -Iseconds)","action":"incident","client":"<client>","reason":"deploy_failed","rollback":"bk-YYYYMMDD-HHMM"}
EOF
```

---

## 🟡 P2 — Performance Dégradée

### Requêtes lentes PostgreSQL

```bash
# Top requêtes lentes (> 1s)
docker exec <client>_db_prod psql -U odoo -d <client>_db << 'SQL'
SELECT
  round(mean_exec_time::numeric, 2) AS avg_ms,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  left(query, 80) AS query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
SQL

# Connexions actives
docker exec <client>_db_prod psql -U odoo -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Locks bloquants
docker exec <client>_db_prod psql -U odoo -d <client>_db -c \
  "SELECT pid, wait_event_type, wait_event, query FROM pg_stat_activity WHERE wait_event IS NOT NULL LIMIT 10;"
```

### Tuer une connexion bloquante

```bash
docker exec <client>_db_prod psql -U odoo -c \
  "SELECT pg_terminate_backend(<pid>);"
```

### Vacuum / Analyse

```bash
docker exec <client>_db_prod psql -U odoo -d <client>_db -c \
  "VACUUM ANALYZE;"
```

---

## 🔧 Opérations de Maintenance

### Backup manuel immédiat

```bash
source ~/.pacadev-venv/bin/activate
pacadev backup create --client <client>
```

### Vérifier tous les clients

```bash
pacadev health --all
pacadev work status
```

### Nettoyer les vieux backups

```bash
# Supprimer backups > 7 jours dans /tmp
find /tmp -name "pacadev-backup-*.tar.gz" -mtime +7 -delete
echo "Backups restants:"
ls -lh /tmp/pacadev-backup-*.tar.gz 2>/dev/null || echo "Aucun"
```

### Renouveler les secrets SOPS

```bash
# Éditer les secrets d'un client
source ~/.pacadev-venv/bin/activate
pacadev secrets edit <client>

# Vérifier après édition
pacadev secrets show <client>
```

### Mettre à jour le CLI PACADEV

```bash
cd /data/Pacadev/core/cli
git pull
source ~/.pacadev-venv/bin/activate
pip install -e . -q
pacadev version
```

---

## 📊 Monitoring — Requêtes Utiles

### Grafana / Prometheus

```
# CPU moyen (15min)
avg(rate(node_cpu_seconds_total{mode!="idle"}[15m])) * 100

# Mémoire utilisée %
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100

# Containers actifs
count(container_last_seen{name=~".+"})
```

### Loki — Logs

```
# Erreurs Odoo dernière heure
{job="odoo"} |= "ERROR" | last 1h

# Logs d'un module spécifique
{job="odoo"} |= "<module_name>"

# Déploiements récents
{job="pacadev"} |= "deploy"

# Erreurs critiques toutes sources
{job=~"odoo|pacadev"} |= "CRITICAL"
```

---

## 📋 Checklist Post-Incident

```
[ ] Service rétabli et healthcheck OK
[ ] Cause racine identifiée
[ ] Audit log mis à jour
[ ] Backup post-incident créé
[ ] GitHub Issue créée avec tag [incident]
[ ] Équipe notifiée
[ ] Action corrective planifiée (ticket GitHub)
[ ] RUNBOOK mis à jour si procédure manquante
```

---

## 📞 Contacts d'Urgence

```yaml
on_call:
  primary: dg.enswork@gmail.com
  escalation: support@enswork.com

services:
  github: https://github.com/ENSWORK/pacadev/issues
  monitoring: http://localhost:3000  # Grafana local
  logs: http://localhost:3000/explore  # Loki
```

---

*RUNBOOK PACADEV v1.0 — Mis à jour: 2026-05-12*
