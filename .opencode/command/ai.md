---
description: Génération de code Odoo via l'IA PACADEV
agent: pacadev
---

Génère du code Odoo avec l'IA PACADEV.

1. Recherche le contexte mémoire : `pacadev memory search "$ARGUMENTS" --rules`.
2. Exécute `pacadev ai generate $ARGUMENTS`.
3. Applique les règles strictes (`core/memory/rules/odoo_v17_v19_strict.md`) au code généré, puis lance la revue `pacadev work review --client <client>`.
