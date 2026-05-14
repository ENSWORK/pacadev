from odoo import models, fields, api, _


class ResPartnerCnss(models.Model):
    _inherit = "res.partner"

    cnss = fields.Char("CNSS")