from odoo import models, fields, api, _

class InvoiceOrigin(models.Model):
    _inherit = 'account.move'

    #This Field is used in Model 'Import' in report  'Factures Import' File:report_factures_import.xml
    invoice_origin_sale = fields.Many2one('sale.order', string='Vente dOrigine', compute='_get_invoice_origin_sale')

    def _get_invoice_origin_sale(self):
        for inv in self:
            sr = self.env['sale.order'].search([('name','=',inv.invoice_origin)])
            if sr:
                inv.invoice_origin_sale = sr.id
            else:
                inv.invoice_origin_sale = False