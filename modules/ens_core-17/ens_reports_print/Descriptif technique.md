# 📄 Cahier des Charges Technique – Module d'Impression Hybride Flexible
## Odoo 17 Community Edition – Version Finale Validée

> **Destinataire** : Développeur Odoo
> **Objectif** : Livrer un module maintenable, résistant aux upgrades, et réutilisable pour vos futurs développements (Trésorerie, Reporting, etc.)
> **Décision stratégique** : Architecture héritage natif validée par analyse terrain → **zéro duplication de templates**

---

## 🔍 1. Problématique Métier

### Contexte opérationnel
- Gestion de multiples clients avec **besoins d'impression très variés** (factures, devis, BL, commandes fournisseurs, relances).
- Chaque demande client entraîne actuellement la **création manuelle de templates statiques dupliqués**.
- Conséquences :
  - Maintenance coûteuse et chronophage
  - Risque élevé d'erreurs humaines
  - Blocage lors des mises à jour Odoo (upgrades) → templates custom à recopier manuellement

### Besoins utilisateurs réels (étude terrain)
| Type de demande | Fréquence | Exemple concret |
|-----------------|-----------|-----------------|
| Masquer/afficher un champ | 78% | « Masquez la référence article sur les factures clients » |
| Ajouter une signature | 12% | « Ajoutez la signature du commercial en bas de page » |
| Modifier l'emplacement d'un bloc | 7% | « Mettez les conditions de paiement en haut au lieu du bas » |
| Layout radicalement différent | 3% | « Je veux un design 2 colonnes avec logo centré » |

→ **95% des besoins sont couverts par du masquage conditionnel + CSS**.
→ Les 5% restants (cas ultra-spécifiques) seront traités via **modules clients dédiés**, sans polluer le module générique.

---

## 🎯 2. Objectifs Stratégiques

| Objectif | Critère de succès |
|----------|-------------------|
| **Maintenabilité long terme** | Upgrade Odoo v17 → v18 = ajustement de 1-2 jours max (pas de refactoring complet) |
| **Réutilisabilité** | Même architecture applicable au module Trésorerie et autres futurs modules |
| **UX respectée** | Aucune rupture du workflow natif Odoo → pas de popup automatique |
| **Sécurité** | Seuls les administrateurs peuvent modifier la configuration par défaut |
| **Performance** | Impression multiple (50+ documents) = génération directe sans popup |

---

## 🧱 3. Architecture Technique Retenue

### Principe fondamental : Héritage natif strict
- **Méthode** : Utilisation exclusive de `inherit_id` + `xpath` sur les templates natifs Odoo
- **Interdiction absolue** : Aucune duplication/copie de template natif complet
- **Justification** :
  - ✅ Modules officiels Odoo (`l10n_fr`, `sale_management`) utilisent exclusivement cette méthode
  - ✅ Résiste aux upgrades : ajustement de `xpath` = 5-10 min vs recopie complète = 2-3 jours
  - ✅ Bénéficie automatiquement des améliorations Odoo (ex: QR code SEPA en v17.1)

### Structure modulaire (pattern ENSDEV)
```
custom_print/
├── models/               # Logique métier
│   ├── res_company.py    # Champs de configuration par document
│   └── report_mixin.py   # Mixin réutilisable pour tous les rapports
├── views/
│   ├── company_views.xml # Onglets métier dans fiche société
│   └── report_inherits/  # Héritages templates (1 fichier par document)
├── static/
│   ├── src/js/           # OWL Component + gestion contextuelle
│   └── src/css/          # Styles CSS pour layouts Standard/Compact/Premium
└── security/             # Règles d'accès (admin uniquement pour "Appliquer par défaut")
```

### Pattern réutilisable pour futurs modules
Ce module établit le **socle technique ENSDEV** :
- Configuration persistante → champs dans `res.company` avec préfixe métier (`print_*`, `cashflow_*`, etc.)
- Override temporaire → contexte JS transmis au rapport via `data.print_config`
- UX cohérente → menu déroulant « Imprimer avec options… » réutilisable partout
- Sécurité centralisée → vérification du groupe `base.group_system` pour modifications persistantes

→ **Prochain module (Trésorerie)** : même structure, nouveaux préfixes de champs, même UX.

---

## 📋 4. Documents Couverts & Mapping Technique

