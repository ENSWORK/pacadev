from odoo import api, fields, models
from odoo.tools import float_compare, float_is_zero


class SaleOrder(models.Model):
    _inherit = "sale.order"

    date_done = fields.Datetime(
        string="Date livraison",
        compute="_compute_date_done",
        store=True,
        help="Date of the last delivery for this sale order",
    )

    picking_transporteur = fields.Char(
        string="Transporteur",
        compute="_compute_picking_transporteur",
        store=False,
        readonly=True,
        help="Transporteur du bon de livraison",
    )

    delivery_state = fields.Selection(
        [
            ("no", "No delivery"),
            ("unprocessed", "Unprocessed"),
            ("partially", "Partially processed"),
            ("done", "Done"),
        ],
        string="Delivery state",
        compute="_compute_sale_delivery_state",
        store=True,
    )

    force_delivery_state = fields.Boolean(
        string="Force delivery state",
        help=(
            "Allow to enforce done state of delivery, for instance if some"
            " quantities were cancelled"
        ),
    )

    def _all_qty_delivered(self):
        self.ensure_one()
        sale_lines = self.order_line.filtered(
            lambda rec: not rec._is_delivery() and not rec.skip_sale_delivery_state
        )
        precision = self.env["decimal.precision"].precision_get(
            "Product Unit of Measure"
        )
        return all(
            float_compare(
                line.qty_delivered, line.product_uom_qty, precision_digits=precision
            )
            >= 0
            for line in sale_lines
        )

    def _partially_delivered(self):
        self.ensure_one()
        sale_lines = self.order_line.filtered(
            lambda rec: not rec._is_delivery() and not rec.skip_sale_delivery_state
        )
        precision = self.env["decimal.precision"].precision_get(
            "Product Unit of Measure"
        )
        return any(
            not float_is_zero(line.qty_delivered, precision_digits=precision)
            for line in sale_lines
        )

    @api.depends(
        "order_line.qty_delivered",
        "order_line.skip_sale_delivery_state",
        "state",
        "force_delivery_state",
    )
    def _compute_sale_delivery_state(self):
        for order in self:
            if order.state in ("draft", "cancel"):
                order.delivery_state = "no"
            elif order.force_delivery_state or order._all_qty_delivered():
                order.delivery_state = "done"
            elif order._partially_delivered():
                order.delivery_state = "partially"
            else:
                order.delivery_state = "unprocessed"

    def action_force_delivery_state(self):
        self.write({"force_delivery_state": True})

    def action_unforce_delivery_state(self):
        self.write({"force_delivery_state": False})

    @api.depends('order_line.qty_delivered', 'order_line.write_date')
    def _compute_date_done(self):
        for order in self:
            picking = self.env['stock.picking'].search([
                ('origin', '=', order.name),
                ('state', '=', 'done')
            ], order='date_done DESC', limit=1)

            if picking and picking.date_done:
                # Use the actual delivery date from the picking
                order.date_done = picking.date_done
            else:
                order.date_done = False

    def _compute_picking_transporteur(self):
        for order in self:
            picking = self.env['stock.picking'].search([
                ('origin', '=', order.name),
                ('state', '=', 'done')
            ], order='date_done DESC', limit=1)

            if picking and hasattr(picking, 'ourtransporteur') and picking.ourtransporteur:
                # If ourtransporteur is a Many2one field (res.partner), get the name
                if hasattr(picking.ourtransporteur, 'name'):
                    order.picking_transporteur = picking.ourtransporteur.name
                else:
                    # If it's already a string, use it directly
                    order.picking_transporteur = str(picking.ourtransporteur)
            elif picking and picking.carrier_id:
                order.picking_transporteur = picking.carrier_id.name
            else:
                order.picking_transporteur = False