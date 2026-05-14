from odoo import api, fields, models, _
from odoo.exceptions import ValidationError, RedirectWarning, UserError


class Partner(models.Model):
    _inherit = "res.partner"

    verifier_ice = fields.Boolean(string="ICE verification", default=True)

    @api.constrains('vat')
    def _check_if_vat_exist(self):
        for record in self:
            if record.vat:
                new_value = record.vat
                if len(new_value) != 15 and record.verifier_ice:
                    raise ValidationError(
                        _('L\'ICE " %s " Doit etre composée de 15 caractères.')
                        % (
                            record.vat,
                        )
                    )

                if record.is_company:
                    existing_records = self.env['res.partner'].search(
                        [['vat', '=', new_value], ['is_company', '=', 'True']])
                    if len(existing_records) > 1:
                        raise ValidationError(
                            _('L\'ICE Doit Etre Unique !. Une Société avec l\'ICE " %s " Existe Déja.')
                            % (
                                record.vat,
                            )
                        )

        return True
