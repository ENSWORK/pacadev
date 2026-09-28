# Job de projection Odoo -> cockpit PACADEV

Genere la projection JSON des taches Odoo que consomme le cockpit web, et
archive un instantane quotidien. Execute par systemd, toutes les 30 minutes,
sans dependance tierce.

## Fichiers

| Fichier | Role |
|---|---|
| `export_operations_tasks.py` | Generateur : interrogation Odoo, normalisation, ecriture |
| `odoo_mcp.py` | Transport MCP en lecture seule, sans secret |
| `.env.example` | Modele de configuration (a copier en `.env`) |
| `systemd/*.service`, `systemd/*.timer` | Unites systemd utilisateur |
| `README.md` | Ce document |

## Installation

```bash
cd /home/pacadev/pacadev

# 1. Configuration et secret (la cle ne doit jamais etre versionnee)
cp core/scripts/operations/.env.example core/scripts/operations/.env
chmod 600 core/scripts/operations/.env
nano core/scripts/operations/.env          # renseigner ODOO_API_KEY

# 2. Unites systemd (les copies versionnees sont la reference)
cp core/scripts/operations/systemd/pacadev-operations-projection.service       ~/.config/systemd/user/
cp core/scripts/operations/systemd/pacadev-operations-projection.timer         ~/.config/systemd/user/
cp core/scripts/operations/systemd/pacadev-operations-projection-alerte@.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now pacadev-operations-projection.timer
```

## Verification

```bash
# Logique hors reseau : ni Odoo, ni cle, ni fichier de donnees touche
python3 core/scripts/operations/export_operations_tasks.py --selftest

# Interroge Odoo et controle, sans ecrire
python3 core/scripts/operations/export_operations_tasks.py --dry-run

# Execution reelle
systemctl --user start pacadev-operations-projection.service
systemctl --user status pacadev-operations-projection.service
journalctl --user -u pacadev-operations-projection.service -n 30
systemctl --user list-timers pacadev-operations-projection.timer
```

## Sorties

| Code | Signification | Effet |
|---|---|---|
| 0 | Projection ecrite | Fichier remplace, instantane du jour archive |
| 2 | Odoo injoignable ou cle absente | **Aucune ecriture** : l'ancienne projection est conservee |
| 3 | Controle de coherence en echec | **Aucune ecriture** : idem |
| 4 | Historique ou purge indisponible | Projection valide, archive signalee |

Le choix est assume : mieux vaut afficher une donnee datee et signalee que
remplacer un fichier fiable par un instantane douteux. Le cockpit signale
lui-meme une projection de plus de 60 minutes comme « stale ».

## Securite

- Aucune cle n'est codee en dur dans le depot. Elle vit dans `.env`, en `600`,
  et `.env` est dans le `.gitignore` racine.
- La sortie du journal ne contient ni cle, ni jeton : uniquement des compteurs.
- Le job est en lecture seule : il n'ecrit jamais dans Odoo.

## Diagnostic

```bash
# Le cockpit affiche-t-il des etages incoherents ?
python3 -c "import json;d=json.load(open('web/.data/operations-tasks.json'));print(d['counts'])"

# La projection est-elle fraiche ?
python3 -c "import json;print(json.load(open('web/.data/operations-tasks.json'))['generated_at'])"

# Le timer tourne-t-il encore ?
systemctl --user list-timers pacadev-operations-projection.timer
```

## Note sur le doublon windows

`Helper-Ai/export_operations_tasks.py` est un miroir de ce script, pour le poste
Windows. En cas d'ecart entre les deux, **cette version fait foi** : c'est elle
qui tourne en automatique.
