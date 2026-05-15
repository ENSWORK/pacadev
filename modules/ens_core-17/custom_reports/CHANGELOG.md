# Changelog - Custom Reports

Toutes les modifications notables de ce module seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

---

## [17.0.1.44] - 2026-01-29

### Ajouté

#### Options d'impression - Conditions de paiement
- **Nouvelle option** : "Imprimer avec conditions de paiement" sur les devis, factures et bons de commande
- **Nouveau champ** : `print_with_payment_terms` (Boolean, default=True) sur :
  - `sale.order` : Contrôle l'affichage du "Mode de règlement" dans les devis MEC
  - `account.move` : Contrôle l'affichage des conditions de livraison, paiement et date d'échéance dans les factures MEC
  - `purchase.order` : Contrôle l'affichage des conditions de livraison, paiement et date prévue dans les bons de commande/RFQ MEC

#### Options d'impression - Acheteur/Représentant
- **Nouvelle option** : "Imprimer avec acheteur" sur les bons de commande et demandes de prix
- **Nouveau champ** : `print_with_buyer` (Boolean, default=True) sur `purchase.order`
  - Contrôle l'affichage du bloc Acheteur / Téléphone / E-mail
  - Applicable aux templates MEC (bon de commande + RFQ)

#### Options d'impression - Signature utilisateur
- **Nouvelle option** : "Imprimer avec signature" sur les bons de commande et demandes de prix
- **Nouveau champ** : `print_with_signature` (Boolean, default=False) sur `purchase.order`
  - Affiche la signature de l'utilisateur acheteur (`user_id.signature_image`)
  - Si pas de signature utilisateur, rien ne s'affiche
  - Compatible avec le champ `signature_image` de `res.users`

### Modifié

#### Templates MEC - Gestion des conditions de paiement
- **Fichiers modifiés** :
  - `report/report_sale_mec.xml` : Ajout condition `t-if="o.print_with_payment_terms"` sur les lignes affichant le mode de règlement (style colored + simple)
  - `report/report_invoice_mec.xml` : Section "Conditions de paiement" rendue optionnelle et indépendante du représentant
  - `report/report_purchase_mec.xml` (FR + EN) : Table d'informations acheteur/paiement rendue conditionnelle avec colonnes à largeur adaptative
  - `report/report_rfq_mec.xml` : Table d'informations acheteur/paiement rendue conditionnelle

#### Templates MEC - Gestion des signatures
- **Comportement** : Affichage uniquement de la signature utilisateur (pas de fallback sur tampon société)
- **Fichiers modifiés** :
  - `report/report_purchase_mec.xml` (FR + EN) : Ajout section signature conditionnelle (`print_with_signature and user_id.signature_image`)
  - `report/report_rfq_mec.xml` : Ajout section signature conditionnelle
  - `report/report_sale_mec.xml` : Priorité signature utilisateur (suppression fallback tampon société)
  - `report/report_invoice_mec.xml` : Priorité signature utilisateur (suppression fallback tampon société)

#### Documentation et help texts
- **Modèles Python** :
  - `models/sale_order.py` : Ajout champ `print_with_payment_terms` + help text mis à jour pour `print_with_signature`
  - `models/account_move.py` : Ajout champ `print_with_payment_terms` + help text mis à jour pour `print_with_signature`
  - `models/purchase_order.py` : Ajout champs `print_with_buyer`, `print_with_payment_terms` et `print_with_signature` avec help texts détaillés
  - `models/res_company.py` : Champ `stamp_image` marqué comme "non utilisé actuellement"

- **Vues** :
  - `views/sale_order_views.xml` : Ajout checkbox "Imprimer avec conditions de paiement"
  - `views/account_move_views.xml` : Ajout checkbox "Imprimer avec conditions de paiement"
  - `views/purchase_order_views.xml` : Ajout 3 checkboxes (acheteur, paiement, signature)

### Technique

#### Affichage conditionnel des blocs d'information
- **Achat/RFQ MEC** : Table d'informations affichée seulement si au moins une option est active (`print_with_buyer or print_with_payment_terms`)
- **Facture MEC** : Table d'informations affichée seulement si au moins une option est active (`print_with_representative or print_with_payment_terms`)
- **Largeur adaptative** : Les colonnes s'ajustent automatiquement (50% chacune ou 100% si une seule active)

#### Signature utilisateur uniquement
- **Priorité unique** : Affichage de `user_id.signature_image` uniquement (pas de fallback sur `company_id.stamp_image`)
- **Condition stricte** : `t-if="o.print_with_signature and o.user_id.signature_image"`
- **Applicable à** : Devis, factures, bons de commande, demandes de prix

### Impact

- ✅ **Flexibilité accrue** : Contrôle granulaire de l'affichage des informations de paiement et acheteur
- ✅ **Personnalisation par document** : Chaque document peut avoir ses propres options d'impression
- ✅ **Rétrocompatibilité** : Valeurs par défaut = `True` (comportement actuel maintenu sauf pour signature=`False`)
- ✅ **Simplicité** : Signature utilisateur uniquement, pas de confusion avec tampon société
- ✅ **Cohérence** : Options uniformes sur tous les types de documents MEC

### Cas d'usage

1. **Devis sans conditions de paiement** : Pour des offres sans engagement commercial
2. **Factures sans représentant** : Pour documents automatisés ou comptabilité
3. **Bons de commande minimalistes** : Sans info acheteur pour documents standards
4. **Signature personnalisée** : Chaque utilisateur peut avoir sa propre signature sur les documents

---

### Ajouté (suite)
- **Bon de Retour Vente MEC** : Nouveau template pour les retours clients
  - Fichier : `report/report_return_mec.xml`
  - Structure identique à la réception fournisseur (mêmes colonnes)
  - Informations spécifiques : BL d'origine, commande d'origine
  - Récupération automatique du BL qui a fait le retour via le champ `origin`
  - Colonnes : N°, Référence/Description, Lot/Série, Qté commandée, **Qté retournée**, PU HT
  - Section Visa adaptée : "Service Réception" / "Client"
  - Hérite des options d'impression standard (header, numérotation, visa, prix)
  - Impact : Permet d'imprimer les bons de retour vente avec toutes les informations du BL d'origine