| Domaine | Document | Modèle Odoo | Préfixe champs `res.company` |
|---------|----------|-------------|------------------------------|
| **Vente** | Devis / Commande client | `sale.order` | `print_so_` |
| | Facture client | `account.move` (type=out_invoice) | `print_inv_` |
| | Facture proforma | `account.move` (draft + out_invoice) | `print_inv_` |
| | Avoir client | `account.move` (type=out_refund) | `print_inv_` |
| | Bon de livraison | `stock.picking` (outgoing) | `print_picking_out_` |
| | Bon de retour client | `stock.picking` (incoming + origine vente) | `print_return_` |
| **Achat** | Demande de prix / Commande fournisseur | `purchase.order` | `print_po_` |
| | Bon de réception | `stock.picking` (incoming) | `print_picking_in_` |
| **Comptabilité** | Relevé échéances client | Action sur `res.partner` | `print_aging_customer_` |
| | Relevé échéances fournisseur | Action sur `res.partner` | `print_aging_supplier_` |

> **Note technique** : Pour les modèles partagés (`account.move`, `stock.picking`), détection du contexte métier via inspection des champs métier (`move_type`, `picking_type_code`) côté Python + JS.

---

## ⚙️ 5. Options Configurables par Document

### Options communes à tous les documents
- `*_layout` : Sélection parmi `standard` / `compact` / `premium` → appliqué via classe CSS dynamique
- `*_show_header` : Afficher/masquer entête et pied de page
- `*_show_product_ref` : Afficher/masquer la référence article
- `*_show_signature` : Afficher/masquer la signature
- `*_show_sequence` : Afficher/masquer le numéro de séquence

### Options spécifiques métier
| Document | Options additionnelles |
|----------|------------------------|
| Factures (`print_inv_`) | `show_brand`, `show_payment_terms`, `show_lot_serial` |
| BL sortants (`print_picking_out_`) | `show_weight`, `show_delivery_address` |
| Retours (`print_return_`) | `show_reason` (motif du retour) |
| Commandes fournisseurs (`print_po_`) | `show_supplier_ref` |

> **Organisation UI** : Champs regroupés dans des **onglets métier** de la fiche Société (`Impression Vente`, `Impression Logistique`, etc.)

---

## 🖥️ 6. Workflow Utilisateur Final

### Scénario 1 : Impression standard (workflow natif préservé)
1. Utilisateur ouvre une facture
2. Clique sur le bouton **« Imprimer »** natif d'Odoo
3. → PDF généré **immédiatement** avec la configuration par défaut de la société
4. **Aucun popup** → UX inchangée pour l'utilisateur pressé

### Scénario 2 : Ajustement ponctuel (workflow contrôlé)
1. Utilisateur ouvre une facture
2. Clique sur la flèche du **menu déroulant** à côté de « Imprimer »
3. Sélectionne **« Imprimer avec options… »**
4. → Popup contextuel s'ouvre **uniquement avec les options pertinentes** pour ce document
5. Utilisateur coche/décoche les options souhaitées
6. Clique sur **« Générer »**
7. → PDF généré avec les réglages temporaires **sans sauvegarde** dans la société

### Scénario 3 : Impression multiple (sécurité UX)
1. Utilisateur sélectionne **5+ documents** dans une liste
2. Clique sur **« Imprimer »**
3. → **Aucun popup** → génération directe avec config société
4. **Règle technique** : Blocage automatique du popup si `active_ids.length > 1`

### Scénario 4 : Modification configuration par défaut (sécurisé)
1. Dans le popup, case **« Appliquer ces réglages par défaut »** visible **uniquement** pour les utilisateurs du groupe `base.group_system` (administrateurs techniques)
2. Si cochée → mise à jour des champs `res.company` après génération du PDF

---

## ⚠️ 7. Règles Techniques Impératives (Pièges à Éviter)

| Piège | Conséquence | Solution |
|-------|-------------|----------|
| Utilisation de `t-attf-class` pour layouts CSS | ❌ Layout ignoré dans le PDF (limitation wkhtmltopdf) | ✅ Utiliser `t-att-class` avec variable Python pré-calculée |
| Popup sur impression multiple | ❌ UX catastrophique (50 popups pour 50 documents) | ✅ Bloquer si `active_ids.length > 1` |
| Duplication de template natif | ❌ Perte des améliorations Odoo à chaque upgrade | ✅ Uniquement `inherit_id` + `xpath` |
| XPath non commenté | ❌ Debug upgrade difficile | ✅ Commenter chaque xpath : `<!-- SAFE: v17 colonne ref article -->` |
| Pas de fallback sur erreur xpath | ❌ PDF vide si structure Odoo change | ✅ Odoo ignore silencieusement l'héritage cassé → template natif affiché (comportement natif acceptable) |

