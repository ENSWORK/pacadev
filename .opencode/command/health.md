---
description: Vérifie la santé des services PACADEV
agent: pacadev
---

Vérifie la santé de l'infrastructure et des clients.

1. Exécute `pacadev health --all`.
2. Si un service est down, diagnostique : `pacadev infra status`, logs Docker, puis propose un correctif (préférer `pacadev infra restart` avant toute manipulation manuelle).