- **Fichiers de désactivation pour les rapports personnalisés** : Création de fichiers XML pour désactiver les rapports individuels (ENS, DB, MEC) pour les factures, ventes et demandes de prix
  - `report_invoice_disable.xml` : Désactive les rapports de facturation individuels
  - `report_sale_disable.xml` : Désactive les rapports de vente individuels
  - `report_rfq_disable.xml` : Désactive les rapports de demande de prix individuels
  - Ces fichiers sont ajoutés au manifeste pour être chargés automatiquement

### Modifié
- **Template DB - Suppression des textes "Émetteur" et "Adressé à"** : Les textes ont été supprimés du tableau d'information client/fournisseur dans le template d'achat DB
  - Fichier affecté : `report/report_purchase_db.xml`
  - Impact : Meilleure sobriété visuelle du template
- **Manifeste du module** : Ajout des nouveaux fichiers de désactivation dans `__manifest__.py`
  - Fichier affecté : `__manifest__.py`
  - Impact : Les fichiers de désactivation sont maintenant chargés avec le module
- **Template DB - Gestion de l'option "Imprimer avec références"** : Correction de la gestion de l'option `print_with_ref` dans les templates DB pour assurer la cohérence avec les autres templates (ENS, MEC)
  - Fichiers affectés : `report/report_sale_db.xml`, `report/report_purchase_db.xml`, `report/report_delivery_db.xml`
  - Impact : L'option "Imprimer avec références" fonctionne maintenant correctement dans tous les templates DB

### Corrigé
- **Système de rapport dynamique** : Correction de l'incohérence entre les rapports actifs et la configuration de template
  - Problème : Certains rapports individuels (factures, ventes, RFQ) restaient visibles dans le menu d'impression malgré la sélection d'un template personnalisé (MEC, DB, ENS)
  - Solution : Désactivation des rapports individuels via les nouveaux fichiers XML
  - Impact : Seuls les rapports dynamiques sont maintenant visibles selon la configuration de template dans la société
  - Comportement : Les rapports natifs d'Odoo ne sont affichés que quand "Odoo" est sélectionné comme template dans la configuration de la société
- **Option "Imprimer avec références" dans les templates DB** : Correction de la non-gestion de l'option `print_with_ref` dans les templates DB pour les devis, bons de commande et bons de livraison
  - Problème : La colonne "Référence" était toujours affichée dans les templates DB, ignorant l'option `print_with_ref`
  - Solution : Ajout des conditions `t-if="o.print_with_ref"` pour afficher/masquer la colonne Référence selon l'option
  - Fichiers corrigés : `report/report_sale_db.xml` (colonnes et cellules), `report/report_purchase_db.xml` (ajout de la colonne Référence), `report/report_delivery_db.xml` (ajout de la colonne Référence)
  - Impact : L'option "Imprimer avec références" est maintenant fonctionnelle dans tous les templates DB

### À venir
- Fonctionnalités prévues pour les prochaines versions

---

## [17.0.1.34] - 2026-01-23

### Corrigé

#### Factures ENS et MEC - Erreur IndexError avec articles de service
- **Problème** : `IndexError: tuple index out of range` lors de l'impression de factures contenant des articles de type service
- **Cause** : Les articles de service ne génèrent pas de mouvements de stock (`move_ids` vide), l'accès direct à `move_ids[0]` échouait
- **Solution** : Remplacement de la vérification simple par une itération robuste sur toutes les lignes de commande

**Fichiers corrigés** :
- `report/report_invoice_ens.xml` (ligne 222-226) : Boucle `t-foreach` sur `sale_line_ids` avec vérification `move_ids`
- `report/report_invoice_mec.xml` (ligne 226-230) : Boucle `t-foreach` sur `sale_line_ids` avec vérification `move_ids`

**Amélioration** :
- **Avant** : Affichait uniquement le 1er N° BL → perte d'information si plusieurs commandes
- **Après** : Affiche **tous les N° BL** séparés par virgule (ex: "BL001, BL002")
- Gestion robuste : Articles service n'affichent rien (pas d'erreur)
- Gestion multi-commandes : Tous les BL sont affichés

**Technique** :
```xml
<!-- AVANT (version 17.0.1.33) -->
<t t-if="line.sale_line_ids and line.sale_line_ids[0].move_ids">
    <span t-field="line.sale_line_ids[0].move_ids[0].picking_id.name"/>
</t>

<!-- APRÈS (version 17.0.1.34) -->
<t t-foreach="line.sale_line_ids" t-as="sol">
    <t t-if="sol.move_ids">
        <span t-field="sol.move_ids[0].picking_id.name"/>
        <t t-if="not sol_last">, </t>
    </t>
</t>
```

### Impact
- ✅ Factures avec articles **stockables** : affichent tous les N° BL (plusieurs si multi-commandes)
- ✅ Factures avec articles **service** : aucune erreur, colonne N° BL vide
- ✅ Factures **mixtes** (stockables + services) : fonctionnent correctement
- ✅ Pas de breaking change : comportement amélioré et plus robuste

---

## [17.0.1.27] - 2026-01-12

### Corrigé

#### Options d'impression non fonctionnelles dans tous les templates
- **Problème** : Les options d'impression ("Imprimer avec en-tête", "Imprimer avec N°", "Imprimer avec signature") configurées dans l'interface ne fonctionnaient pas correctement dans la plupart des templates
- **Cause** : Implémentation incomplète des conditions `t-if` dans les templates XML pour respecter les champs Python définis dans les modèles
- **Solution** : Ajout systématique des conditions manquantes dans tous les templates ENS et MEC

#### Option "Imprimer avec en-tête" (`print_with_header`)
- **Fichiers corrigés** :
  - `report/report_invoice_ens.xml` : Ajout conditions sur header/footer
  - `report/report_invoice_mec.xml` : Ajout conditions sur header/footer
  - `report/report_sale_ens.xml` : Ajout conditions sur header/footer
  - `report/report_sale_mec.xml` : Ajout conditions sur header/footer
  - `report/report_delivery_ens.xml` : Ajout conditions sur header/footer
  - `report/report_delivery_mec.xml` : Ajout conditions sur header/footer
  - `report/report_purchase_ens.xml` : Ajout conditions sur header/footer
  - `report/report_purchase_mec.xml` : Ajout conditions sur header/footer
