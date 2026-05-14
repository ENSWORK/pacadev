# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) Sitaram Solutions (<https://sitaramsolutions.in/>).
#
#    For Module Support : info@sitaramsolutions.in  or Skype : contact.hiren1188
#
##############################################################################

from odoo import api, models, _
from odoo.exceptions import ValidationError


class srSaleOrderLine(models.Model):
    _inherit = 'sale.order.line'
    
    @api.onchange('discount')
    def check_discount_limit(self):
        if self.env.user.discount_limit != 0.00 and self.discount > self.env.user.discount_limit:
            message = "Vous ne pouvez attribuer qu'un maximum de " + str(self.env.user.discount_limit) + "% de remise\nContactez votre administrateur pour plus de détails"
            raise ValidationError(_(message))
    
    @api.constrains('discount')
    def check_discount_limit_constrains(self):
        for record in self:
            if self.env.user.discount_limit != 0.00 and round(record.discount, 2) > self.env.user.discount_limit:
                message = "Vous ne pouvez attribuer qu'un maximum de " + str(self.env.user.discount_limit) + "% de remise\nContactez votre administrateur pour plus de détails"
                raise ValidationError(_(message))

