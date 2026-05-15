from odoo import fields, models, api, _

class AccountMoveImp(models.Model):
    _inherit = 'account.move'

    # The field value is related to field show_bl_num from Enswork settings
    show_hide_bl_num = fields.Boolean(string="Afficher BL N° sur la facture", readonly=True, compute='_get_show_bl_num')

    # get value from settings
    def _get_show_bl_num(self):
        for rec in self:
            show_hide_bl_num = self.env['ir.config_parameter'].sudo().get_param('ourcustom_settings.show_bl_num')
            rec.update({
                'show_hide_bl_num': show_hide_bl_num,
            })

