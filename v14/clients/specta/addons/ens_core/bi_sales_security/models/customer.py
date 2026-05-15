# -*- coding : utf-8 -*-
# Part of BrowseInfo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

class ResPartner(models.Model):
    _inherit = "res.partner"

    @api.model
    def default_get(self, vals):
        result = super(ResPartner, self).default_get(vals)

        result.update({
            'user_id' : self.env.user.id
        })

        return result

    @api.depends('company_type','is_company')
    def _check_company(self):
        for partner in self:
            comapny = self.env['res.company'].sudo().search([('partner_id','=',partner.id)])
            if comapny:
                partner_company = True
            else:
                partner_company = False

            partner.update({
                'is_company_user' : partner_company
            })

    allowed_user_ids = fields.Many2many('res.users', 'res_partner_users_sale_rel', string="Allowed Users")
    is_company_user = fields.Boolean(string='Is Company Partner', compute="_check_company", store=True)


class ResCompany(models.Model):
    _inherit = 'res.company'

    @api.model
    def create(self, vals):
        comapny = super(ResCompany, self).create(vals)

        if comapny.partner_id:
            comapny.partner_id.write({
                'is_company_user' : True
            })

        return comapny