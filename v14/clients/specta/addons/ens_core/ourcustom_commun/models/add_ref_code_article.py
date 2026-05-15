from odoo import models, fields, api, _

class ProductReference(models.Model):
    _inherit = "product.template"

#Ajouter Champs Reference d'Article
    ref_article = fields.Char("Code d'Article")

class ProductCategoryCode(models.Model):
    _inherit = "product.category"

#Ajouter Code de Categorie
    code_categ = fields.Char('Code')