- **Impact** : L'option fonctionne maintenant dans TOUS les templates (ENS, MEC, DB) sur tous les types de documents

#### Option "Imprimer avec N°" (`print_with_line_number`)
- **Fichiers corrigés** :
  - `report/report_invoice_ens.xml` : Ajout colonne N° conditionnelle dans le tableau des lignes
  - `report/report_invoice_mec.xml` : Ajout colonne N° conditionnelle dans le tableau des lignes
- **Impact** : La colonne N° apparaît/disparaît selon l'option dans les factures ENS et MEC (déjà fonctionnel dans les devis)

#### Option "Imprimer avec signature" (`print_with_signature`)
- **Fichiers corrigés** :
  - `report/report_invoice_ens.xml` : Ajout section signature avec support tampon société + signature utilisateur
  - `report/report_sale_ens.xml` : Ajout section signature avec support tampon société + signature utilisateur
  - `report/report_sale_mec.xml` : Correction logique signature (condition `t-if` + support tampon société)
- **Amélioration** : Support du tampon de société (`company_id.stamp_image`) prioritaire sur la signature utilisateur
- **Impact** : L'option fonctionne maintenant dans les factures ENS et les devis ENS/MEC (déjà fonctionnel dans factures MEC/DB)

### Résumé de la couverture fonctionnelle

| Template | Document | print_with_header | print_with_line_number | print_with_signature |
|----------|----------|-------------------|------------------------|---------------------|
| **ENS**  | Factures | ✅ Corrigé | ✅ Corrigé | ✅ Corrigé |
| **ENS**  | Devis    | ✅ Corrigé | ✅ Déjà OK | ✅ Corrigé |
| **ENS**  | Livraisons | ✅ Corrigé | N/A | N/A |
| **ENS**  | Achats   | ✅ Corrigé | N/A | N/A |
| **MEC**  | Factures | ✅ Corrigé | ✅ Corrigé | ✅ Déjà OK |
| **MEC**  | Devis    | ✅ Corrigé | ✅ Déjà OK | ✅ Corrigé |
| **MEC**  | Livraisons | ✅ Corrigé | ✅ Déjà OK | N/A |
| **MEC**  | Achats   | ✅ Corrigé | N/A | N/A |
| **DB**   | Tous     | ✅ Déjà OK | ✅ Déjà OK (devis) | ✅ Déjà OK (factures/devis) |

### Impact global
- ✅ **9 fichiers modifiés** : Correction systématique dans tous les templates ENS et MEC
- ✅ **100% des options fonctionnelles** : Toutes les options d'impression respectent maintenant les paramètres utilisateur
- ✅ **Cohérence totale** : Comportement uniforme entre tous les templates (ENS, MEC, DB)
- ✅ **Aucune breaking change** : Les valeurs par défaut assurent la rétrocompatibilité

### Notes techniques
- Condition header/footer : `<t t-if="o.print_with_header">...</t>` appliquée aux layouts
- Condition colonne N° : `<th t-if="o.print_with_line_number">...</th>` dans les tableaux
- Condition signature : `<t t-if="o.print_with_signature">...</t>` avec support tampon société prioritaire
- Format numérotation : `<span t-esc="line_index + 1"/>` pour les factures (index dynamique)

---

## [17.0.1.26] - 2026-01-08

### Modifié
- **Correction du champ ICE dans tous les templates** : Remplacement de `partner_id.vat` par `partner_id.ice` dans tous les templates (ENS, MEC, DB) pour utiliser la bonne source du module "identifiants fiscaux marocains"
  - Fichiers affectés : `report_invoice_ens.xml`, `report_invoice_mec.xml`, `report_sale_ens.xml`, `report_sale_ens_without_ref.xml`, `report_delivery_ens.xml`
  - Impact : Les rapports utiliseront maintenant le champ ICE correct provenant du module d'identifiants fiscaux

### Changé
- **Généricisation du terme "Mecafric"** : Remplacement de toutes les occurrences de "Mecafric" par "Template MEC" dans les fichiers du module pour une meilleure universalité
  - Fichiers affectés : `README.md`, `report/*.xml`, `views/res_company_views.xml`, `models/res_company.py`, `CHANGELOG.md`
  - Interface : Les labels dans les paramètres de la société ont été mis à jour
  - Documentation : Mise à jour de la documentation interne et des commentaires

---

## [17.0.1.25] - Date de la version précédente

### Divers
- Version intermédiaire avec correctifs mineurs

---

## [17.0.1.24] - 2026-01-08

### Ajouté

#### Configuration unifiée de la taille du logo (SIMPLIFIÉ)
- **2 nouveaux champs configurables** dans `res.company` pour gérer la taille du logo :
  - `logo_height` (Integer, default=85) : Hauteur du logo (appliquée partout)
  - `logo_width` (Integer, default=350) : Largeur du logo (appliquée partout)

- **Nouvelle section UI** : "Configuration du logo" dans Paramètres > Sociétés
  - **Interface ultra-simple** : 1 seul groupe avec 2 champs
  - **Appliqué universellement** : Tous les templates (ENS, DB, MEC) utilisent la même taille
  - Help texts détaillés
  - Rappel de vider le cache après modification

### Philosophie de la simplification
- **Avant** : 6 champs (3 templates × 2 dimensions) = complexe et inutile
- **Après** : 2 champs seulement = simple et efficace
- **Pourquoi** : 99% des utilisateurs veulent juste "changer la taille du logo", pas gérer 3 configurations différentes

### Modifié

#### Uniformisation des tailles de logo template DB
- **Taille uniformisée** : Tous les documents DB utilisent maintenant 120px × 400px
- **Fichiers modifiés** :
  - `report/report_invoice_db.xml` : 85px × 350px → 120px × 400px
  - `report/report_delivery_db.xml` : 140px × 450px → 120px × 400px
  - `report/report_rfq_db.xml` : 140px × 450px → 120px × 400px
  - `report/report_purchase_db.xml` : 85px × 350px → 120px × 400px

