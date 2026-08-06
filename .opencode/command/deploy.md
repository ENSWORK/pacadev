---
description: Déploiement approuvé (staging/prod)
agent: pacadev
---

Déploie un client PACADEV après approbation.

1. Récupère client, environnement (prod|staging) et raison depuis `$ARGUMENTS` ou demande-les.
2. `pacadev backup create --client <client>` avant un déploiement prod.
3. `pacadev deploy generate-approval --client <client> --reason "<raison>"` puis `pacadev deploy approve --client <client> --env <env> --approve-token <TOKEN>`.
4. Vérifie la santé : `pacadev health --client <client>`.
