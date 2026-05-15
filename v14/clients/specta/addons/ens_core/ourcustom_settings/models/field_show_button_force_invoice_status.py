from odoo import fields, models, api, _

class SaleOrderShowButton(models.Model):
    _inherit = 'sale.order'

    # The field value is related to field show_btn_force_inv_status from Enswork settings
    show_hide_btn_force_inv_status = fields.Boolean(string="Afficher marqué comme vendue", readonly=True, compute='_get_show_hide_btn_force_inv_status')

    # get value from settings
    def _get_show_hide_btn_force_inv_status(self):
        for rec in self:
            show_hide_btn_force_inv_status = self.env['ir.config_parameter'].sudo().get_param('ourcustom_settings.show_btn_force_inv_status')
            rec.update({
                'show_hide_btn_force_inv_status': show_hide_btn_force_inv_status,
            })

