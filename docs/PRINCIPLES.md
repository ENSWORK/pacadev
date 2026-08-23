# 📜 PRINCIPLES — Principes non négociables (EEM v1.2)

Ces principes s'appliquent à toute capacité PACADAI, sans exception.

## 1. Une capacité = un parcours EEM complet

Toute capacité traverse les 6 étapes (Observer → Décider → Modéliser → Valider → Construire → Capitaliser). Aucune étape n'est sautée ; on passe à l'étape suivante uniquement si son **gate de validation** est intégralement coché.

## 2. Le problème métier avant la technique

L'étape OBSERVER décrit le problème en langage métier, clair et quantifiable. Aucune solution technique n'est discutée avant l'étape DÉCIDER.

## 3. Filtre AI-First obligatoire

Chaque capacité est confrontée au filtre AI-First dès l'OBSERVER : la valeur doit venir de l'intelligence (agents, règles, connaissances) et non d'un simple paramétrage standard.

## 4. Vérification « Réalité Odoo » systématique

Avant toute décision technique : vérifier les modules OCA existants, les bonnes pratiques communautaires et les limitations techniques d'Odoo 19. Ne jamais réinventer ce qui existe déjà.

## 5. L'UX se paramètre dans Settings Odoo

Tout comportement configurable est exposé dans les paramètres Odoo (`res.config.settings`), jamais codé en dur ni géré hors de l'ERP.

## 6. Anti-contournement by design

Chaque modèle intègre les règles de transition d'état et de révocation qui empêchent le contournement des contrôles métier (ex : bloquer une vente non rentable).

## 7. Les décisions sont tracées (ADR)

Toute décision d'architecture transverse donne lieu à un ADR dans `docs/adr/`. Un ADR n'est jamais supprimé, seulement marqué déprécié ou remplacé.

## 8. PACADEV est la seule usine

PACADAI vit dans le repo `ENSWORK/pacadev` et réutilise sa CI/CD, son Docker et ses outils. Pas de repo séparé, pas de duplication d'infrastructure.

## 9. Isolation des clients

Le code des clients existants (afrequip, mecafric, maxelec, etc.) n'est jamais modifié par les travaux produit PACADAI.

## 10. Capitalisation systématique

Chaque capacité livrée se termine par un REX documenté (`06_REX.md`) alimentant la Base de Connaissances.
