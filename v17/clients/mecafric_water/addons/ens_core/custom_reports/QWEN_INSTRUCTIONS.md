# Instructions pour Qwen (et autres assistants IA) - Module Custom Reports

## Contexte du projet
Le module `custom_reports` est un module Odoo 17 qui gère l'impression dynamique de documents commerciaux (devis, factures, livraisons, bons de commande) avec 3 templates principaux : ENS, DB (DoliBarr), MEC.

## Architecture du système de rapports

### 1. Templates disponibles
- **ENS** : Template simple et épuré avec en-tête minimaliste
- **DB (DoliBarr)** : Template élaboré avec design professionnel et informations fiscales détaillées
- **MEC (Template MEC)** : Template hautement personnalisable avec images d'en-tête/pied de page
- **Odoo** : Template natif d'Odoo (fallback)

### 2. Système de rapports dynamiques
- Les rapports dynamiques (ex: `report_sale_dynamic.xml`) sont les seuls à être actifs dans le menu d'impression
- Selon la configuration `company_id.print_template`, le système affiche le template approprié
- Les rapports individuels (ENS, DB, MEC) sont désactivés via des fichiers de désactivation

### 3. Fichiers de désactivation
Les fichiers suivants désactivent les rapports individuels :
- `report_delivery_disable.xml` - pour les bons de livraison
- `report_invoice_disable.xml` - pour les factures
- `report_sale_disable.xml` - pour les ventes
- `report_rfq_disable.xml` - pour les demandes de prix

## Bonnes pratiques de développement Odoo (extrait des instructions CLAUDE.md)

### 1. Sécurité
- Utiliser `groups="..."` sur les champs sensibles
- Vérifier les droits avec `check_access_rights()` plutôt que `sudo()`
- Ne pas utiliser `sudo()` dans `create()` ou `write()`

### 2. ORM & Performances
- Privilégier `search()` à `browse().filtered()` pour les filtres
- Toujours filtrer `search([])` pour éviter de récupérer des données archivées
- Appeler `super()` à la fin des méthodes héritées
- Utiliser `ensure_one()` avant d'accéder à des champs sirisqués

### 3. Templates QWeb
- Utiliser `o` pour les objets (ex: `o.company_id`, `o.partner_id`)
- Ne pas mélanger `o` et `doc` dans le même template
- Utiliser `t-attf-style` pour les styles dynamiques (ex: `t-attf-style="max-height: #{o.company_id.logo_height}px"`)
- Toujours s'assurer que les templates référencés existent

### 4. Documentation
- Ajouter des docstrings sur tous les modèles et méthodes non-triviales
- Fournir des help text détaillés sur les champs
- Maintenir un fichier README.md à jour
- Tenir à jour un fichier CHANGELOG.md

## Processus de développement typique

### 1. Création de nouveaux templates
Lors de la création d'un nouveau template :
1. Créer un template de document séparé (ex: `report_xxx_document`)
2. Créer un template principal qui appelle le document
3. Ajouter le template au rapport dynamique correspondant
4. Désactiver le rapport individuel via un fichier de désactivation

### 2. Options d'impression
- Les options d'impression sont gérées au niveau du modèle (ex: `print_with_header`, `print_with_ref`)
- Elles sont accessibles dans les templates via `o.nom_option`
- Elles sont configurables dans les formulaires via les vues XML

### 3. Structure des templates
Un template complet doit inclure :
1. Template d'en-tête (`external_layout_header_xxx`)
2. Template de pied de page (`external_layout_footer_xxx`)
3. Template de disposition (`external_layout_xxx`)
4. Template de document (`xxx_document`)
5. Template principal (`xxx`)
6. Action de rapport (`ir.actions.report`)

## Points d'attention

### 1. Cohérence des noms
- Les IDs des templates doivent être cohérents (ex: `report_invoice_ens_document`, `external_layout_invoice_ens`)
- Les noms des actions de rapport doivent suivre la convention `action_report_xxx`

### 2. Désactivation des rapports
- Toujours désactiver les rapports individuels pour éviter la duplication dans le menu d'impression
- Utiliser les fichiers de désactivation (`*_disable.xml`)
- Ne garder que les rapports dynamiques actifs

