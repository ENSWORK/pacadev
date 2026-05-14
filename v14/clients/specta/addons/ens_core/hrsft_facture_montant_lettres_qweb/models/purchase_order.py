
from odoo import fields, api, models, _


class PurchaseOrder(models.Model):

    _inherit = "purchase.order"

    @api.depends('amount_total')
    def get_amount_letter(self):
        amount = self.currency_id.amount_to_text(self.amount_total)
        return amount

