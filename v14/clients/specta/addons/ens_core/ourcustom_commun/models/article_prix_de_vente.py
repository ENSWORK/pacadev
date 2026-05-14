from odoo import api, fields, models, _


class ProductCategory(models.Model):
    _inherit = "product.category"

    coefficient = fields.Float('Coefficient')


class ProductTemplate(models.Model):
    _inherit = "product.template"

    coefficient_art = fields.Float('Coeficient', compute='_compute_get_coefficient', readonly=False, store=True)
    prix_de_vente_auto = fields.Float('Prix de vente Calculé', compute='_compute_prix_de_vente', store=True)

    #Override the field list_price add: related,readonly,store
    list_price = fields.Float(
        'Sales Price', default=1.0,
        digits='Product Price',
        help="Price at which the product is sold to customers.", related='prix_de_vente_auto', readonly=False, store=True)

    @api.depends('categ_id')
    def _compute_get_coefficient(self):
        for record in self:
            coefficient_art = 0.0;
            if (record.categ_id):
                coefficient_art = record.categ_id.coefficient
            record.update({
                'coefficient_art': coefficient_art,
            })


    @api.depends('standard_price','coefficient_art')
    def _compute_prix_de_vente(self):
        for record in self:
            res = self.env['product.template'].search([('id','=',record._origin.id)],limit=1)
            prix_de_vente_auto = res.list_price
            if(record.standard_price != 0.0 and record.coefficient_art != 0.0):
                prix_de_vente_auto = record.standard_price * record.coefficient_art

        record.update({
            'prix_de_vente_auto': prix_de_vente_auto,
        })

    reference_fournisseur = fields.Char("Référence Fourniseur")




