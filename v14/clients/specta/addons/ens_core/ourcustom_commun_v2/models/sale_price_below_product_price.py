from odoo import models, fields, api, _
from odoo.exceptions import UserError


class SaleVsProductPrice(models.Model):
    _inherit = "sale.order.line"

    @api.onchange('price_unit')
    def onchange_priceunit(self):
        check_product_sale_price_param = self.env['ir.config_parameter'].sudo().get_param('ourcustom_commun_v2.check_product_sale_price')
        if check_product_sale_price_param:
            for line in self:
                if line.product_id:
                    product_price = line.product_id.list_price
                    if line.price_unit < product_price:
                        raise UserError(_("Le prix de vente saisi est moins du prix de vente sur l'article!"))
