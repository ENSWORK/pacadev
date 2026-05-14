from odoo import api, fields, models


class PurchaseOrderLine(models.Model):
    _inherit = "purchase.order.line"

    sl_no = fields.Integer(string='Sl. No.', compute='_compute_serial_number', store=True)

    @api.depends('sequence', 'order_id')
    def _compute_serial_number(self):
        for order_line in self:
            if not order_line.sl_no:
                serial_no = 1
                for line in order_line.mapped('order_id').order_line:
                    line.sl_no = serial_no
                    serial_no += 1