### 3. Gestion des erreurs courantes
- S'assurer que tous les templates référencés existent
- Vérifier que les variables sont correctement nommées (`o` vs `doc`)
- Valider la syntaxe XML des fichiers de rapport

### 4. Cache et mise à jour des rapports
- Après modification des templates, il est souvent nécessaire de vider les caches Odoo
- Les modifications de templates peuvent être mises en cache, donc redémarrer Odoo si nécessaire
- Pour les nouveaux rapports, un redémarrage d'Odoo est souvent nécessaire pour qu'ils apparaissent dans le menu d'impression

## Processus de développement typique

### 1. Ajout d'une nouvelle option d'impression
1. Ajouter le champ dans le modèle correspondant
2. Ajouter le champ dans la vue formulaire
3. Utiliser la condition dans le(s) template(s) concerné(s)
4. Tester avec les 3 templates (ENS, DB, MEC)

### 2. Création d'un nouveau type de rapport
1. Créer les 3 templates (ENS, DB, MEC) avec la structure complète
2. Créer le rapport dynamique
3. Créer le fichier de désactivation
4. Mettre à jour le manifeste
5. Mettre à jour le CHANGELOG

### 3. Modification d'un template existant
1. Identifier tous les fichiers affectés
2. Maintenir la cohérence entre les 3 templates (ENS, DB, MEC)
3. Mettre à jour le CHANGELOG
4. Tester la fonctionnalité

## Commandes utiles

### Pour tester les modifications
```bash
# Redémarrer Odoo après modifications
ensdev restart

# Mettre à jour le module
ensdev upgrade ens_core/custom_reports
```

### Pour vider les caches après modification de templates
```bash
# Script pour vider les caches Odoo après modification de templates
cd /data/enswork-workspace && timeout 30 /data/enswork-workspace/odoo-sources/odoo-17/venv/bin/python3 \
/data/enswork-workspace/odoo-sources/odoo-17/odoo-server/odoo-bin shell \
-c /data/enswork-workspace/odoo-17/mecafric/config/odoo.conf -d mecafric_v17 << 'PYTHON_EOF'

# Vider TOUS les caches
env['ir.ui.view'].clear_caches()
env['ir.qweb'].clear_caches()
env['ir.actions.report'].clear_caches()

# Supprimer les PDFs en cache (factures, devis, BL, achats)
attachments = env['ir.attachment'].search([
    '|', '|', '|', '|', '|',
    ('name', 'ilike', 'Facture'),
    ('name', 'ilike', 'Devis'),
    ('name', 'ilike', 'Commande'),
    ('name', 'ilike', 'Livraison'),
    ('name', 'ilike', 'Demande de prix'),
    ('name', 'ilike', 'Request for Quotation')
])
count = len(attachments)
attachments.unlink()

print(f"✅ Caches vidés + {count} PDFs supprimés")
env.cr.commit()
exit()
PYTHON_EOF
```

### Pour valider la syntaxe XML
```bash
# Vérifier la syntaxe des fichiers XML
python3 -c "import xml.etree.ElementTree as ET; ET.parse('chemin/vers/fichier.xml')"
```

## Règles de nommage

### Templates
- `external_layout_header_xxx` - En-tête du template
- `external_layout_footer_xxx` - Pied de page du template
- `external_layout_xxx` - Disposition générale
- `report_xxx_document` - Contenu du document
- `report_xxx` - Template principal

### Actions de rapport
- `action_report_xxx` - Action de rapport

### Fichiers de désactivation
- `report_xxx_disable.xml` - Désactivation des rapports individuels

## Versioning
- Suivre le format de versionnage sémantique (MAJEUR.MINEUR.PATCH)
- Mettre à jour le CHANGELOG à chaque modification
- Indiquer clairement les ajouts, modifications, corrections et suppressions

## Checklist avant commit

### Documentation
- [ ] CHANGELOG.md mis à jour avec date du jour
- [ ] README.md mis à jour si fonctionnalité visible utilisateur
- [ ] Docstrings ajoutées sur nouveaux éléments
- [ ] Help détaillés sur nouveaux champs

### Code
- [ ] Version incrémentée dans `__manifest__.py`
- [ ] Pas de code commenté (supprimer ou documenter)
- [ ] Les templates référencés existent bien

### Git
- [ ] Message de commit descriptif avec convention
- [ ] Fichiers inutiles exclus (.pyc, __pycache__)
