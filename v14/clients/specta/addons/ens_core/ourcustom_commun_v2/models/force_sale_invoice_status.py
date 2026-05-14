from odoo import models, fields, api, _


class SaleOrderInvoiceStatus(models.Model):
    _inherit = "sale.order"

    #override field invoice_status to add another state

    invoice_status = fields.Selection([
        ('upselling', 'Upselling Opportunity'),
        ('invoiced', 'Fully Invoiced'),
        ('to invoice', 'To Invoice'),
        ('no', 'Nothing to Invoice'),
        ('cmd vendue', 'Commande Vendue')
        ], string='Invoice Status', compute='_get_invoice_status', store=True, readonly=True)


    def action_force_sale_invoice_status(self):
        for invoice in self:
            for line in invoice.order_line:
                line.invoice_status = 'cmd vendue'
            invoice.invoice_status = 'cmd vendue'


class SaleOrderLineInvoiceStatus(models.Model):
    _inherit = "sale.order.line"

    # override field invoice_status to add another state

    invoice_status = fields.Selection([
        ('upselling', 'Upselling Opportunity'),
        ('invoiced', 'Fully Invoiced'),
        ('to invoice', 'To Invoice'),
        ('no', 'Nothing to Invoice'),
        ('cmd vendue', 'Commande Vendue')
    ], string='Invoice Status', compute='_compute_invoice_status', store=True, readonly=True, default='no')
