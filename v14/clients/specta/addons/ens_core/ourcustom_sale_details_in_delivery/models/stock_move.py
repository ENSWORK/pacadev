from odoo import _, api, fields, tools, models
from odoo.tools.misc import formatLang, get_lang
from functools import partial
import logging

_logger = logging.getLogger(__name__)


class StockMove(models.Model):
    _inherit = "stock.move"

    sale_currency_id = fields.Many2one('res.currency', related='sale_line_id.currency_id', store=True,
                                       help="Linked Sale Order Currency")
    price_unit = fields.Float('Prix Unitaire', required=True, digits='Product Price', default=0.0,
                              related='sale_line_id.price_unit')
    tax_id = fields.Many2many('account.tax', string='Taxes', related='sale_line_id.tax_id',
                              domain=['|', ('active', '=', False), ('active', '=', True)])
    discount = fields.Float(string='Remise (%)', digits='Discount', default=0.0, related='sale_line_id.discount')

    price_subtotal = fields.Monetary(compute='_compute_amount', string='Subtotal', currency_field='sale_currency_id',
                                     readonly=True, store=True)
    price_tax = fields.Float(compute='_compute_amount', string='Total Tax', currency_field='sale_currency_id',
                             readonly=True, store=True)
    price_total = fields.Monetary(compute='_compute_amount', string='Total', currency_field='sale_currency_id',
                                  readonly=True, store=True)

    @api.depends('quantity_done', 'discount', 'price_unit', 'tax_id')
    def _compute_amount(self):
        """
        Compute the amounts of the Delivery line.
        """
        for line in self:
            price = line.price_unit * (1 - (line.discount or 0.0) / 100.0)
            taxes = line.tax_id.compute_all(price, line.sale_currency_id, line.quantity_done, product=line.product_id,
                                            partner=line.picking_id.partner_id)
            line.update({
                'price_tax': sum(t.get('amount', 0.0) for t in taxes.get('taxes', [])),
                'price_total': taxes['total_included'],
                'price_subtotal': taxes['total_excluded'],
            })


class StockPicking(models.Model):
    _inherit = "stock.picking"

    sale_currency_id = fields.Many2one('res.currency', related='sale_id.currency_id', store=True,
                                       help="Linked Sale Order Currency")
    amount_untaxed = fields.Monetary(string='Total HT', store=True, readonly=True,  currency_field='sale_currency_id',
                                     compute='_amount_all')
    amount_by_group = fields.Binary(string="Tax amount by group", compute='_amount_by_group',
                                    help="type: [(name, amount, base, formated amount, formated base)]")
    amount_tax = fields.Monetary(string='Taxes', store=True, readonly=True,  currency_field='sale_currency_id',
                                 compute='_amount_all')
    amount_total = fields.Monetary(string='Total TTC', store=True, readonly=True,  currency_field='sale_currency_id',
                                   compute='_amount_all')

    @api.depends('move_ids_without_package.price_total')
    def _amount_all(self):
        """
        Compute the total amounts of the Delivery.
        """
        for picking in self:
            amount_untaxed = amount_tax = 0.0
            for line in picking.move_ids_without_package:
                amount_untaxed += line.price_subtotal
                amount_tax += line.price_tax
            picking.update({
                'amount_untaxed': amount_untaxed,
                'amount_tax': amount_tax,
                'amount_total': amount_untaxed + amount_tax,
            })

    def _amount_by_group(self):
        for picking in self:
            currency = picking.sale_currency_id or picking.company_id.currency_id
            fmt = partial(formatLang, self.with_context(lang=picking.partner_id.lang).env, currency_obj=currency)
            res = {}
            for line in picking.move_ids_without_package:
                price_reduce = line.price_unit * (1.0 - line.discount / 100.0)
                taxes = line.tax_id.compute_all(price_reduce, quantity=line.quantity_done, product=line.product_id,
                                                partner=picking.partner_id)['taxes']
                for tax in line.tax_id:
                    group = tax.tax_group_id
                    res.setdefault(group, {'amount': 0.0, 'base': 0.0})
                    for t in taxes:
                        if t['id'] == tax.id or t['id'] in tax.children_tax_ids.ids:
                            res[group]['amount'] += t['amount']
                            res[group]['base'] += t['base']
            res = sorted(res.items(), key=lambda l: l[0].sequence)
            picking.amount_by_group = [(
                l[0].name, l[1]['amount'], l[1]['base'],
                fmt(l[1]['amount']), fmt(l[1]['base']),
                len(res),
            ) for l in res]
