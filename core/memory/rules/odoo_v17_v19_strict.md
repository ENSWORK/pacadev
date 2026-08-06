# REGLES STRICTES ODOO v17/v19 - PACADEV

## INTERDITS ABSOLUS
1. **JAMAIS de SQL brut** : Interdiction formelle d'utiliser `self.env.cr.execute()` sauf justification ecrite et validation humaine.
2. **JAMAIS de code obsolete** : Ne pas utiliser les anciennes API (v14/v15). Toujours utiliser les decorateurs modernes.
3. **JAMAIS de vues sans action** : Toute vue doit etre liee a une action fenetre.
4. **JAMAIS de module sans securite** : Toujours creer `security/ir.model.access.csv`.

## OBLIGATIONS
1. **Decorateurs obligatoires** :
   - `@api.depends('field1', 'field2')` pour les champs calcules stockes
   - `@api.constrains('field1')` pour les validations metier
   - `@api.onchange('field1')` pour les interfaces utilisateur
   - `@api.model` pour les methodes de classe
   - `@api.model_create_multi` pour la creation en masse

2. **Structure module obligatoire** :
   ```
   module_name/
   ├── __init__.py
   ├── __manifest__.py
   ├── models/
   │   ├── __init__.py
   │   └── model_name.py
   ├── views/
   │   └── model_name_views.xml
   ├── security/
   │   └── ir.model.access.csv
   └── data/ (optionnel)
   ```

3. **Manifest complet** :
   ```python
   {
       'name': 'Module Name',
       'version': '17.0.1.0.0',
       'category': 'Category',
       'summary': 'Summary',
       'description': 'Description',
       'author': 'PACADEV',
       'depends': ['base'],
       'data': [
           'security/ir.model.access.csv',
           'views/model_name_views.xml',
       ],
       'installable': True,
       'application': False,
   }
   ```

4. **Securite des acces** :
   ```csv
   id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
   access_model_name,model.name,model_model_name,base.group_user,1,1,1,0
   ```

5. **Vues XML** :
   - Toujours utiliser `record` au lieu de `act_window`
   - Nommage : `view_model_name_form`, `view_model_name_tree`
   - Action : `action_model_name`

6. **Verification des droits** :
   ```python
   if not self.env['res.users'].has_group('module.group_name'):
       raise AccessError("Acces refuse")
   ```

## CONVENTIONS DE NOMMAGE
- Modele : `module.model_name` (ex: `afrequip.ticket`)
- Classe Python : `ModelName` (ex: `Ticket`)
- Champ : `field_name` (snake_case)
- Vue : `view_module_model_form/tree`
- Action : `action_module_model`
- Groupe : `group_name`

## VALIDATION AVANT COMMIT
Avant de proposer du code, verifie :
- [ ] Tous les imports sont presents
- [ ] Le `__manifest__.py` liste tous les fichiers XML/CSV
- [ ] Les vues XML sont bien formees (pas de balises ouvertes)
- [ ] Le fichier `ir.model.access.csv` existe pour chaque modele
- [ ] Les decorateurs `@api` sont correctement utilises
