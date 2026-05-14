from odoo import fields, api, models, _


class SaleOrder(models.Model):

    _inherit = "sale.order"

    @api.depends('amount_total')
    def get_amount_letter(self):
        amount = self.currency_id.amount_to_text(self.amount_total)
        return amount