from odoo import models, fields, api


class AddDateBonCommande(models.Model):
    _inherit = "sale.order"

    date_commande = fields.Date("Date de Bon Commande")
