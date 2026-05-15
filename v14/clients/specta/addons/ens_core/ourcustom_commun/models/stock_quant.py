from odoo import models, fields, api, _

class StockQuant(models.Model):
    _inherit = "stock.quant"

    categ_id = fields.Many2one('product.category', 'Catégorie Article',
                               readonly=True, related='product_id.categ_id', store=True)