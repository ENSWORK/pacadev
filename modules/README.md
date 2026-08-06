# Modules ENS — Centralisés dans pacadev

**Date d'import :** 2026-05-14
**Dernière MAJ :** 2026-08-06
**Source :** `/home/pacadev/pacadev/modules/ens_core-17/` (machine PACADEV 192.168.11.20)
**Méthode :** copie monorepo (rsync sans `__pycache__`, `*.pyc`)

> ⚠️ L'ancien chemin `/home/abdelali/pacadev/modules/ens_core-17` (copie obsolète) a été **supprimé**.
> Un symlink `/home/abdelali/pacadev → /home/pacadev/pacadev` sert de compatibilité temporaire.
> Tous les `docker-compose.yml` des clients pointent désormais sur `/home/pacadev/pacadev/modules/ens_core-17`.

## Vue d'ensemble

| Module | Version | Catégorie | Licence | Deps |
|---|---|---|---|---|
| `custom_reports` | 17.0.1.44 | Sales | LGPL-3 | 7 |
| `custom_sale_invoice` | 17.0.1.0.0 | Sales | LGPL-3 | 2 |
| `ens_crm_task` | 17.0.1.1.0 | CRM | OPL-1 | 3 |
| `ens_extra` | 17.0.1.0.0 | ENS/extra | LGPL-3 | 3 |
| `ens_reports_print` | 17.0.1.0 | Custom | ? | 2 |
| `enswork_config_center` | 1.0 | Administration | LGPL-3 | 6 |
| `hr_payroll_community` | 17.0.1.1.0 | Human Resources | LGPL-3 | 2 (hr_contract, hr_holidays) |
| `partner_statement_report` | 17.0.1.4.0 | Accounting | LGPL-3 | 4 (contacts, account, mail, identifiants_fiscaux_maroc) |

**Total :** 8 modules ENS Odoo 17.

> `hr_payroll_community` (ex-sofetelec) et `partner_statement_report` (ex-afrequip) ont été
> **centralisés le 2026-08-06** dans le dossier partagé, conformément à la stratégie PACADEV.

## Utilisation par un client

Les clients bind-montent ce dossier en lecture seule :

```yaml
# v17/clients/<client>/docker-compose.yml
services:
  odoo:
    volumes:
      - /home/pacadev/pacadev/modules/ens_core-17:/mnt/extra-addons/ens_core_shared:ro
      - ./addons/oca:/mnt/extra-addons/oca:ro          # modules OCA / tiers
      - ./addons/ens_core:/mnt/extra-addons/ens_core:ro # modules spécifiques client
```

Et la config Odoo :
```ini
# v17/clients/<client>/config/odoo.conf
addons_path = /mnt/extra-addons/oca,/mnt/extra-addons/ens_core,/mnt/extra-addons/ens_core_shared,/usr/lib/python3/dist-packages/odoo/addons
```

> **Règle Odoo :** un module est chargé depuis le **premier** répertoire de `addons_path`
> qui le contient. L'ordre ci-dessus fait primer les modules locaux du client (`oca`, `ens_core`)
> sur le partagé (`ens_core_shared`) — c'est ce qui permet à un client de garder sa propre version
> d'un module partagé (fork volontaire).

## ⚠️ Divergences constatées entre le partagé et les copies clients (à réarbitrer)

Lors de l'audit du 2026-08-06, des copies locales des modules partagés existent encore chez les
clients avec des versions divergentes. **Elles n'ont PAS été supprimées** (risque de perte de code).
Elles doivent être arbitrées : soit fusionner les évolutions dans le partagé, soit déclarer une
fork officielle par client.

| Module | Partagé | afrequip/oca | mecafric/ens_core | mecafric_water/ens_core |
|---|---|---|---|---|
| `custom_reports` | 17.0.1.44 | **17.0.1.26** (43 fichiers diff) | **17.0.1.33** (23 diff) | **17.0.1.48.0** (37 diff) |
| `custom_sale_invoice` | 17.0.1.0.0 | 17.0.1.0.0 | 17.0.1.0.0 | 17.0.1.0.0 (4 diff) |
| `ens_extra` | 17.0.1.0.0 | 17.0.1.0.0 (4 diff) | 17.0.1.0.0 (4 diff) | 17.0.1.0.0 (7 diff + reports/) |
| `enswork_config_center` | **1.0** | 1.0 (7 diff) | 1.0 (7 diff) | **17.0.1.0.0** (12 diff) |

