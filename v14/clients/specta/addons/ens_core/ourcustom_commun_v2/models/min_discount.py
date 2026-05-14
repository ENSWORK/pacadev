from odoo import api, fields, models, _
from odoo.exceptions import UserError


class MinDiscount(models.Model):
    _inherit = "product.category"

    min_discount = fields.Float("Remise minimale")
    use_min_discount = fields.Boolean('Use min Discount', compute='get_min_discount_param')

    def get_min_discount_param(self):
        use_min_discount = False
        for categ in self:
            min_discount_by_categ_param = self.env['ir.config_parameter'].sudo().get_param('ourcustom_commun_v2.min_discount_by_categ')
            if min_discount_by_categ_param:
                use_min_discount = True
            else:
                use_min_discount = False
            categ.update({
                'use_min_discount': use_min_discount,
            })


class SaleDiscountCheck(models.Model):
    _inherit = "sale.order.line"

    @api.onchange('discount')
    def onchange_of_discount(self):
        min_discount_by_categ_param = self.env['ir.config_parameter'].sudo().get_param('ourcustom_commun_v2.min_discount_by_categ')
        if min_discount_by_categ_param:
            for line in self:
                # Min discout is set in category
                categ_min_disc = line.product_id.categ_id.min_discount
                if categ_min_disc != 0.0 and line.discount != 0.0:
                    if line.discount < categ_min_disc:
                        raise UserError(_(
                            "La Remise saisie doit être supérieure ou égale à la remise renseignée dans la catégorie du produit.\n"
                            "(Remise minimale = %s ; Remise saisie = %s)"
                        )
                                        % (format(categ_min_disc, ".2f"), format(line.discount, ".2f"))
                                        )
