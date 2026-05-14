from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError


class FactureReport(models.Model):
    _inherit = 'account.move'

    def _get_report_base_filename(self):
        if self.move_type == 'in_invoice':
            return 'Facture N° %s - Fournisseur %s ' % (self.name, self.partner_id.name)
        else:
            return 'Facture N° %s - Client %s ' % (self.name, self.partner_id.name)
