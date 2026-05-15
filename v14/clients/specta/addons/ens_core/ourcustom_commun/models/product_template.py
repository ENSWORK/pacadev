from odoo import models, fields, api, _

class ProductTemplateInhImport(models.Model):
    _inherit = "product.template"


    code_douanier = fields.Char(string="Code Douanier")
    taxe_douaniere = fields.Float(string="Taxe Douanière")