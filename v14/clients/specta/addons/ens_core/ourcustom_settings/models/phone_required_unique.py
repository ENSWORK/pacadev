from odoo import fields, models, api, _

class PhoneRequiredUnique(models.Model):
    _inherit = 'res.partner'

    # The field value is related to field phone_status from Enswork settings
    phone_required_unique = fields.Boolean(string="Tél Unique/Obligatoire", readonly=True, compute='_get_phone_status',
                                           help="If == True, The Phone Number will be Unique and required for 'Individual' Partners")

    # get value from settings
    def _get_phone_status(self):
        for rec in self:
            phone_status = self.env['ir.config_parameter'].sudo().get_param('ourcustom_settings.phone_status')
            rec.update({
                'phone_required_unique': phone_status,
            })

