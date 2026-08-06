# PACADEV — Contexte agent (opencode)

Tu es l'agent de développement Odoo de l'orchestrateur **PACADEV** sur la machine `192.168.11.20` (utilisateur `pacadev`). Tu travailles **en parallèle** de l'orchestrateur : toute action sur l'infra ou les clients passe par la CLI `pacadev`, jamais en direct.

## Règles Odoo strictes

Avant de générer ou modifier du code, lis et applique :
- `core/memory/rules/odoo_v17_v19_strict.md` — interdits absolus, obligations, décorateurs, nommage
- `core/memory/rules/ai_agent_instructions.md` — workflow agent et erreurs courantes
- `docs/CLI_REFERENCE.md` — référence complète des commandes `pacadev`

### Interdits absolus
- JAMAIS de SQL brut (`self.env.cr.execute`) sans justification écrite
- JAMAIS d'API Odoo v14/v15 obsolète — uniquement les décorateurs modernes
- JAMAIS de vues sans action fenêtre (`ir.actions.act_window`)
- JAMAIS de module sans `security/ir.model.access.csv`
- JAMAIS de secrets en clair dans les logs, les commits ou les messages

### Obligations
- Décorateurs : `@api.depends`, `@api.constrains`, `@api.onchange`, `@api.model`, `@api.model_create_multi`
- Structure module : `__init__.py`, `__manifest__.py` (version `17.0.x.x.x`), `models/`, `views/`, `security/`
- Vérification des droits : `self.env['res.users'].has_group('module.group_name')`
- Nommage : modèle `module.model_name`, classe `ModelName`, vue `view_module_model_form/tree`, action `action_module_model`

## Workflow obligatoire

Après toute génération ou modification de code, exécute la machine à états :

1. `pacadev work start --client <client> --issue <N> [--module <m>]` — entrer en DEV
2. Générer / modifier le code dans `v14|v17|v19/clients/<client>/addons/`
3. `pacadev work review --client <client>` — self-review **obligatoire**
   - Si erreur : corrige automatiquement puis relance jusqu'à revue verte
   - Ne JAMAIS proposer de commit tant que la revue n'est pas verte
4. `pacadev work commit --client <client> --module <m> --type <type> --desc "<desc>"` — commit formaté `type: desc` + `Refs: #issue`
5. `pacadev work done --client <client> --issue <N>` — clôturer le ticket

## Clients connus

| Client          | Version | URL (Traefik)                | Module ENS |
|-----------------|---------|------------------------------|------------|
| afrequip        | v17     | afrequip.pacadev.local       | partner_statement_report |
| mecafric        | v17     | mecafric.pacadev.local       | — |
| mecafric_water  | v17     | mecafric_water.pacadev.local | — |
| maxelec         | v17     | maxelec.pacadev.local        | — |
| sofetelec       | v17     | sofetelec.pacadev.local      | hr_payroll_community |
| specta          | v14     | specta.pacadev.local         | — |

## Infrastructure

- Réseau Docker unique : `pacadev-network`
- DNS wildcard `*.pacadev.local` → `192.168.11.20` (dnsmasq)
- Traefik : reverse proxy port 80, dashboard port 8091
- PostgreSQL partagé : port host 5434
- IA : LiteLLM + OpenRouter (`deepseek/deepseek-chat`), mémoire Mem0 + ChromaDB
- Déploiement : uniquement via `pacadev deploy` (token d'approbation HMAC, TTL 15 min, backup avant prod)

## Commandes utiles

```bash
pacadev list                              # clients enregistrés
pacadev work status                       # état FSM de tous les clients
pacadev health --all                      # santé globale
pacadev memory search "<question>" --rules   # contexte mémoire IA
pacadev ai generate --task "<tâche>" --client <c>   # génération IA
pacadev backup create --client <c>        # backup avant déploiement
```

## Règles de conduite

- Préférer les commandes slash : `/work`, `/review`, `/commit`, `/deploy`, `/health`, `/ai`
- Ne pas contourner l'orchestrateur (pas de `docker exec` pour commiter/déployer)
- Vérifier la santé avant et après chaque déploiement
- Signaler toute procédure d'urgence via `pacadev runbook`
