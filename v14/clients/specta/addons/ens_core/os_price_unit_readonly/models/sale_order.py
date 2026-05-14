# -*- coding: utf-8 -*-
# 2020 ® - By Osis

from odoo import api, models, fields


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    price_unit_stored = fields.Float(
        string='Unit price',
        related='price_unit',
        store=True,
        copy=True,
        digits='Product Price'
    )
