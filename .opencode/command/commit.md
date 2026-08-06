---
description: "Commit formaté via PACADEV (type: desc, Refs: #issue)"
agent: pacadev
---

Crée un commit formaté PACADEV.

1. Vérifie au préalable que la revue est verte : `pacadev work review $ARGUMENTS` (idempotent).
2. Exécute `pacadev work commit $ARGUMENTS`.
3. Affiche le résultat et l'état FSM résultant : `pacadev work status`.
