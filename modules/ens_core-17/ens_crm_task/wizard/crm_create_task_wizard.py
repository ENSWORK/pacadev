# -*- coding: utf-8 -*-

from datetime import timedelta

from odoo import api, fields, models


class CrmCreateTaskWizard(models.TransientModel):
    _name = "crm.create.task.wizard"
    _description = "Create Task from CRM Lead/Opportunity"

    # Choice between create new or link existing
    action_type = fields.Selection(
        [
            ("create_new", "Create New Task"),
            ("link_existing", "Link to Existing Task"),
        ],
        string="Action",
        default="create_new",
        required=True,
    )

    # Source opportunity
    opportunity_id = fields.Many2one(
        "crm.lead", string="Opportunity", required=True, ondelete="cascade"
    )

    # Fields for creating new task
    name = fields.Char(string="Task Name", required=True)
    project_id = fields.Many2one("project.project", string="Project", required=True)
    user_ids = fields.Many2many("res.users", string="Assigned to")
    date_deadline = fields.Date(string="Deadline")
    tag_ids = fields.Many2many("project.tags", string="Tags")
    partner_id = fields.Many2one("res.partner", string="Customer")
    date_assign = fields.Datetime(string="Assigning Date")
    company_id = fields.Many2one("res.company", string="Company")
    description = fields.Html(string="Description")
    stage_id = fields.Many2one(
        "project.task.type", string="Stage", domain="[('project_ids', '=', project_id)]"
    )

    # Field for linking to existing task
    existing_task_id = fields.Many2one(
        "project.task",
        string="Select Existing Task",
        domain="[('stage_id.fold', '=', False)]",
    )

    @api.model
    def default_get(self, fields_list):
        """Pre-fill wizard fields from opportunity"""
        res = super(CrmCreateTaskWizard, self).default_get(fields_list)

        opportunity_id = self.env.context.get("default_opportunity_id")
        if opportunity_id:
            opportunity = self.env["crm.lead"].browse(
                opportunity_id
            )

            # Pre-fill task fields
            res.update(
                {
                    "name": opportunity.name,
                    "partner_id": (
                        opportunity.partner_id.id if opportunity.partner_id else False
                    ),
                    "user_ids": (
                        [(6, 0, [opportunity.user_id.id])]
                        if opportunity.user_id
                        else False
                    ),
                    "company_id": (
                        opportunity.company_id.id
                        if opportunity.company_id
                        else self.env.company.id
                    ),
                    "description": opportunity.description or "",
                    "tag_ids": (
                        [(6, 0, opportunity.tag_ids.ids)]
                        if opportunity.tag_ids
                        else False
                    ),
                    "date_assign": fields.Datetime.now(),
                    "date_deadline": fields.Date.today() + timedelta(days=7),
                }
            )

            # Try to find default project
            default_project = self.env["project.project"].search(
                [("active", "=", True)], limit=1
            )
            if default_project:
                res["project_id"] = default_project.id
                # Set default stage (first stage of the project)
                default_stage = self.env["project.task.type"].search(
                    [("project_ids", "in", default_project.id)], limit=1
                )
                if default_stage:
                    res["stage_id"] = default_stage.id

        return res

    @api.onchange("project_id")
    def _onchange_project_id(self):
        """Update stage domain and default stage when project changes"""
        if self.project_id:
            # Get first stage of selected project
            stage = self.env["project.task.type"].search(
                [("project_ids", "in", self.project_id.id)], limit=1
            )
            if stage:
                self.stage_id = stage.id
            else:
                self.stage_id = False
        else:
            self.stage_id = False

    def _copy_chatter_history(self, task):
        """Copy messages, notes and attachments from opportunity to task"""
        opportunity = self.opportunity_id

        # Copy messages and notes
        messages = self.env["mail.message"].search(
            [
                ("model", "=", "crm.lead"),
                ("res_id", "=", opportunity.id),
                ("message_type", "in", ["comment", "notification"]),
            ],
            order="date asc",
        )

        for message in messages:
            # Create copy of message
            task.message_post(
                body=message.body,
                subject=message.subject,
                message_type=message.message_type,
                subtype_id=message.subtype_id.id,
                author_id=message.author_id.id,
            )

            # Copy attachments
            if message.attachment_ids:
                for attachment in message.attachment_ids:
                    attachment.copy(
                        {
                            "res_model": "project.task",
                            "res_id": task.id,
                        }
                    )

        # Add notification about origin
        task.message_post(
            body=(
                f"<p>Task created from CRM Opportunity: "
                f"<a href='#' data-oe-model='crm.lead' data-oe-id='{opportunity.id}'>"
                f"{opportunity.name}</a></p>"
            ),
            message_type="notification",
        )

    def action_create_task(self):
        """Create or link task and archive opportunity"""
        self.ensure_one()

        if self.action_type == "create_new":
            # Create new task
            task_vals = {
                "name": self.name,
                "project_id": self.project_id.id,
                "user_ids": [(6, 0, self.user_ids.ids)],
                "date_deadline": self.date_deadline,
                "tag_ids": [(6, 0, self.tag_ids.ids)],
                "partner_id": self.partner_id.id if self.partner_id else False,
                "company_id": self.company_id.id,
                "description": self.description,
                "stage_id": self.stage_id.id if self.stage_id else False,
                "opportunity_id": self.opportunity_id.id,
            }
            task = self.env["project.task"].create(task_vals)

        else:
            # Link to existing task as parent - Create subtask
            parent_task = self.existing_task_id

            # Create new subtask with parent
            task_vals = {
                "name": self.name,
                "project_id": self.project_id.id,
                "user_ids": [(6, 0, self.user_ids.ids)],
                "date_deadline": self.date_deadline,
                "tag_ids": [(6, 0, self.tag_ids.ids)],
                "partner_id": self.partner_id.id if self.partner_id else False,
                "company_id": self.company_id.id,
                "description": self.description,
                "stage_id": self.stage_id.id if self.stage_id else False,
                "opportunity_id": self.opportunity_id.id,
                "parent_id": parent_task.id,  # Set as subtask
            }
            task = self.env["project.task"].create(task_vals)

        # Copy chatter history
        self._copy_chatter_history(task)

        # Archive the opportunity
        self.opportunity_id.write({"active": False})

        # Return action to open the task
        return {
            "name": "Tâche",
            "type": "ir.actions.act_window",
            "res_model": "project.task",
            "view_mode": "form",
            "res_id": task.id,
            "target": "current",
        }
