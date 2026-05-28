from odoo import models, fields, api

class StockPicking(models.Model):
    _inherit = 'stock.picking'

    sale_order_id = fields.Many2one('sale.order', string='Related Sale Order', compute='_compute_sale_order', store=True)

    @api.depends('origin')
    def _compute_sale_order(self):
        for picking in self:
            sale_order = self.env['sale.order'].search([('name', '=', picking.origin)], limit=1)
            picking.sale_order_id = sale_order.id if sale_order else False