from odoo import models, fields, api, _

class StockMoveInheritComm(models.Model):
    _inherit = "stock.move"


    # This field will take the price unit of article from command purchase
    # while creating the  Reception From Purchase Order by clicking button "Confirm Command"
    pa_command = fields.Float(string="Prix Unitaire Achat", help="Le prix Unitaire déclarée sur la commande Achat (PO)")
    currency_id = fields.Many2one('res.currency', string="Devise", help="Devise déclarée sur la commande Achat")
