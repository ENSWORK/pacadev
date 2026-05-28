# Custom Reports - Enswork

Module de gestion d'impressions personnalisées pour Odoo 17.

## 📋 Vue d'ensemble

Ce module gère l'impression dynamique de documents commerciaux (devis, factures, livraisons, bons de commande) avec **3 templates principaux** et des options d'impression flexibles.

### Templates disponibles

- **ENS** : Template simple et épuré avec en-tête minimaliste
- **DB (DoliBarr)** : Template élaboré avec design professionnel et informations fiscales détaillées
- **MEC (Template MEC)** : Template hautement personnalisable avec images d'en-tête/pied de page
- **Odoo** : Template natif d'Odoo (fallback)

## 🎯 Fonctionnalités principales

### 1. Configuration au niveau de la société

Dans **Paramètres → Sociétés → Options d'impression** :

- **Template d'impression** : Choix entre ENS, DB, MEC ou Odoo
- **Message de clôture** : Texte personnalisé affiché après le tableau des articles
- **Couleur primaire** : Couleur principale utilisée dans les rapports
- **Couleur arrière-plan en-tête** : Couleur de fond pour la zone d'en-tête
- **Afficher le champ Projet** : Active/désactive l'affichage du champ projet

#### Options spécifiques au template MEC

**Pour les devis :**
- **Type de header** :
  - Logo normal
  - Image pleine largeur
- **Style de l'en-tête** :
  - Avec arrière-plan coloré
  - Simple/Sans couleur
- **Afficher message de clôture** : Active/désactive le message de fin
- **Images personnalisées** :
  - Image d'en-tête Template MEC (pleine largeur)
  - Image de pied de page Template MEC (pleine largeur)

**Pour les factures :**
- **Type de header facture** :
  - Logo normal (par défaut)
  - Image pleine largeur
- **Image d'en-tête facture** : Image spécifique aux factures (distincte des devis)
- **Note** : Permet d'avoir un en-tête différent pour les factures vs les devis

#### Configuration de la taille du logo

**Nouveau depuis la version 17.0.1.24** : Personnalisez la taille du logo en un seul endroit pour tous les templates.

Dans **Paramètres → Sociétés → Configuration du logo** :

- **Hauteur du logo (px)** : Par défaut 85px
- **Largeur du logo (px)** : Par défaut 350px

**Avantages :**
- ✅ **Ultra simple** : 2 champs seulement, appliqués partout
- ✅ **Cohérence automatique** : Tous les documents ont le même logo
- ✅ **Modification centralisée** : 1 seul endroit au lieu de 14 fichiers
- ✅ **Modifiable via l'interface** : Pas besoin de toucher au code
- ✅ **Multi-sociétés** : Personnalisable par société

**Appliqué à :**
- Tous les templates (ENS, DB, MEC)
- Tous les documents (devis, factures, BL, achats)

**Note importante :**
- Après modification, pensez à vider le cache Odoo et régénérer les PDFs
- Pour le template MEC en mode "Image pleine largeur", utiliser `header_image_mec` à la place

### 2. Options d'impression par document

Dans chaque **Devis/Commande → Onglet "Options d'impression"** :

- **Imprimer avec références** : Affiche/masque la colonne "Références produit"
- **Imprimer avec en-tête** : Affiche/masque l'en-tête personnalisé
- **Imprimer avec N°** : Affiche/masque la colonne de numérotation des lignes

#### Options spécifiques au bon de livraison

- **Imprimer avec Visa** : Affiche/masque la section "Visa Service / Client" permettant les signatures

### 3. Champs additionnels

#### Sur les commandes de vente

- **Projet** : Nom du projet associé à la commande (visible selon config société)

#### Sur les lignes de commande

- **Délai de livraison** : Délai spécifique pour chaque ligne
- **N° Ligne** : Numérotation automatique des lignes (calculée)

## 🔧 Fonctionnement technique

### Système de rapports dynamiques

Le module utilise un système de "routing" intelligent :

```
Rapport dynamique
    ↓
Lecture du template société (company_id.print_template)
    ↓
Lecture des options document (print_with_ref, print_with_header)
    ↓
Chargement automatique du bon template
```

