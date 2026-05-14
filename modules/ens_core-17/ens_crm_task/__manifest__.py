# -*- coding: utf-8 -*-
{
    "name": "ENS CRM Task Creator",
    "version": "17.0.1.1.0",
    "category": "CRM",
    "summary": "Create project tasks from CRM leads/opportunities "
    "with history transfer",
    "description": """
        ENS CRM Task Creator
        ====================

        Create project tasks directly from CRM leads/opportunities with:
        - Create new task with pre-filled fields
        - Link to existing task
        - Automatic history (chatter) transfer
        - Automatic lead archiving
        - Redirect to task after creation

        Features:
        ---------
        * Button "Create Task" on lead/opportunity form
        * Modal popup with two options:
          - Create New Task (with full form)
          - Link to Existing Task (many2one search)
        * All fields pre-filled from opportunity
        * Copy messages, notes, and attachments to task
        * Archive lead automatically after action
        * Security group for access control
    """,
    "author": "ENS Development",
    "website": "https://enswork.com",
    "license": "OPL-1",
    "depends": [
        "crm",
        "project",
        "mail",
    ],
    "data": [
        "security/crm_task_security.xml",
        "security/ir.model.access.csv",
        "wizard/crm_create_task_wizard_views.xml",
        "views/crm_lead_views.xml",
        "views/project_task_views.xml",
    ],
    "installable": True,
    "application": False,
    "auto_install": False,
}
