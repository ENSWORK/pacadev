# -*- coding : utf-8 -*-
# Part of BrowseInfo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

class ResPartner(models.TransientModel):
    _name = "res.partner.allowed"
    _description = "Allow Partner to SalesPerson"

    allowed_user_ids = fields.Many2many('res.users', 'res_partner_users_sale_wizard_rel', string="Allow Users to Access Customers")

    def assign_users(self):
        for wizard in self:
            user_list = []
            active_ids = self._context.get('active_ids',[])
            active_model = self._context.get('active_model')
            record_ids = self.env[active_model].browse(active_ids)
            for users in wizard.allowed_user_ids:
                user_list.append(users.id)

            if user_list:
                for record in record_ids:
                    record.write({
                        'allowed_user_ids' : [(6 , 0, user_list)]
                    })
            else:
                raise UserError(_('Please Select At least One User..!!!!'))

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: