from odoo import models, fields, api

class ProductCategory(models.Model):
    _inherit = 'product.category'

    # Utilisation du champ Image standard avec stockage explicite
    image_1920 = fields.Image("Image", max_width=1920, max_height=1920, store=True)

    product_count = fields.Integer(compute='_compute_product_count', string='Nombre de produits')

    @api.depends()
    def _compute_product_count(self):
        for category in self:
            category.product_count = self.env['product.template'].search_count([
                ('categ_id', '=', category.id)
            ])

    def action_view_products(self):
        self.ensure_one()
        return {
            'name': 'Produits de la catégorie %s' % self.name,
            'type': 'ir.actions.act_window',
            'res_model': 'product.template',
            'view_mode': 'kanban,tree,form',
            'domain': [('categ_id', '=', self.id)],
            'context': {},
        }
