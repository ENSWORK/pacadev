# PACADEV — Référence CLI

> CLI Python (Typer) — `/home/pacadev/pacadev/.venv/bin/pacadev`

---

## Infrastructure

| Commande | Description |
|----------|-------------|
| `pacadev infra start` | Démarrer PostgreSQL + Traefik |
| `pacadev infra stop` | Arrêter tous les services |
| `pacadev infra status` | État de l'infra (containers, health) |
| `pacadev infra restart` | Redémarrer tous les services |

---

## Workflow

| Commande | Description |
|----------|-------------|
| `pacadev work start --client <c> --issue <N> [--module <m>]` | Créer branche dev, démarrer travail |
| `pacadev work stop --client <c>` | Arrêter le travail, revenir à idle |
| `pacadev work status --client <c>` | État FSM du client |

---

## Déploiement

| Commande | Description |
|----------|-------------|
| `pacadev deploy approve --client <c> --env <prod\|staging> [--dry-run]` | Déployer (ou dry-run) |
| `pacadev deploy generate-approval --client <c> --reason <r>` | Générer token d'approbation |

---

## Backup / Rollback

| Commande | Description |
|----------|-------------|
| `pacadev backup create --client <c>` | Backup DB + filestore |
| `pacadev backup list --client <c>` | Lister les backups |
| `pacadev rollback --client <c> [--backup <id>] [--dry-run]` | Rollback (dernier backup ou spécifique) |

---

## Sécurité

| Commande | Description |
|----------|-------------|
| `pacadev secrets show <client>` | Voir les secrets (déchiffrés) |
| `pacadev secrets edit <client>` | Éditer les secrets |
| `pacadev secrets init <client>` | Initialiser les secrets |

---

## Monitoring

| Commande | Description |
|----------|-------------|
| `pacadev monitor start` | Démarrer Prometheus + Grafana + Loki |
| `pacadev monitor stop` | Arrêter le monitoring |
| `pacadev monitor status` | État du monitoring |
| `pacadev monitor logs` | Voir les logs |
| `pacadev health --all` | Healthcheck tous les clients |
| `pacadev health --client <c>` | Healthcheck un client |

---

## Génération

| Commande | Description |
|----------|-------------|
| `pacadev generate devcontainer --client <c>` | Générer .devcontainer |
| `pacadev generate ci --client <c>` | Générer pipeline GitHub Actions |

---

## Gestion

| Commande | Description |
|----------|-------------|
| `pacadev init <client> --odoo <14\|17\|19>` | Initialiser un nouveau client |
| `pacadev list` | Lister les clients |
| `pacadev version` | Afficher la version |

---

## Exemples

```bash
# Développer une feature pour afrequip
pacadev work start --client afrequip --issue 42 --module partner_statement_report

# Vérifier l'état
pacadev work status --client afrequip

# Déployer en staging
pacadev deploy approve --client afrequip --env staging --dry-run

# Backup avant déploiement prod
pacadev backup create --client afrequip

# Déployer en prod
pacadev deploy approve --client afrequip --env prod

# En cas de problème
pacadev rollback --client afrequip
```