#### Templates dynamiques - 14 fichiers convertis
- **Conversion** : Remplacement des styles hardcodés par des valeurs dynamiques
- **Syntaxe** : `style="max-height: 85px"` → `t-attf-style="max-height: #{o.company_id.logo_height_ens}px"`

**Templates ENS (6 fichiers)** :
- `report/report_sale_ens.xml`
- `report/report_sale_ens_without_ref.xml`
- `report/report_invoice_ens.xml`
- `report/report_delivery_ens.xml`
- `report/report_rfq_ens.xml`
- `report/report_purchase_ens.xml`

**Templates DB (5 fichiers)** :
- `report/report_sale_db.xml`
- `report/report_invoice_db.xml`
- `report/report_delivery_db.xml`
- `report/report_rfq_db.xml`
- `report/report_purchase_db.xml`

**Templates MEC (5 fichiers)** :
- `report/report_sale_mec.xml` (mode logo)
- `report/report_invoice_mec.xml` (mode logo)
- `report/report_delivery_mec.xml`
- `report/report_rfq_mec.xml`
- `report/report_purchase_mec.xml`

#### Documentation
- **README.md** : Nouvelle section "Configuration des tailles de logos" avec exemples et avantages
- **3 documents d'analyse** créés dans `/docs` :
  - `analyse-logos-custom-reports.md` : Analyse complète de la configuration actuelle
  - `solution-centralisation-logos.md` : Conception détaillée de la solution
  - `briefing-logo-centralization.txt` : Briefing de la mission Plane

### Technique

#### Avantages de la solution
- ✅ **Centralisation** : Modification en 1 seul endroit au lieu de 14 fichiers XML
- ✅ **Flexibilité** : Modifiable via l'interface Odoo sans toucher au code
- ✅ **Multi-sociétés** : Personnalisable par société
- ✅ **Rétrocompatibilité** : Valeurs par défaut = tailles actuelles les plus utilisées

#### Uniformisation template DB
- **Avant** : 3 tailles différentes (85px, 120px, 140px) selon le type de document
- **Après** : 1 seule taille (120px × 400px) pour tous les documents DB
- **Justification** : Taille moyenne, compromis optimal, cohérence visuelle

#### Valeurs par défaut
- Template ENS : 85px × 350px (taille la plus utilisée - 8/14 fichiers)
- Template DB : 120px × 400px (compromis entre 85px, 120px et 140px)
- Template MEC : 60px × 250px (taille actuelle mode logo)

### Impact

- ✅ 14 fichiers de templates convertis en tailles dynamiques
- ✅ Configuration utilisateur centralisée et intuitive
- ✅ Cohérence visuelle améliorée (template DB uniformisé)
- ✅ Maintenabilité accrue (modification centralisée)
- ✅ Aucune breaking change (valeurs par défaut = comportement actuel)
- ✅ Personnalisation par société (multi-entreprises)

### Notes importantes

**Après upgrade** :
1. Vider le cache Odoo : `env['ir.ui.view'].clear_caches()`
2. Régénérer les PDFs pour voir les changements
3. Les valeurs par défaut s'appliquent automatiquement

**Limitation** :
- Les champs `logo_height_mec` / `logo_width_mec` n'affectent que le mode "Logo normal"
- Le mode "Image pleine largeur" utilise toujours `header_image_mec` avec taille fixe

---

## [17.0.1.19] - 2026-01-01

### Corrigé

#### Bug double page dans les demandes de prix (RFQ)
- **Fichier corrigé** : `report/report_rfq_db.xml`
- **Problème** : Le template `report_rfq_db_document` appelait `report_rfq_db` qui contenait une boucle `t-foreach="docs"`. Combiné avec la boucle du rapport dynamique, cela générait des pages en double.
- **Solution** : Déplacé le contenu directement dans `report_rfq_db_document` sans la boucle `t-foreach="docs"`.
- **Impact** : Les demandes de prix (RFQ) s'impriment maintenant correctement avec **1 seule page** par document.

---

## [17.0.1.18] - 2026-01-01

### Ajouté

#### Nouveau document : Demande de Prix (RFQ)
- **3 nouveaux templates RFQ** :
  - `report/report_rfq_ens.xml` : Template ENS épuré
  - `report/report_rfq_db.xml` : Template DB professionnel
  - `report/report_rfq_mec.xml` : Template MEC personnalisable

- **Nouveau rapport dynamique** : `report/report_rfq_dynamic.xml`
  - Routing automatique selon `company_id.print_template` (ENS/DB/MEC/Odoo)
  - Support option avec/sans header
  - Gestion options d'affichage (références, numérotation, date prévue)

- **Nouveau champ** : `print_with_expected_date` dans `models/purchase_order.py`
  - Afficher/masquer la colonne "Date prévue" dans les demandes de prix
  - Default: True (activé par défaut)

- **Vue mise à jour** : `views/purchase_order_views.xml`
  - Ajout du champ `print_with_expected_date` dans l'onglet "Options d'impression"

### Différences avec les bons de commande

| Élément | Bon de commande | Demande de prix |
|---------|-----------------|-----------------|
| Titre | "BON DE COMMANDE" | "DEMANDE DE PRIX" |
| Colonnes prix | ✅ Oui (PU, TVA, Total) | ❌ Non (pas de prix) |
| Colonnes affichées | N°, Ref, Description, Qté | N°, Ref, Description, Date prévue, Qté |
| Section totaux | ✅ Oui | ❌ Non |
| Usage | Commande confirmée | Appel d'offres fournisseur |

### Impact
- ✅ 2 rapports disponibles pour les achats : "Bon de commande" + "Demande de prix"
- ✅ Templates cohérents avec les devis/factures/BL (ENS, DB, MEC)
- ✅ Système dynamique unifié sur tous les documents
- ✅ Option "Date prévue" configurable pour les RFQ

---

## [17.0.1.17] - 2026-01-01

### Ajouté

#### Système de rapports dynamiques pour les achats
- **Nouveau modèle** : `models/purchase_order.py`
  - Champ `print_with_ref` : Afficher/masquer les références produit
  - Champ `print_with_header` : Afficher/masquer l'en-tête personnalisé
  - Champ `print_with_line_number` : Afficher/masquer la numérotation des lignes

