from odoo import _, models, fields
from odoo.exceptions import UserError

class SaleOrder(models.Model):
    _inherit = 'sale.order'

    delivery_id = fields.Many2one('stock.picking', string='Delivery', copy=False)
    def action_open_delivery_wizard(self):
        self.ensure_one()
        if not self.picking_ids:
            raise UserError(_("No deliveries found for this sale order."))
        return {
            'name': 'Validate Delivery',
            'type': 'ir.actions.act_window',
            'res_model': 'delivery.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'active_id': self.id},
        }
    def action_confirm(self):
        res = super(SaleOrder, self).action_confirm()
        for order in self:
            if order.picking_ids:
                order.delivery_id = order.picking_ids[0]
        return res

