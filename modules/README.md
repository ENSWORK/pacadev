# Modules ENS — Centralisés dans pacadev

**Date d'import :** 2026-05-14
**Source :** `/home/abdelali/OpenEnsdev/main-dev-repo/ens_core-17/`
**Méthode :** copie monorepo (rsync sans `__pycache__`, `*.pyc`)

## Vue d'ensemble

| Module | Version | Catégorie | Licence | Deps |
|---|---|---|---|---|
| `custom_reports` | 17.0.1.44 | Sales | LGPL-3 | 7 |
| `custom_sale_invoice` | 17.0.1.0.0 | Sales | LGPL-3 | 2 |
| `ens_crm_task` | 17.0.1.1.0 | CRM | OPL-1 | 3 |
| `ens_extra` | 17.0.1.0.0 | ENS/extra | LGPL-3 | 3 |
| `ens_reports_print` | 17.0.1.0 | Custom | ? | 2 |
| `enswork_config_center` | 1.0 | Administration | LGPL-3 | 6 |


**Total :** 6 modules ENS Odoo 17.

## Utilisation par un client

Les clients bind-montent ce dossier en lecture seule :

```yaml
# v17/clients/<client>/docker-compose.yml
services:
  odoo:
    volumes:
      - /home/abdelali/pacadev/modules/ens_core-17:/mnt/extra-addons/ens_core:ro
```

Et la config Odoo :
```ini
# v17/clients/<client>/config/odoo.conf
addons_path = /mnt/extra-addons/ens_core,/mnt/extra-addons/oca
```

## Versionnage

Convention : `17.0.<major>.<minor>.<patch>`
- Bump **patch** (Z+1) : fix
- Bump **minor** (Y+1, Z=0) : nouvelle fonctionnalité
- Bump **major** (X+1, Y=0, Z=0) : changement breaking

Tag Git de déploiement : `<client>/v17/<YYYY.MM.DD>-<build>`

⚠️ **Versions non standard à corriger** :
- `ens_reports_print` : `17.0.1.0` → devrait être `17.0.1.0.0`
- `enswork_config_center` : `1.0` → devrait être `17.0.1.0.0`

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
- **`partner_statement_report/`** (dans `ens_core-17/`) : dossier coquille vide (seulement `__pycache__/`). Le module canonique vit dans `v17/clients/afrequip/addons/oca/partner_statement_report/` (branche dev en cours). Non réimporté ici.

### Tests Odoo

Aucun module ne contient de dossier `tests/`. À créer lors de prochaines évolutions (cf. Phase 7 de la fusion).

### Stratégie de bind-mount

Les clients doivent bind-monter ce dossier **en lecture seule** (`:ro`). Le `docker-compose.yml` de chaque client doit pointer vers `/home/abdelali/pacadev/modules/ens_core-17`.

### Workflow modification

1. `pacadev work start --client <C> --issue <N>` → crée branche `dev/<C>/<N>-<action>`
2. Modifier le module sous `modules/ens_core-17/<module>/`
3. Bumper la version dans `__manifest__.py` (`17.0.X.Y.Z+1`)
4. Redémarrer Odoo avec `-u <module>` : `docker exec <C>_odoo_1 odoo -c /etc/odoo/odoo.conf -d <db> -u <module> --stop-after-init`
5. Tester localement
6. `pacadev work commit -m "<msg>" --module <module> --type feat|fix`
7. Push → CI → IA risk → merge

## Origine et traçabilité

- Repo source : `git@github.com:a-bahou/ensdev.git`
- Branche source au moment de l'import : `dev/afrequip-11-ajouter-champ-ice-client`
- Commit source HEAD : `bdca057 fix: add ICE client field to sale order and crm lead models`
