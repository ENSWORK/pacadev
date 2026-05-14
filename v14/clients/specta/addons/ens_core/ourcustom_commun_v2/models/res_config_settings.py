from odoo import api, models, fields


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    check_product_sale_price = fields.Boolean(string="Vérifier le prix de vente du produit")
    min_discount_by_categ = fields.Boolean(string="Remise minimum par catégorie d'article")

    def set_values(self):
        res = super(ResConfigSettings, self).set_values()
        config_parameter = self.env['ir.config_parameter'].sudo()
        config_parameter.set_param('ourcustom_commun_v2.check_product_sale_price', self.check_product_sale_price)
        config_parameter.set_param('ourcustom_commun_v2.min_discount_by_categ', self.min_discount_by_categ)
        return res


    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        ICPsudo = self.env['ir.config_parameter'].sudo()
        check_product_sale_price = ICPsudo.get_param('ourcustom_commun_v2.check_product_sale_price')
        min_discount_by_categ = ICPsudo.get_param('ourcustom_commun_v2.min_discount_by_categ')
        res.update(
            check_product_sale_price=check_product_sale_price,
            min_discount_by_categ=min_discount_by_categ,
        )
        return res
