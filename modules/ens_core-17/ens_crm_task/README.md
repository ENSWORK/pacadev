# ENS CRM Task Creator

## Description

Module Odoo 17 permettant de créer des tâches projet directement depuis les opportunités/leads CRM avec transfert automatique de l'historique.

## Fonctionnalités

### Création de tâches depuis CRM
- Bouton **"Create Task"** sur le formulaire d'opportunité/lead
- Popup modale avec deux options :
  - **Créer une nouvelle tâche** : formulaire complet avec tous les champs pré-remplis
  - **Lier à une tâche existante** : recherche many2one intelligente

### Pré-remplissage automatique
Lors de la création d'une nouvelle tâche, les champs suivants sont automatiquement pré-remplis :
- Nom de la tâche (depuis l'opportunité)
- Client/Partenaire
- Utilisateur assigné
- Société
- Tags
- Description
- Date d'assignation (automatique)
- Deadline (J+7 par défaut)
- Étape du projet

### Transfert d'historique
- Copie automatique de tous les messages du chatter
- Copie des notes internes
- Copie des pièces jointes
- Notification de l'origine CRM dans la tâche

### Archivage et redirection
- Archivage automatique du lead après création/liaison
- Redirection vers la tâche créée/liée
- Smart button pour voir les tâches liées depuis l'opportunité

## Installation

1. Copier le module dans le dossier addons
2. Mettre à jour la liste des modules
3. Installer **ENS CRM Task Creator**

## Configuration

### Groupe de sécurité
Un groupe de sécurité **"CRM Task Creator"** est créé automatiquement.

Pour donner accès à un utilisateur :
1. Aller dans Paramètres > Utilisateurs
2. Sélectionner l'utilisateur
3. Dans l'onglet **Technical**, activer **"CRM Task Creator"**

### Projet par défaut
Le premier projet actif sera sélectionné par défaut. Il est recommandé de configurer les projets avant utilisation.

## Utilisation

### Créer une nouvelle tâche
1. Ouvrir une opportunité/lead CRM
2. Cliquer sur le bouton **"Create Task"**
3. Sélectionner **"Create New Task"**
4. Vérifier/modifier les champs pré-remplis
5. Cliquer sur **"Create Task"**

### Lier à une tâche existante
1. Ouvrir une opportunité/lead CRM
2. Cliquer sur le bouton **"Create Task"**
3. Sélectionner **"Link to Existing Task"**
4. Rechercher et sélectionner la tâche
5. Cliquer sur **"Create Task"**

## Dépendances

- `crm` - CRM Odoo
- `project` - Gestion de projets
- `mail` - Messagerie

## Informations techniques

- **Version** : 17.0.1.0.0
- **Auteur** : ENS Development
- **Licence** : OPL-1
- **Compatible** : Odoo 17.0

## Structure du module

```
ens_crm_task/
├── __init__.py
├── __manifest__.py
├── README.md
├── models/
│   ├── __init__.py
│   ├── crm_lead.py
│   └── project_task.py
├── wizard/
│   ├── __init__.py
│   ├── crm_create_task_wizard.py
│   └── crm_create_task_wizard_views.xml
├── views/
│   └── crm_lead_views.xml
├── security/
│   ├── crm_task_security.xml
│   └── ir.model.access.csv
└── static/
    └── description/
```

## Support

Pour tout problème ou suggestion, contacter l'équipe de développement ENS.