- **Nouveau rapport dynamique** : `report/report_purchase_dynamic.xml`
  - Routing automatique selon `company_id.print_template` (ENS/DB/MEC/Odoo)
  - Support des 3 templates personnalisés existants
  - Option d'impression sans header/footer

- **Nouvelle vue** : `views/purchase_order_views.xml`
  - Onglet "Options d'impression" dans le formulaire de bon de commande
  - Configuration des options d'affichage par document

### Modifié

#### Rapports d'achat - Désactivation des rapports individuels
- Les rapports `action_report_purchase_order_ens`, `action_report_purchase_order_mec` et `action_report_purchase_db` ne sont plus directement accessibles
- Ils sont maintenant appelés automatiquement par le rapport dynamique selon la configuration

### Impact
- ✅ Cohérence avec les devis, factures et bons de livraison (tous utilisent le système dynamique)
- ✅ Configuration simplifiée : choix du template au niveau société + options par document
- ✅ Flexibilité accrue : possibilité d'imprimer sans header ou sans références selon les besoins
- ✅ Un seul bouton "Bon de commande" dans le menu Imprimer (au lieu de 3-4 boutons)

---

## [17.0.1.16] - 2025-12-30

### Modifié

#### Templates dynamiques - Noms simplifiés dans le menu Imprimer
- **`report_sale_dynamic.xml`** : "Devis EnSwOrK" → "Devis"
- **`report_delivery_dynamic.xml`** : "Bon de Livraison EnSwOrK" → "Bon de livraison"
- **`report_invoice_dynamic.xml`** : "Facture EnSwOrK" → "Facture"

#### Templates DB - Logo agrandi pour meilleure visibilité
- **Taille du logo** : 85px × 350px → **120px × 400px**
- **Templates modifiés** :
  - `report_sale_db.xml` (Devis DB)
  - `report_invoice_db.xml` (Facture DB)
  - `report_delivery_db.xml` (BL DB)
  - `report_purchase_db.xml` (Bon de commande DB)

### Impact
- ✅ Menu "Imprimer" plus clair : "Devis", "Facture", "Bon de livraison" au lieu de "... EnSwOrK"
- ✅ Logo DB plus visible et mieux proportionné (augmentation de 41%)
- ✅ Meilleure présentation professionnelle des documents DB

---

## [17.0.1.15] - 2025-12-30

### Ajouté

#### BL DB - Affichage des prix (version finale)
- **Nouvelles colonnes** : Prix unitaire HT et Total HT dans le tableau des lignes
- **Récupération automatique** : Les prix sont récupérés depuis la commande de vente liée (`sale_id`)

### Modifié

#### Fichiers modifiés
- **`report/report_delivery_db.xml`** (lignes 152-224) :
  - Ajout colonne "Prix unitaire HT" (ligne 158)
  - Ajout colonne "Total HT" (ligne 159)
  - Affichage `line.sale_line_id.price_unit` pour le prix unitaire (lignes 186-196)
  - Affichage `line.sale_line_id.price_subtotal` pour le total ligne
  - Mise à jour lignes vides pour inclure 2 colonnes supplémentaires (lignes 215-221)

### Technique
- Utilise `line.sale_line_id` pour accéder aux prix de la commande de vente
- Affiche "-" si aucune commande de vente liée (cas des livraisons manuelles)
- Format standard Odoo avec `t-field` pour affichage automatique de la devise
- **PAS de section totaux** : affichage uniquement dans les lignes du tableau

### Impact
- ✅ BL DB affiche les prix unitaires et totaux par ligne
- ✅ Design épuré sans totaux récapitulatifs en bas
- ✅ Gestion automatique des cas sans commande de vente (affiche "-")
- ⚠️ Nécessite une commande de vente liée pour afficher les prix

---

## [17.0.1.14] - 2025-12-30

### Ajouté

#### BL DB - Affichage des prix
- **Nouvelles colonnes** : Prix unitaire HT et Total HT dans le tableau des lignes
- **Section totaux** : Affichage Total HT, TVA et Total TTC en bas du BL
- **Récupération automatique** : Les prix sont récupérés depuis la commande de vente liée (`sale_id`)

### Modifié

#### Fichiers modifiés
- **`report/report_delivery_db.xml`** (lignes 151-274) :
  - Ajout colonne "Prix unitaire HT" (ligne 158)
  - Ajout colonne "Total HT" (ligne 159)
  - Affichage `line.sale_line_id.price_unit` pour le prix unitaire (lignes 187-194)
  - Affichage `line.sale_line_id.price_subtotal` pour le total ligne (lignes 197-204)
  - Ajout section `<tfoot>` avec totaux HT, TVA et TTC (lignes 232-273)
  - Mise à jour lignes vides pour inclure 2 colonnes supplémentaires (lignes 223-227)

### Technique
- Utilise `line.sale_line_id` pour accéder aux prix de la commande de vente
- Affiche "-" si aucune commande de vente liée (cas des livraisons manuelles)
- Format monétaire avec `t-options='{"widget": "monetary", "display_currency": o.sale_id.currency_id}'`
- Totaux récupérés depuis `o.sale_id.amount_untaxed`, `amount_tax` et `amount_total`

### Impact
- ✅ BL DB affiche maintenant les prix comme les autres templates
- ✅ Cohérence avec les devis et factures DB
- ✅ Gestion automatique des cas sans commande de vente (affiche "-")
- ⚠️ Nécessite une commande de vente liée pour afficher les prix

---

## [17.0.1.13] - 2025-12-30

### Ajouté

#### Facture DB - Options d'impression Marque et Origine
- **Nouvelles options** : Afficher/masquer Marque et Origine dans les lignes de facture
- **Nouveau champ** : `print_with_brand` (Boolean, default=True) sur `account.move`
- **Nouveau champ** : `print_with_origin` (Boolean, default=True) sur `account.move`
- **Applicable** : Template DB uniquement

### Modifié

#### Fichiers modifiés
- **`models/account_move.py`** (lignes 47-58) :
  - Ajout champ `print_with_brand` : Afficher la marque du produit
  - Ajout champ `print_with_origin` : Afficher l'origine (pays) du produit

