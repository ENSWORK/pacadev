---
description: Démarre une session de travail Odoo (FSM DEV)
agent: pacadev
---

Démarre une session de travail PACADEV pour un client et une issue.

1. Si `$ARGUMENTS` est vide, demande le client (afrequip, mecafric, mecafric_water, sofetelec) et le numéro d'issue.
2. Exécute `pacadev work start $ARGUMENTS`.
3. Vérifie l'état : `pacadev work status`.
4. Lis `core/memory/rules/odoo_v17_v19_strict.md` avant toute génération de code.
