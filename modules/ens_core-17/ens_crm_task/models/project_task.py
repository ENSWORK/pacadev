# -*- coding: utf-8 -*-

from odoo import fields, models


class ProjectTask(models.Model):
    _inherit = "project.task"

    opportunity_id = fields.Many2one(
        "crm.lead", string="Opportunity", ondelete="set null"
    )

    def action_view_opportunity(self):
        """View related opportunity"""
        self.ensure_one()
        if not self.opportunity_id:
            return

        return {
            "name": "Opportunité",
            "type": "ir.actions.act_window",
            "res_model": "crm.lead",
            "view_mode": "form",
            "res_id": self.opportunity_id.id,
            "target": "current",
        }
