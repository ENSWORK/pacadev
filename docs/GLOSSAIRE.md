# 📖 GLOSSAIRE — Vocabulaire métier PACADAI

Vocabulaire de référence. Toute documentation, issue et ADR utilise ces termes de façon cohérente.

## Produit & Plateforme

| Terme | Définition |
|-------|------------|
| **PACADAI** | Produit livré aux clients : plateforme d'intelligence opérationnelle pour PME marocaines, développée sur Odoo 19. |
| **PACADEV** | Usine interne ENSWORK (CI/CD, Docker, FSM, RBAC) qui héberge et orchestre le développement des produits, dont PACADAI. |
| **Orchestrator** | Composant central PACADAI qui coordonne les Agents IA, le Rule Engine et la Base de Connaissances. |
| **Agent IA** | Composant logiciel spécialisé exécutant une mission opérationnelle (ex : Agent Commercial « Le Closer »). |
| **Rule Engine** | Moteur de règles métier appliquant les contrôles et politiques de gestion (ex : blocage d'une vente non rentable). |
| **Base de Connaissances** | Référentiel capitalisé (leçons apprises, procédures, contexte client) exploité par les agents. |
| **Composant transverse** | Composant partagé mobilisé par plusieurs capacités (ex : Rule Engine, Notification Center). |

## Méthode (EEM)

| Terme | Définition |
|-------|------------|
| **EEM** | ENSWORK Engineering Method v1.2 — 6 étapes : Observer, Décider, Modéliser, Valider, Construire, Capitaliser. |
| **Capacité** | Unité fonctionnelle livrée à un service métier, identifiée par `F<NNN>-<nom-fonction>` (ex : `F001-bloquer-vente-non-rentable`). |
| **Gate de validation** | Conditions à cocher intégralement avant de passer à l'étape EEM suivante. |
| **Service propriétaire** | Service métier responsable de la capacité (Commercial, Finance, Supply Chain, Prospection, Direction). |
| **Filtre AI-First** | Critère de validation OUI/NON vérifiant que la capacité relève bien de l'intelligence artificielle. |
| **Réalité Odoo** | Vérification obligatoire : modules OCA existants, bonnes pratiques communautaires, limitations techniques d'Odoo. |
| **REX** | Retour d'expérience documenté en fin de cycle (`06_REX.md`) et capitalisé dans la Base de Connaissances. |
| **ADR** | Architecture Decision Record — décision d'architecture transverse documentée dans `docs/adr/`. |

## Périmètre & Tests

| Terme | Définition |
|-------|------------|
| **IN / OUT** | Périmètre inclus / exclu d'une capacité, figé lors de l'OBSERVER. |
| **Happy Path** | Scénario nominal sans erreur. |
| **Error Path** | Scénario d'erreur avec règles de résilience associées. |
| **Contournement** | Tentative (volontaire ou non) de passer outre un contrôle métier ; scénario de test obligatoire. |
| **Anti-contournement** | Ensemble des règles de transition d'état et de révocation empêchant de passer outre un contrôle. |