- **`views/account_move_views.xml`** (lignes 18-21) :
  - Nouveau groupe "Détails produit (Template DB)"
  - 2 cases à cocher : Marque et Origine

- **`report/report_invoice_db.xml`** (lignes 174-179) :
  - Ligne Marque conditionnelle : `<t t-if="o.print_with_brand">`
  - Ligne Origine conditionnelle : `<t t-if="o.print_with_origin">`

### Technique
- Par défaut, Marque et Origine sont affichées (default=True)
- Permet de simplifier les factures en masquant ces informations si non nécessaires
- Cohérence avec les autres options d'impression (ref, header, line_number)

### Impact
- ✅ Nouvelles options disponibles dans onglet "Options d'impression" des factures
- ✅ Flexibilité accrue pour personnaliser l'affichage
- ✅ Rétrocompatible : affichage par défaut (default=True)
- ✅ Applicable uniquement au template DB

---

## [17.0.1.12] - 2025-12-30

### Modifié

#### Uniformisation des templates DB - Tailles de police cohérentes
- **Objectif** : Harmoniser les tailles de police sur tous les templates DB (Devis, BL, Facture, Bon de commande)
- **Standards appliqués** :
  - Tableau lignes : **13px** (au lieu de 12px/14px)
  - Pagination : **11px** (au lieu de 9px)
  - Header détails : **14px** (cohérent)
  - Titre document : **18px** (cohérent)

### Fichiers modifiés

#### report/report_invoice_db.xml
- Ligne 156 : Tableau principal `12px` → `13px`
- Ligne 226 : Conditions règlement `12px` → `13px`
- Ligne 238 : Totaux `12px` → `13px`
- Ligne 263 : Montant en lettres `12px` → `13px`
- Ligne 45 : Pagination `9px` → `11px`

#### report/report_sale_db.xml
- Ligne 163 : Tableau principal `14px` → `13px`
- Ligne 280 : Tableau totaux `14px` → `13px`
- Ligne 52 : Pagination `9px` → `11px`

#### report/report_delivery_db.xml
- Ligne 151 : Tableau principal `14px` → `13px`
- Ligne 45 : Pagination `9px` → `11px`

#### report/report_purchase_db.xml
- Ligne 127 : Tableau principal - ajout `font-size: 13px`
- Lignes 13-19 : Header - suppression `font-size: 18px` excessif sur Date et Code fournisseur
- Lignes 88-103 : Émetteur - suppression tous les `font-size: 18px`
- Correction : `doc.company_id` → `o.company_id` (cohérence)
- Ligne 46 : Pagination `9px` → `11px`

### Technique
- Uniformisation complète des 4 templates DB
- Cohérence visuelle améliorée entre tous les documents
- Meilleure lisibilité avec tailles de police standardisées

### Impact
- ✅ Tous les templates DB utilisent désormais les mêmes standards
- ✅ Pagination plus lisible (11px au lieu de 9px)
- ✅ Tableaux harmonisés à 13px
- ✅ Bon de commande corrigé (plus de font-size 18px excessif)
- ✅ Pas de breaking change fonctionnel

---

## [17.0.1.11] - 2025-12-30

### Corrigé

#### Facture DB - Nom de template incorrect pour le rapport dynamique
- **Problème** : `ValueError: External ID not found in the system: custom_reports.external_layout_invoice_db`
- **Cause** : Le template était nommé `external_layout_invoice` au lieu de `external_layout_invoice_db`
- **Solution** : Renommage du template pour correspondre à ce que le rapport dynamique attend

### Modifié

#### Fichiers corrigés
- **`report/report_invoice_db.xml`** :
  - Ligne 53 : `external_layout_invoice` → `external_layout_invoice_db`
  - Ligne 290 : Appel du template mis à jour

### Technique
- Cohérence de nommage avec les autres templates (ENS, MEC ont `_ens`, `_mec`)
- Le rapport dynamique cherche spécifiquement `external_layout_invoice_db`

### Impact
- ✅ Rapport dynamique fonctionne avec template DB
- ✅ Nommage cohérent avec les autres templates
- ✅ Pas de breaking change

---

## [17.0.1.10] - 2025-12-30

### Corrigé

#### Vue res_company - Syntaxe Odoo 17 pour attribut invisible
- **Problème** : `ParseError: Depuis 17.0, les attributs "attrs" et "states" ne sont plus utilisés`
- **Cause** : Utilisation de l'ancienne syntaxe `attrs={'invisible': [...]}` incompatible avec Odoo 17
- **Solution** : Remplacement par la nouvelle syntaxe Odoo 17 : `invisible="expression"`

### Modifié

#### Fichiers corrigés
- **`views/res_company_views.xml`** (ligne 42) :
  - ❌ Avant : `attrs="{'invisible': [('invoice_mec_header_type', '!=', 'image')]}"`
  - ✅ Après : `invisible="invoice_mec_header_type != 'image'"`

### Technique
- Migration vers syntaxe Odoo 17 pour les attributs conditionnels
- Compatibilité totale avec Odoo 17.0+
- Plus besoin de la syntaxe domain-like avec listes

### Impact
- ✅ Module s'installe/upgrade sans erreur de parsing XML
- ✅ Visibilité conditionnelle fonctionne correctement
- ✅ Pas de breaking change fonctionnel

---

## [17.0.1.9] - 2025-12-30

### Corrigé

#### Facture DB - Erreur template manquant lors de l'impression dynamique
- **Problème** : `ValueError: External ID not found in the system: custom_reports.report_invoice_db_document`
- **Cause** : Le template `report_invoice_db_document` n'existait pas dans `report_invoice_db.xml`
- **Solution** : Séparation du template en deux parties comme pour le bon de livraison DB :
  1. `report_invoice_db_document` : Contenu du document (lignes 62-283)
  2. `report_invoice_db` : Wrapper qui appelle le document (lignes 285-295)

### Modifié

#### Fichiers corrigés
- **`report/report_invoice_db.xml`** :
  - Création du template `report_invoice_db_document` (contenu du document)
  - Refactorisation du template `report_invoice_db` (wrapper)
  - Correction des références `doc.` → `o.` pour cohérence
  - Suppression du mot "custom" orphelin (ligne 65)
  - Correction des références dans le header (lignes 14-15)

