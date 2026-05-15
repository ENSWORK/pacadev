# -*- coding: utf-8 -*-

from odoo import api, fields, models


class CrmLead(models.Model):
    _inherit = "crm.lead"

    task_ids = fields.One2many("project.task", "opportunity_id", string="Related Tasks")
    task_count = fields.Integer(string="Task Count", compute="_compute_task_count")

    @api.depends("task_ids")
    def _compute_task_count(self):
        for lead in self:
            lead.task_count = len(lead.task_ids)

    def action_create_task_wizard(self):
        """Open wizard to create task from opportunity"""
        self.ensure_one()

        return {
            "name": ("Create Task from CRM " "Pipeline/Lead"),
            "type": "ir.actions.act_window",
            "res_model": "crm.create.task.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {
                "default_opportunity_id": self.id,
            },
        }

    def action_view_tasks(self):
        """View related tasks"""
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("project.action_view_task")
        action["domain"] = [("opportunity_id", "=", self.id)]
        action["context"] = {
            "default_opportunity_id": self.id,
        }
        return action

    # Champ ICE client
    ice_client = fields.Char(
        string="ICE Client",
        help="Identifiant du client (ICE) associé à cette opportunité.",
    )
