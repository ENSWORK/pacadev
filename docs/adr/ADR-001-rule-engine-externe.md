# ADR-001 — Rule Engine externe

- **Statut :** Proposé
- **Date :** 2026-08-23
- **Déclencheur :** F001-bloquer-vente-non-rentable (Commercial)

## Contexte

Les contrôles métier de PACADAI (ex : bloquer une vente non rentable) doivent s'appliquer de façon centralisée, cohérente et non contournable, quel que soit le point d'entrée dans Odoo 19 (interface, API, import). Le moteur de contraintes natif d'Odoo montre ses limites pour des règles métier complexes, paramétrables par service et évolutives sans développement.

## Décision

<!-- Trancher : Rule Engine externe orchestré avec Odoo vs mécanismes natifs purs. Préciser le protocole d'appel, la latence acceptable, le comportement en cas d'indisponibilité (fail-open / fail-closed). -->

## Alternatives considérées

<!-- Options écartées et pourquoi -->

## Conséquences

<!-- Impacts positives / négatives, opérations, dette technique -->