Modules spécifiques qui restent **uniquement** chez certains clients (hors partagé) :
`custom_company_fields`, `identifiants_fiscaux_maroc`, `delivery_from_sale`
(présents chez afrequip/mecafric/mecafric_water — à centraliser ou documenter comme forks).

**Actions recommandées lors de la revérification :**
1. Arbitrer `custom_reports` : choisir la version de référence (17.0.1.44 du partagé ?) et fusionner les évolutions métier par client.
2. Harmoniser `enswork_config_center` : le partagé (1.0) devrait être aligné sur la version 17.0.1.0.0 de mecafric_water.
3. Harmoniser les versions non standard : `ens_reports_print` (17.0.1.0) et `enswork_config_center` (1.0) → `17.0.x.y.z`.
4. Centraliser ou documenter `custom_company_fields`, `identifiants_fiscaux_maroc`, `delivery_from_sale`.

## Versionnage

Convention : `17.0.<major>.<minor>.<patch>`
- Bump **patch** (Z+1) : fix
- Bump **minor** (Y+1, Z=0) : nouvelle fonctionnalité
- Bump **major** (X+1, Y=0, Z=0) : changement breaking

Tag Git de déploiement : `<client>/v17/<YYYY.MM.DD>-<build>`

⚠️ **Versions non standard à corriger** :
- `ens_reports_print` : `17.0.1.0` → devrait être `17.0.1.0.0`
- `enswork_config_center` : `1.0` → devrait être `17.0.1.0.0`

## Lock files (versions épinglées par client) — ajouté le 2026-08-06

Chaque client possède un `module-versions.lock` (YAML, `v17/clients/<client>/`) qui épingle la
version des 8 modules partagés **réellement chargée** à l'exécution (l'ordre `addons_path`
`oca → ens_core → ens_core_shared` fait primer les forks locaux).

```bash
pacadev modules lock <client|all>   # (ré)génère le lock depuis le code monté
pacadev modules check <client|all>  # vérifie lock ↔ code (exit 1 si divergence)
```

Le déploiement (`pacadev deploy approve`) est **bloqué** en cas de divergence lock ↔ code monté
(garde-fou `_deploy_step`) : il faut réépingler (`modules lock`) ou arbitrer le fork.

État initial au 2026-08-06 :

| Client | custom_reports | custom_sale_invoice | ens_extra | enswork_config_center | Autres partagés |
|---|---|---|---|---|---|
| afrequip | 17.0.1.26 (oca) | 17.0.1.0.0 (oca) | 17.0.1.0.0 (oca) | 1.0 (oca) | shared |
| mecafric | 17.0.1.33 (ens_core) | 17.0.1.0.0 (ens_core) | 17.0.1.0.0 (ens_core) | 1.0 (ens_core) | shared |
| mecafric_water | 17.0.1.48.0 (ens_core) | 17.0.1.0.0 (ens_core) | 17.0.1.0.0 (ens_core) | 17.0.1.0.0 (ens_core) | shared |
| sofetelec | shared | shared | shared | shared | shared |

Source : `(oca|ens_core)` = fork local qui masque le partagé → à arbitrer (cf. section Divergences).

## ⚠️ Dettes de sécurité connues (à traiter avec SOPS)

- **`admin_passwd` en clair** dans `v17/clients/{mecafric,mecafric_water}/config/odoo.conf`
  (trackés dans git). Tentative de passage en variable d'env le 2026-08-06 : **Odoo 17 ne supporte
  pas `%(env:VAR)s` dans `odoo.conf`** (vérifié dans `odoo/tools/config.py`, la chaîne reste
  littérale). Correctif futur : générer `odoo.conf` depuis un template au démarrage du conteneur
  (wrapper entrypoint + `envsubst`), ou basculer vers les secrets SOPS (`core/secrets/*.enc.yaml`).
- **Client `maxelec` supprimé le 2026-08-06** (décision utilisateur) : conteneur, dossier
  `v17/clients/maxelec/` (fourre-tout `addons/oca/` avec un repo cloné, non versionné) et état CLI
  retirés. Les références restantes dans les docs historiques (`migration/`, `FUSION_*`) sont
  conservées telles quelles à titre d'archive.

## Détail par module


### `custom_reports` — Enswork Reports

- **Version :** `17.0.1.44`
- **Licence :** LGPL-3
- **Auteur :** ENSWORK
- **Catégorie :** Sales
- **Installable :** True
- **Dépendances (7) :** base, web, sale, purchase, stock, account, identifiants_fiscaux_maroc
- **Résumé :** Custom report templates by Enswork

**Description :**