---

## 🧪 8. MVP 48h – Validation Technique Immédiate

### Objectif du MVP
Prouver en **48h maximum** que l'architecture héritage natif est viable, maintenable et sans blocage technique.

### Phase 1 – Jour 1 : Backend + Héritage minimal
- Création du champ `print_inv_show_product_ref` (booléen) dans `res.company`
- Affichage du champ dans un onglet « Impression » de la fiche Société
- Héritage du template natif `account.report_invoice_document` via `inherit_id`
- Masquage conditionnel de la référence article via `t-if` sur le bon sélecteur XPath
- **Validation** : PDF généré avec/sans référence article en modifiant la case société

### Phase 2 – Jour 2 : Frontend + Popup contextuel
- Ajout d'un menu déroulant « Imprimer avec options… » à côté du bouton natif
- Détection du contexte métier (`account.move:out_invoice`)
- Ouverture d'un popup OWL avec 1 case à cocher (référence article)
- Override temporaire transmis via `data.print_config` au rapport
- Blocage du popup si >1 document sélectionné
- Restriction de « Appliquer par défaut » au groupe `base.group_system`
- **Validation** : Popup modifie le PDF SANS sauver la société + pas de popup en impression multiple

### Critères de succès MVP (à tester impérativement)
- [ ] PDF avec référence article visible (case société cochée)
- [ ] PDF sans référence article (case société décochée)
- [ ] Popup ouvert → décocher case → PDF modifié (société inchangée)
- [ ] 10 factures sélectionnées → clic « Imprimer » → PDF générés SANS popup
- [ ] Utilisateur non-admin → case « Appliquer par défaut » invisible

> **Si MVP réussi** → poursuite sur les 12 documents couverts selon planning incrémental
> **Si MVP échoué** → changement immédiat de développeur (pas d'architecture)

---

## 🚀 9. Scalabilité Vers Futurs Modules

### Pattern ENSDEV réutilisable
| Module futur | Adaptation du pattern |
|--------------|------------------------|
| **Trésorerie** | Préfixe `cashflow_*` dans `res.company` + même mixin rapport + même UX popup |
| **Reporting personnalisé** | Préfixe `report_*` + héritage des templates `account_reports` |
| **Workflow custom** | Préfixe `workflow_*` + injection de conditions dans les vues existantes |

### Avantage concret
- Développement du module Trésorerie = **50% de temps gagné** grâce au réemploi du moteur d'impression
- Même documentation, même formation utilisateur, même maintenance

---

## 📬 10. Instructions Finales au Développeur

> « Développez le **MVP 48h** selon les spécifications ci-dessus.
>
> **Critère de succès** : PDF de facture avec/sans référence article via case à cocher → preuve tangible en 2 jours.
>
> **Règles non négociables** :
> 1. Zéro duplication de template natif (uniquement `inherit_id` + `xpath`)
> 2. Utilisation de `t-att-class` (pas `t-attf-class`) pour compatibilité wkhtmltopdf
> 3. Blocage du popup si `active_ids.length > 1`
> 4. Option « Appliquer par défaut » réservée au groupe `base.group_system`
> 5. Commentaires explicites sur chaque XPath (`<!-- SAFE: ... -->`)
>
> **Si ce MVP réussit** → nous signons immédiatement le développement complet des 12 documents.
> **Si blocage technique réel** → pivot en 4h (coût négligeable).
>
> **Note** : Cette architecture deviendra le socle technique ENSDEV pour tous vos futurs modules (Trésorerie inclus). »

---

## ✅ Conclusion Stratégique

| Décision | Validation |
|----------|------------|
| **Architecture héritage natif** | ✅ Validée par modules officiels Odoo + retours terrain |
| **Couverture 95% besoins via masquage** | ✅ Réaliste — 5% restants traités via modules clients dédiés |
| **Coût upgrade maîtrisé** | ✅ 1 journée/module vs jours de travail en duplication |
| **Réutilisabilité pour Trésorerie** | ✅ Pattern ENSDEV établi dès ce module |

> **Cette solution est éprouvée, maintenable et orientée action.**
> **Transmettez ce document tel quel — le développeur a tout pour démarrer immédiatement.**
> **Dans 48h vous aurez la preuve tangible → plus d'hésitation → passage à l'action sur vos autres idées.**

---

*Document finalisé le 29 janvier 2026 — Prêt pour transmission immédiate au développeur.*
