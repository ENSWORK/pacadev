
#
# JUST IGNORE ALL OF THIS
# BY DEFAULT ODOO SET THE PRICE FROM SELLER BASED ON partner_id
# if there is no record in seller table it use standard price (Cout)
#


from odoo import api, fields, models, _
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT


class PurchaseOrderPrice(models.Model):
    _inherit = "purchase.order.line"
    # """
    # Override OnchangeFunction to avoid Changes of price unit while changing  product_qty or product_uom
    # """
    @api.onchange('product_qty', 'product_uom')
    def _onchange_quantity(self):
        if not self.product_id:
            return
        params = {'order_id': self.order_id}
        seller = self.product_id._select_seller(
            partner_id=self.partner_id,
            quantity=self.product_qty,
            date=self.order_id.date_order and self.order_id.date_order.date(),
            uom_id=self.product_uom,
            params=params)

        if seller or not self.date_planned:
            self.date_planned = self._get_date_planned(seller).strftime(DEFAULT_SERVER_DATETIME_FORMAT)


