from odoo import fields, models, api, _

class MaintenanceRequestOrg(models.Model):
    _inherit = 'maintenance.request'

    origin_sale = fields.Many2one('sale.order', string="Vente d'origine")


class SaleMaintenance(models.Model):
    _inherit = 'sale.order'

    ##Nombre de Demande de Maintenance creer a partir de ce Sale Order
    mnt_request_count = fields.Integer("Nombre de demande de maintenance", compute="_mnt_request_count", readonly=True)

    def _mnt_request_count(self):
        mnt_request_ids = self.env['maintenance.request'].search([('origin_sale', '=', self.name)])
        self.mnt_request_count = len(mnt_request_ids)


    def action_view_our_mnt_request(self):
        #################
        # This function returns an action that display existing maintenance resquests
        #################
        mnt_obj = self.env['maintenance.request'].search([('origin_sale', '=', self.id)])
        mnt_ids = []
        for mnt in mnt_obj:
            mnt_ids.append(mnt.id)
        view_id = self.env.ref('maintenance.hr_equipment_request_view_form').id
        ctx = dict(
            create=False,
        )
        if mnt_ids:
            if len(mnt_ids) <= 1:
                value = {
                    'view_mode': 'form',
                    'res_model': 'maintenance.request',
                    'view_id': view_id,
                    'type': 'ir.actions.act_window',
                    'name': 'Demande de maintenance',
                    'context': ctx,
                    'res_id': mnt_ids and mnt_ids[0]
                }
            else:
                value = {
                    'domain': str([('id', 'in', mnt_ids)]),
                    'view_mode': 'tree,form',
                    'res_model': 'maintenance.request',
                    'view_id': False,
                    'type': 'ir.actions.act_window',
                    'context': ctx,
                    'name': 'emande de maintenance',
                    'res_id': mnt_ids
                }
            return value

