# PACADEV CLI — Référence complète

Version : PACADEV v1.0.0 — Orchestrateur de Développement Odoo.
Machine : `192.168.11.20` (utilisateur `pacadev`). Accès : `ssh pacadev "cd ~/pacadev && .venv/bin/pacadev ..."`.

## Commandes racine

```bash
pacadev version   # Version de PACADEV
pacadev init <client> [--odoo 14|17|19] [--template standard]   # Initialise un client
pacadev list      # Clients enregistrés (afrequip, mecafric, mecafric_water, sofetelec)
pacadev health [--client <c>|--all]   # Santé Odoo + DB par client
```

## work — machine à états (FSM)

| Commande | Usage |
|---|---|
| `work start` | `--issue <N> --client <c> [--module <m>] [--odoo <v>]` — entrer en DEV |
| `work stop` | `--client <c>` — arrêter l'environnement |
| `work status` | Affiche l'état de **tous** les clients (pas d'option `--client`) |
| `work review` | `--client <c> [--passed|--failed] [--odoo <v>]` — self-review avant push |
| `work test-manual` | `--client <c> [--passed|--failed] [--odoo <v>]` — test manuel avant push |
| `work commit` | `--client <c> --module <m> --type <add|fix|ref|rem> --desc "<desc>" [--issue <N>] [--push] [--odoo <v>]` |
| `work done` | `--client <c> --issue <N> [--comment "..."] [--odoo <v>]` — clôturer le ticket |

Format de commit : `type: desc` + `Refs: #issue`.

## deploy — déploiement

```bash
pacadev deploy generate-approval   # Token d'approbation signé (TTL 15 min, backup requis)
pacadev deploy approve             # Déploie après approbation
```

## backup / rollback

```bash
pacadev backup create --client <c>   # Backup atomique (DB + filestore + config)
pacadev backup list
pacadev rollback run                 # Rollback vers un backup
```

## test

```bash
pacadev test run                     # Tests unitaires Odoo
```

## secrets (SOPS + age)

```bash
pacadev secrets init <client>   # Crée le fichier secrets chiffré
pacadev secrets show <client>   # Valeurs masquées
pacadev secrets edit <client>   # Édition via SOPS
```

## generate

```bash
pacadev generate devcontainer --client <c>   # devcontainer + config
pacadev generate ci --client <c>             # GitHub Actions
```

## monitor — Prometheus + Grafana + Loki

```bash
pacadev monitor start|stop|status|logs
```

## runbook — procédures d'urgence

```bash
pacadev runbook show [section]
pacadev runbook emergency --client <c>
pacadev runbook sections
```

## issue — issues GitHub

```bash
pacadev issue view <N>
pacadev issue create
pacadev issue update
pacadev issue close-deploy
```

## infra — infrastructure partagée

```bash
pacadev infra start|stop|status|logs|verify
pacadev infra start-all-clients
pacadev infra recreate
```

## memory — contexte IA (Mem0 + ChromaDB)

```bash
pacadev memory search "<question>" [--client <c>] [--rules] [--limit <n>]
pacadev memory load-rules      # Règles Odoo + bonnes pratiques ENS
pacadev memory load-clients    # Configurations clients
pacadev memory load-history    # Historique bugs/corrections
pacadev memory init            # load-rules + load-clients + load-history en une commande
pacadev memory stats           # Statistiques de la base ChromaDB
```

Provider LLM : LiteLLM → OpenRouter (`LITELLM_MODEL` dans `.env`).

## ai — génération IA

```bash
pacadev ai generate --task "<tâche>" --client <c>   # Génération de code avec contexte PACADEV
```

## Environnement

- `PACADEV_ROOT=/home/pacadev/pacadev`
- Clés API : `.env` (jamais commité)
- Secrets clients : SOPS/age dans `secrets/*.enc.yaml`
