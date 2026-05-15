from odoo import api, fields, models, _
from odoo.exceptions import ValidationError, RedirectWarning, UserError


        ########## CONTACT: Define 'phone_required' field and make it unique and required with specific form 06.22.33.44.55###########

class Partner(models.Model):
    _inherit = "res.partner"

    phone_required = fields.Char('Téléphone')
    @api.constrains('phone_required')
    def _phone_required_constrains(self):
        for record in self:
            if (record.company_type == 'person'):
                #check settings value
                phone_status = self.env['ir.config_parameter'].sudo().get_param('ourcustom_settings.phone_status')
                if phone_status:
                    if not record.phone_required:
                        raise ValidationError(
                            _('Le N° de Téléphone est Obligatoire pour les Particuliers.')
                        )
                    elif record.phone_required:
                        new_value = record.phone_required
                        #First check Syntax it must be like: 06.22.33.44.55
                        if len(new_value) == 14 \
                                and new_value[2] == "." and new_value[5] == "." and new_value[8] == "." and new_value[11] == "." \
                                and new_value[:2].isdigit() and new_value[3:5].isdigit() and new_value[6:8].isdigit() and new_value[9:11].isdigit() and new_value[12:].isdigit():
                            #if it's a valid Number --> Then check if it exists
                            existing_records = self.env['res.partner'].search([['phone_required', '=', new_value], ['company_type', '=', 'person']])
                            if len(existing_records) > 1:
                                raise ValidationError(
                                    _('Le N° de Téléphone Doit Etre Unique !. Une Particulier avec le N° " %s " Existe Déja.')
                                    % (
                                        record.phone_required,
                                    )
                                )
                        else:
                            raise ValidationError(
                                _('Format de N° de Téléphone Invalide!. Veuillez respecter la forme suivante: nn.nn.nn.nn.nn ex:06.86.55.44.33')
                            )
        return True
