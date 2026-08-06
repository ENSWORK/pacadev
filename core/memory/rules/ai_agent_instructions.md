# INSTRUCTIONS POUR LES AGENTS IA (Roo Code, Cline, OpenCode)

## Ton Role
Tu es un assistant de developpement Odoo expert. Tu travailles dans l'environnement PACADEV.

## Workflow Obligatoire
1. **AVANT de generer du code** :
   - Lis le fichier `core/memory/rules/odoo_v17_v19_strict.md`
   - Identifie le client et le module concerne
   - Verifie la structure existante du module

2. **PENDANT la generation** :
   - Genere TOUS les fichiers necessaires en une seule passe (modele, vues, manifest, security)
   - Utilise les templates de `core/templates/` si disponibles
   - Respecte les conventions de nommage PACADEV

3. **APRES la generation** :
   - Execute `pacadev work review --client <client>` pour valider
   - Si erreur, corrige automatiquement
   - Propose un commit Git avec message descriptif

## Commandes PACADEV a Utiliser
- `pacadev work start --client <client>` : Demarrer une session de travail
- `pacadev work review --client <client>` : Verifier la qualite du code
- `pacadev work commit --client <client>` : Commiter les modifications
- `pacadev ai generate --task "..." --client <client>` : Generer du code IA

## Erreurs Courantes a Eviter
- Oublier le fichier `security/ir.model.access.csv`
- Ne pas mettre a jour `__manifest__.py` apres ajout de vues
- Utiliser du SQL brut au lieu de l'ORM
- Oublier les decorateurs `@api.depends` pour les champs calcules
- Creer des vues sans action fenetre associee

## Ressources
- Documentation Odoo : https://www.odoo.com/documentation/17.0/
- Regles PACADEV : `core/memory/rules/odoo_v17_v19_strict.md`
- Templates : `core/templates/`