### Technique
- Structure identique au bon de livraison DB (même problème corrigé en v17.0.1.6)
- Le rapport dynamique peut maintenant appeler correctement `report_invoice_db_document`
- Toutes les références de variables uniformisées sur `o` au lieu du mélange `o`/`doc`

### Impact
- ✅ Impression facture DB via rapport dynamique fonctionne
- ✅ Impression facture DB directe fonctionne
- ✅ Pas de breaking change
- ✅ Cohérence avec les autres templates DB

---

## [17.0.1.8] - 2025-12-30

### Ajouté

#### Facture MEC - Header personnalisable avec image dédiée
- **Nouvelle option** : Choix du type d'en-tête pour les factures MEC
- **Nouveau champ** : `invoice_mec_header_type` (Selection) sur `res.company`
  - "Logo normal" : Utilise le logo de la société (par défaut)
  - "Image pleine largeur" : Utilise une image personnalisée
- **Nouveau champ** : `header_image_invoice_mec` (Binary) sur `res.company`
  - Image d'en-tête spécifique aux factures (format PNG/JPG, largeur min 800px)
  - Visible uniquement si `invoice_mec_header_type = 'image'`

### Modifié

#### Templates et vues
- **`report/report_invoice_mec.xml`** :
  - Template `external_layout_header_invoice_mec` refactorisé
  - Ajout de conditions pour afficher soit l'image pleine largeur, soit le logo
  - Style harmonisé avec le template devis MEC (max-height: 40mm)
- **`views/res_company_views.xml`** :
  - Nouvelle section "Images Template MEC - Factures"
  - Champ `header_image_invoice_mec` visible conditionnellement
  - Séparation visuelle entre configuration devis et factures

### Technique
- Système identique au template devis MEC mais avec champs dédiés
- Permet d'avoir des en-têtes différents pour devis vs factures
- Compatibilité : Logo normal utilisé par défaut (pas de breaking change)
- Format image : PNG/JPG, largeur min 800px, max-height 40mm

### Bénéfices
- ✅ Headers différenciés : Image spécifique pour factures distincte des devis
- ✅ Flexibilité : Choix entre logo simple ou image corporate complète
- ✅ Branding amélioré : Permet d'avoir une charte graphique différente pour factures
- ✅ Rétrocompatibilité : Comportement par défaut inchangé (logo normal)

---

## [17.0.1.7] - 2025-12-29

### Ajouté

#### Bon de livraison MEC - Option Prix Unitaire
- **Nouvelle option** : "Imprimer avec prix" dans l'onglet "Options d'impression"
- **Colonne conditionnelle** : Affichage du Prix Unitaire HT dans le tableau des lignes
- **Source des prix** : Récupération depuis la commande de vente liée (`sale_id.order_line`)
- **Format** : Prix affiché avec 2 décimales, sans devise
- **Default** : Désactivé par défaut (`default=False`)

### Fichiers modifiés
- `models/stock_picking.py` : Ajout champ `print_with_price` (Boolean)
- `views/stock_picking_views.xml` : Ajout checkbox "Imprimer avec prix"
- `report/report_delivery_mec.xml` :
  - Colonne `<th t-if="o.print_with_price">PU HT</th>` (ligne 169)
  - Cellule avec récupération prix depuis `sale_id.order_line` (lignes 209-216)

### Technique
- Filtre intelligent : `o.sale_id.order_line.filtered(lambda l: l.product_id == move.product_id)[:1]`
- Gère les cas sans commande de vente liée (affichage vide)
- Format prix : `'{:.2f}'.format(sale_line.price_unit)`
- Alignement : texte à droite pour cohérence avec les colonnes prix

---

## [17.0.1.6] - 2025-12-29

### Modifié

#### Bon de livraison MEC - Fusion colonnes Référence et Description
- **Changement** : Fusion des colonnes "Référence" et "Description" en une seule colonne "Référence / Description d'article"
- **Format** : Identique au devis MEC - référence affichée en gras, suivie de la description en dessous
- **Fichier modifié** : `report/report_delivery_mec.xml` lignes 164-191
- **Bénéfices** :
  - Cohérence visuelle avec les devis MEC
  - Meilleure utilisation de l'espace
  - Affichage plus clair et professionnel

### Technique
- Suppression de la colonne conditionnelle `t-if="o.print_with_ref"`
- Fusion en une seule colonne avec logique conditionnelle :
  - Si référence existe : affichage en gras + description en dessous
  - Sinon : affichage de la description uniquement
- Taille de police harmonisée à 13px pour cohérence avec le devis

---

## [17.0.1.5] - 2025-12-27

### Corrigé

#### Bon de livraison MEC - Options d'impression non fonctionnelles
- **Problème** : Les options "Imprimer avec références" et "Imprimer avec N°" ne fonctionnaient pas correctement
- **Cause** : Colonne Description avec largeur fixe (47%) qui ne s'adaptait pas quand les colonnes conditionnelles étaient masquées
- **Fichier corrigé** : `report/report_delivery_mec.xml` ligne 166
- **Changement** : Suppression de `width: 47%` sur la colonne Description pour la rendre responsive
- **Résultat** : La colonne Description s'adapte automatiquement et remplit l'espace disponible

### Notes techniques
- Les conditions `t-if="o.print_with_ref"` et `t-if="o.print_with_line_number"` fonctionnent correctement
- Cache Odoo vidé via incrément de version + upgrade + restart
- Testé sur environnement template_mec_v17

---

## [17.0.1.6] - 2025-12-19

### Corrigé

#### Erreur RPC lors de l'impression du bon de livraison dynamique
- **Erreur** : `ValueError: External ID not found in the system: custom_reports.external_layout_delivery_db`
- **Cause** : Références incorrectes aux variables de template et nom de template inexistant

**Fichier `report/report_delivery_db.xml`** :
- Ligne 15-16 : Corrigé `doc.company_id.primary_color` → `o.company_id.primary_color` dans le header
- Ligne 86, 88 : Corrigé `doc.company_id.country_id` → `o.company_id.country_id` dans la section émetteur
- Ligne 228 : Corrigé référence circulaire `o.with_context(lang=doc.partner_id.lang)` → `o.with_context(lang=o.partner_id.lang)`
- Ligne 221 : Ajout de la balise fermante `</div>` manquante pour la structure HTML