### Structure des fichiers de rapports

Chaque type de document a 3 templates × 2 variantes :

```
report/
├── report_sale_db.xml              # Devis DB avec références
├── report_sale_db_without_ref.xml  # Devis DB sans références
├── report_sale_ens.xml             # Devis ENS avec références
├── report_sale_ens_without_ref.xml # Devis ENS sans références
├── report_sale_mec.xml             # Devis MEC avec références
├── report_sale_mec_without_ref.xml # Devis MEC sans références
├── report_sale_dynamic.xml         # Router dynamique
└── ... (idem pour invoice, delivery, purchase)
```

### Rapports disponibles

Le module fournit des rapports pour :

- **Ventes** : Devis et commandes
- **Achats** : Bons de commande
- **Stock** : Bons de livraison
- **Comptabilité** : Factures

## 📚 Utilisation

### Configuration initiale

1. Aller dans **Paramètres → Sociétés → Votre société**
2. Ouvrir l'onglet **Options d'impression**
3. Sélectionner le template par défaut (ENS, DB ou MEC)
4. Configurer les couleurs et options selon vos besoins
5. Pour MEC : uploader les images d'en-tête et pied de page si nécessaire

### Impression d'un document

1. Ouvrir un devis/commande/facture
2. (Optionnel) Ajuster les options dans l'onglet **Options d'impression**
3. Cliquer sur **Imprimer → Devis EnSwOrK** (ou autre rapport)
4. Le PDF généré utilisera automatiquement le bon template

### Exemple d'utilisation des templates

**Cas 1 : Entreprise standard**
- Template : **DB**
- Raison : Affichage professionnel avec toutes les infos fiscales (RC, IF, CNSS, ICE)

**Cas 2 : Offres commerciales simples**
- Template : **ENS**
- Raison : Design épuré, focus sur le contenu

**Cas 3 : Branding spécifique (Template MEC)**
- Template : **MEC**
- Images : Header et footer personnalisés
- Style : Arrière-plan coloré avec logo
- Message de clôture personnalisé

## 🔍 Différences entre templates

| Caractéristique | ENS | DB | MEC |
|----------------|-----|-------|-----|
| En-tête | Logo seul | Logo + Infos colorées | Image pleine largeur OU logo |
| Pied de page | Simple + pagination | Détaillé (fiscal) | Image personnalisée |
| Section émetteur/destinataire | Tableau simple | Fond gris + styling | Customisable avec couleurs |
| Personnalisation couleurs | ✓ | ✓ | ✓✓✓ (avancée) |
| Message de clôture | ✓ | ✓ | ✓ (optionnel) |
| Complexité | Faible | Moyenne | Élevée |

## 🛠️ Dépendances

- `base`
- `web`
- `sale`
- `purchase`
- `stock`
- `account`
- `identifiants_fiscaux_maroc`

## 📝 Notes techniques

### Calcul automatique du numéro de ligne

Le champ `sl_no` sur les lignes de commande est calculé automatiquement :
- Filtre les lignes de type "affichage" (sections, notes)
- Trie par séquence
- Numérote de 1 à N

### Gestion des couleurs

Les couleurs sont stockées au format hexadécimal (`#RRGGBB`) et injectées dynamiquement dans les templates via `t-attf-style`.

### Options conditionnelles

Le template dynamique évalue les conditions dans cet ordre :
1. Template Odoo ? → Template natif
2. Avec en-tête ?
   - Template société (ENS/DB/MEC)
   - Avec/sans références
3. Sans en-tête ? → Version simplifiée

## 🐛 Bonnes pratiques

- Toujours tester l'impression après changement de template
- Vérifier les images MEC (format recommandé : PNG/JPG, largeur min 800px)
- Utiliser des couleurs contrastées pour la lisibilité
- Le message de clôture ne doit pas dépasser 2-3 lignes

## 📄 License

LGPL-3

## 👤 Auteur

**ENSWORK**
- Website: https://www.enswork.com
- Version: 17.0.1.8
