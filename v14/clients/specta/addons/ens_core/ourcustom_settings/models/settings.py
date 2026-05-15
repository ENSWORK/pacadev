from odoo import fields, models, api

# IMPORTANT !!!
# -The settings view will not show just if you add uer to group 'ENS' by UI
#

class OurcustomSettings(models.TransientModel):
    _inherit = 'res.config.settings'

#    -- Used to Show or hide BL N° From INVOICE Reports
    show_bl_num = fields.Boolean(string="Afficher BL N° sur la facture", default=False)

#    -- Used to show or hide button "Marqué comme vendue"
    show_btn_force_inv_status = fields.Boolean(string="Forcer état de la facture")

#    -- Used to make Phone field required and unique for 'Individual' Partners
    phone_status = fields.Boolean(string="Tél Unique/Obligatoire", default=False)

    def set_values(self):
        res = super(OurcustomSettings, self).set_values()
#        set field value
        config_parameter = self.env['ir.config_parameter'].sudo()
        config_parameter.set_param('ourcustom_settings.show_bl_num', self.show_bl_num)
        config_parameter.set_param('ourcustom_settings.show_btn_force_inv_status', self.show_btn_force_inv_status)
        config_parameter.set_param('ourcustom_settings.phone_status', self.phone_status)
#        update field1 value in account.move
        invoices = self.env['account.move'].sudo().search([])
        for inv in invoices:
            inv.show_hide_bl_num = self.show_bl_num

#        update field2 value in sale.order
        sales = self.env['sale.order'].sudo().search([])
        for order in sales:
            order.show_hide_btn_force_inv_status = self.show_btn_force_inv_status

#        update field3 value in res.partner
        partners = self.env['res.partner'].sudo().search([])
        for part in partners:
            part.phone_required_unique = self.phone_status
        return res


    @api.model
    def get_values(self):
        res = super(OurcustomSettings, self).get_values()
        ICPsudo = self.env['ir.config_parameter'].sudo()
        show_bl_num = ICPsudo.get_param('ourcustom_settings.show_bl_num')
        show_btn_force_inv_status = ICPsudo.get_param('ourcustom_settings.show_btn_force_inv_status')
        phone_status = ICPsudo.get_param('ourcustom_settings.phone_status')
        res.update(
            show_bl_num=show_bl_num,
            show_btn_force_inv_status=show_btn_force_inv_status,
            phone_status=phone_status,
        )
        return res