**Fichier `report/report_delivery_dynamic.xml`** :
- Ligne 25 : Corrigé nom du template `custom_reports.external_layout_delivery_db` → `custom_reports.external_layout_delivery`
- Le template correct est `external_layout_delivery` (sans suffixe `_db`)

### Notes techniques

#### Impact
- ✅ Impression du rapport "Bon de Livraison EnSwOrK" (dynamique) fonctionne correctement
- ✅ Impression du rapport "Bon de livraison DB" (direct) fonctionne correctement
- ✅ Tous les templates XML validés (26 fichiers)
- ✅ Redémarrage du serveur Odoo requis pour charger les nouveaux templates

#### Validation
- Tests effectués sur bon de livraison BL250995 (client NT2E)
- PDF généré : 77.6 KB (79439 bytes)
- Templates vérifiés : `external_layout_delivery`, `report_delivery_db_document`, `report_delivery_dynamic`

#### Rétrocompatibilité
- Aucune breaking change
- Comportement identique après corrections
- Pas de migration requise

---

## [17.0.1.5] - 2025-12-19

### Ajouté

#### Fonctionnalité principale
- Option d'impression "Imprimer avec Visa" sur les bons de livraison
- Permet d'afficher/masquer la section "Visa Service / Client" dynamiquement
- Option compatible avec tous les templates (ENS, DB, MEC)
- Nouveau champ `print_with_visa` (Boolean) sur `stock.picking`

#### Code modifié

**models/stock_picking.py**
- Champ `print_with_visa` ajouté (Boolean, default=True)
- Help: "Afficher la section 'Visa Service / Client' à la fin du bon de livraison. Décocher pour masquer les zones de signature."

**views/stock_picking_views.xml**
- Ajout du champ `print_with_visa` dans l'onglet "Options d'impression"
- Groupe "Affichage" : 4 cases à cocher (header, ref, line_number, visa)

**report/report_delivery_ens.xml**
- Section Visa wrappée avec condition: `<t t-if="o.print_with_visa">...</t>`
- La section reste visible par défaut (default=True)

**report/report_delivery_db.xml**
- Section Visa wrappée avec condition: `<t t-if="o.print_with_visa">...</t>`
- Correction XML: Balises `</div>` manquantes ajoutées (ligne 227)

**report/report_delivery_mec.xml**
- Section Visa wrappée avec condition: `<t t-if="o.print_with_visa">...</t>`
- La section reste visible par défaut (default=True)

**__manifest__.py**
- Version incrémentée: 17.0.1.4 → 17.0.1.5

**README.md**
- Section "Options spécifiques au bon de livraison" ajoutée
- Documentation du champ "Imprimer avec Visa"
- Cas d'usage #4 : "Bons de livraison sans zones de signature"
- Exemple d'utilisation pour transferts internes et documents archivés

### Modifié

#### Code
- XML structure: Balises `</div>` corrigées dans `report_delivery_db.xml` (ligne 227)
- Trois templates rapport reçoivent condition conditionnelle sur section Visa

#### Documentation
- README.md enrichi avec nouvelle section fonctionnalité
- CHANGELOG.md trace complète des modifications (ce fichier)

### Corrigé

#### Erreur XML et template manquant
- ✅ XML invalide dans report_delivery_db.xml: mismatched tag (ligne 227) - CORRIGÉ
- Balise manquante `</div>` ajoutée pour fermer correctement la structure
- ✅ Template `report_delivery_db_document` manquant - CRÉÉ
- Séparation du template en `report_delivery_db_document` (contenu) et `report_delivery_db` (conteneur)
- Permet au rapport dynamique d'appeler correctement le template
- Fichier validé avec python3 xml.dom.minidom

### Supprimé
- N/A

### Notes techniques

#### Rétrocompatibilité
- default=True assure comportement inchangé (Visa toujours affichée par défaut)
- Aucune breaking change
- Utilisateurs existants non impactés

#### Migration base de données
- Aucune migration requise
- Champ Boolean ajouté automatiquement au stockage (default=True)

#### Validation
- ✅ Syntaxe Python validée
- ✅ Syntaxe XML validée (tous les 18 templates)
- ✅ Manifest validé
- ✅ Tous les fichiers du module validés

#### Structure finale
- 8 fichiers essentiels modifiés/mis à jour
- Code production-ready
- Documentation à jour
- Module v17.0.1.5 prêt au déploiement

---

## [17.0.1.4] - 2025-12-18

### Ajouté
- Documentation complète du module (README.md)
- Docstrings Python sur tous les modèles
- Help détaillés sur tous les champs
- Standards de documentation

### Modifié
- N/A

### Corrigé
- N/A

### Supprimé
- N/A

---

## [17.0.1.3] - Date précédente

### Ajouté
- Template MEC (Template MEC) avec images personnalisables
- Options de configuration avancées pour MEC
- Champ `mec_header_type` pour choisir entre logo/image
- Champ `mec_header_style` pour style coloré ou simple

### Modifié
- Amélioration de la gestion des couleurs
- Optimisation du rapport dynamique

---

## [17.0.1.2] - Date précédente

### Ajouté
- Options d'impression au niveau du document
- Champs `print_with_ref`, `print_with_header`, `print_with_line_number`
- Numérotation automatique des lignes (`sl_no`)

---

## [17.0.1.1] - Date précédente

### Ajouté
- Template DB (DoliBarr)
- Template ENS
- Configuration au niveau société

---

## [17.0.1.0] - Date initiale

### Ajouté
- Version initiale du module
- Support des rapports de vente personnalisés

---

## Types de changements

- **Ajouté** : Nouvelles fonctionnalités
- **Modifié** : Changements dans les fonctionnalités existantes
- **Déprécié** : Fonctionnalités bientôt supprimées
- **Supprimé** : Fonctionnalités supprimées
- **Corrigé** : Corrections de bugs
- **Sécurité** : Corrections de vulnérabilités
