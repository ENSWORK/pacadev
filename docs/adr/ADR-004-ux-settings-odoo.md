# ADR-004 — UX : paramétrage dans Settings Odoo

- **Statut :** Accepté
- **Date :** 2026-08-23
- **Déclencheur :** Toutes capacités PACADAI

## Contexte

PACADAI s'intègre à Odoo 19. Les utilisateurs métier ne doivent pas gérer la configuration hors de l'ERP : pas de fichier de config à éditer sur un serveur, pas d'interface séparée pour les réglages courants.

## Décision

Tout comportement configurable d'une capacité PACADAI est exposé dans les **paramètres Odoo** (`res.config.settings`), organisé par section PACADAI, avec valeurs par défaut sûres et droits d'accès réservés aux administrateurs fonctionnels.

Règles associées :

1. Aucune valeur métier codée en dur dans les modules.
2. Chaque paramètre a un libellé clair, en français, cohérent avec le GLOSSAIRE.
3. Le changement de paramètre prend effet sans redémarrage du service quand c'est techniquement possible.
4. Les paramètres techniques d'infrastructure restent côté PACADEV (variables d'environnement), hors portée utilisateur.

## Alternatives considérées

| Option | Raison de l'écartement |
|--------|------------------------|
| Interface web séparée | Double UI à maintenir, expérience fragmentée |
| Fichiers de configuration serveur | Inaccessible aux métiers, risque d'erreur ops |
| Paramètres codés en dur | Aucune flexibilité client |

## Conséquences

- Chaque capacité prévoit son bloc Settings dès l'étape MODÉLISER (gate DÉCIDER).
- Tests systématiques des valeurs par défaut et des droits d'accès.
