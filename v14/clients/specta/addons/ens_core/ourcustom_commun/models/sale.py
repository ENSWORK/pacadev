from odoo import fields, models, api , _

###################################################
# We inherit sale.order.line to add Calculated Field "Reste A Facturer"
###################################################

class SaleOrderLineComm(models.Model):
    _inherit = "sale.order.line"

    # Le Reste A Facturer par chaque ligne d'article
    #rest_to_ivoice = fields.Monetary(string='HT Reste A Facturer', readonly=True, compute="_compute_rest_to_invoice_amount",store=True)
    #rest_to_ivoice_tax = fields.Monetary(string='TAX Reste A Facturer', readonly=True, compute="_compute_rest_to_invoice_amount",store=True)
    #rest_to_ivoice_ttc = fields.Monetary(string='TTC Reste A Facturer', readonly=True, compute="_compute_rest_to_invoice_amount",store=True)

    #@api.depends('qty_to_invoice', 'price_unit', 'discount')
    #def _compute_rest_to_invoice_amount(self):
        #for line in self:
            #price = line.price_unit * (1 - (line.discount or 0.0) / 100.0)
            #taxes = line.tax_id.compute_all(price, line.order_id.currency_id, line.qty_to_invoice,product=line.product_id, partner=line.order_id.partner_shipping_id)
            #line.update({
                #'rest_to_ivoice': taxes['total_excluded'],
                #'rest_to_ivoice_tax': sum(t.get('amount', 0.0) for t in taxes.get('taxes', [])),
                #'rest_to_ivoice_ttc': taxes['total_included'],

            #})

class SaleOrderComm(models.Model):
    _inherit = "sale.order"

    # Le Reste A Facturer Total du SO Note:On va afficher seulement Le Reste à Facturer TTC
    #amount_rest_to_invoice_ht = fields.Monetary(string="Reste A Facturer HT", compute="_compute_amount_rest_to_invoice", store=True)
    #amount_rest_to_invoice_ttc = fields.Monetary(string="Reste à Facturer", compute="_compute_amount_rest_to_invoice", store=True)

    #@api.depends('order_line.rest_to_ivoice_ttc')
    #def _compute_amount_rest_to_invoice(self):
        #for order in self:
            #amount_rest_to_invoice_ht = amount_rest_to_invoice_ttc = 0.0
            #for line in order.order_line:
                #amount_rest_to_invoice_ht += line.rest_to_ivoice
                #amount_rest_to_invoice_ttc += line.rest_to_ivoice_ttc
            #order.update({
                #'amount_rest_to_invoice_ht': amount_rest_to_invoice_ht,
                #'amount_rest_to_invoice_ttc': amount_rest_to_invoice_ttc,
            #})

    reste_a_facturer = fields.Monetary(string="Reste à Facturer", compute="_reste_a_facturer")
    def _reste_a_facturer(self):
        for order in self:
            reste_a_facturer = order.amount_total - order.invoiced_amount
            order.update({
                'reste_a_facturer': reste_a_facturer,
            })