> Custom reports templates including:
        * Custom header for quotations
        * Custom header for delivery slips
        * Custom header for invoices
        * Custom header for purchase orders

### `custom_sale_invoice` — Custom Sale Invoice

- **Version :** `17.0.1.0.0`
- **Licence :** LGPL-3
- **Auteur :** ENSWORK
- **Catégorie :** Sales
- **Installable :** True
- **Dépendances (2) :** sale, account
- **Résumé :** Enhance sale order with direct invoice creation and force sale options

**Description :**

> This module adds the following features to sale orders:
- Create and validate invoices directly from sale orders
- Force sale completion without generating invoices
- Add user group for accessing these options

### `ens_crm_task` — ENS CRM Task Creator

- **Version :** `17.0.1.1.0`
- **Licence :** OPL-1
- **Auteur :** ENS Development
- **Catégorie :** CRM
- **Installable :** True
- **Dépendances (3) :** crm, project, mail
- **Résumé :** Create project tasks from CRM leads/opportunities with history transfer

**Description :**

> ENS CRM Task Creator
        ====================

        Create project tasks directly from CRM leads/opportunities with:
        - Create new task with pre-filled fields
        - Link to existing task
        - Automatic history (chatter) transfer
        - Automatic lead archiving
        - Redirect to task after creation

        Features:
        ---------
        * Button "Create Task" on ...

### `ens_extra` — extra

- **Version :** `17.0.1.0.0`
- **Licence :** LGPL-3
- **Auteur :** ?
- **Catégorie :** ENS/extra
- **Installable :** True
- **Dépendances (3) :** base, sale, product
- **Résumé :** ENS extra Module

**Description :**

> ENS extra Module

### `ens_reports_print` — ENS Reports Print

- **Version :** `17.0.1.0`
- **Licence :** ?
- **Auteur :** ENSDEV
- **Catégorie :** Custom
- **Installable :** True
- **Dépendances (2) :** base, account
- **Résumé :** Impression flexible avec options configurables

### `enswork_config_center` — ENSWORK Configuration Center

- **Version :** `1.0`
- **Licence :** LGPL-3
- **Auteur :** ENSWORK
- **Catégorie :** Administration
- **Installable :** True
- **Dépendances (6) :** base_setup, web, base, sale_management, purchase, stock
- **Résumé :** Centralisation des paramètres et configurations de système ENSWORK

**Description :**

> Module centralisé pour la gestion des paramètres spécifiques à ENSWORK.
        Module de configuration pour les modules Enswork.
        Permet d'activer ou désactiver différentes fonctionnalités.


## Notes d'import

### Non importés (volontairement)

- **`ens_core-14/`** (source) : ne contient que `oca_custom/ourcustom_impression/` (pas un module ENS core). Ignoré.
- **`ens_core-19/`** (source) : vide (uniquement `.gitkeep`). Ignoré.
- **`partner_statement_report/`** : était un dossier coquille vide (seulement `__pycache__/`).
  Le module canonique **a été centralisé le 2026-08-06** depuis `v17/clients/afrequip/addons/ens_core/`
  vers `modules/ens_core-17/partner_statement_report/` (version 17.0.1.4.0).

### Tests Odoo

Aucun module ne contient de dossier `tests/`. À créer lors de prochaines évolutions (cf. Phase 7 de la fusion).

### Stratégie de bind-mount

Les clients doivent bind-monter ce dossier **en lecture seule** (`:ro`). Le `docker-compose.yml` de chaque client doit pointer vers `/home/pacadev/pacadev/modules/ens_core-17` (voir section « Utilisation par un client »).

### Workflow modification

1. `pacadev work start --client <C> --issue <N>` → crée branche `dev/<C>/<N>-<action>`
2. Modifier le module sous `modules/ens_core-17/<module>/`
3. Bumper la version dans `__manifest__.py` (`17.0.X.Y.Z+1`)
4. Redémarrer Odoo avec `-u <module>` : `docker exec <C>_odoo odoo -c /etc/odoo/odoo.conf -d <db> -u <module> --stop-after-init`
5. Tester localement
6. `pacadev work commit --module <module> --type feat|fix`
7. Push → CI (lint + test + security couvrent désormais `modules/ens_core-17/`) → merge

## Origine et traçabilité

- Repo source : `git@github.com:a-bahou/ensdev.git`
- Branche source au moment de l'import : `dev/afrequip-11-ajouter-champ-ice-client`
- Commit source HEAD : `bdca057 fix: add ICE client field to sale order and crm lead models`
