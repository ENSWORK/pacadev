# 📇 INDEX — Documentation PACADAI

> **PACADAI** = produit livré au client : Orchestrator + Agents IA + Rule Engine + Base de Connaissances, développé sur Odoo 19.
> PACADAI est traité comme un **projet/client** au sein du repo PACADEV (`ENSWORK/pacadev`). On réutilise la CI/CD, le Docker et les commandes PACADEV.

## 🗺️ Carte des documents

| Document | Rôle |
|----------|------|
| [PRINCIPLES.md](PRINCIPLES.md) | Principes non négociables (EEM v1.2) |
| [GLOSSAIRE.md](GLOSSAIRE.md) | Vocabulaire métier commun |
| `functions/<service>/F<NNN>-<fonction>/` | Dossiers EEM par fonction (6 fichiers numérotés) |
| `adr/ADR-NNN-*.md` | Architecture Decision Records transverses |

## 🏢 Services

| Service | Dossier |
|---------|---------|
| Commercial | `functions/commercial/` |
| Finance | `functions/finance/` |
| Supply Chain | `functions/supply-chain/` |
| Prospection | `functions/prospection/` |
| Direction | `functions/direction/` |

## 🔄 Cycle de vie d'une capacité

1. Créer une issue via le template **« Nouvelle Capacité EEM »** (labels `eem` + `product:pacadai`)
2. Suivre les 6 étapes EEM en cochant les gates de validation
3. Documenter chaque étape dans le dossier de la fonction (`01_OBSERVATION.md` → `06_REX.md`)
4. Capitaliser le REX à la livraison

## 🧭 Références

- **Méthode :** EEM v1.2 — Observer → Décider → Modéliser → Valider → Construire → Capitaliser
- **Suivi :** GitHub Project « 🚀 PACADAI Roadmap » (filtre `label:product:pacadai`)
