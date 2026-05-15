from odoo import api, fields, models


class PurchaseFieldContact(models.Model):
    _inherit = 'purchase.order'

    ourcontact = fields.Many2one('res.partner', string='Contact')
    ourtransporteurp = fields.Many2one('res.partner', "Transporteur", domain=[('ourtrs', '=', 'True')],
                                       help="Pour ajouter un contact a cette liste des transporteurs veuillez cocher la case 'Est un transporteur' dans la fiche contact")
    ouradrliv = fields.Many2one('stock.warehouse', 'Adresse de livraison')

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        domain = {'ourcontact': [('parent_id', "=", self.partner_id.id)]}
        return {'domain': domain}


class SaleFieldContact(models.Model):
    _inherit = 'sale.order'

    ourcontact = fields.Many2one('res.partner', string='Contact')

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        domain = {'ourcontact': [('parent_id', "=", self.partner_id.id)]}
        return {'domain': domain}


class SaleFieldDelai(models.Model):
    _inherit = 'sale.order.line'

    ourdelai = fields.Char('Délai de livraison')


class StockFieldTrs(models.Model):
    _inherit = 'stock.picking'

    ourtransporteur = fields.Many2one('res.partner', "Transporteur", domain=[('ourtrs', '=', 'True')])


class PartnerFieldBoll(models.Model):
    _inherit = 'res.partner'

    ourtrs = fields.Boolean("Est un Transporteur")
