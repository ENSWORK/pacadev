from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountMoveInherit(models.Model):
    _inherit = "account.move"

    def button_draft(self):
        for invoice in self:
            if invoice.payment_state in ('paid', 'partial'):
                raise ValidationError(
                    _('La facture est déjà Lettrée(Payée)!\nVeuillez d\'abord annuler le Lettrage(Paiement) de la facture.')
                )
            else:
                res = super(AccountMoveInherit, self).button_draft()
        return res
