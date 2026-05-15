from odoo import fields, models, api, _

class AchatOrigine(models.Model):
    _inherit = "purchase.order"

    #This field will be fill automatically while creationg PurchaseOrder From SaleOrder
    #By the overrided method: action_create_purchase_order in python file: wizard/purchase_order_wizard_inherit.py

    vente_origine = fields.Many2one('sale.order', string='Vente Origine',
                                    help="La référence du commande vente a partir de laquelle a été générer cette commande d'achat")


class CreatedPurchaseOrder(models.Model):
    _inherit = "sale.order"

    ##Nombre de Purchase Order creer a partir de ce Sale Order
    our_purchase_count = fields.Integer("Numero de Commande Achat", compute="_our_purchase_count", readonly=True)

    def _our_purchase_count(self):
        purchase_ids = self.env['purchase.order'].search([('vente_origine', '=', self.name)])
        self.our_purchase_count = len(purchase_ids)

    def action_view_our_purchase(self):
        #################
        # This function returns an action that display existing purchase orders
        # of given sales order ids. It can either be a in a list or in a form
        # view, if there is only one delivery order to show.
        #################
        purchase_obj = self.env['purchase.order'].search([('vente_origine', '=', self.name)])
        purchase_ids = []
        for purchase in purchase_obj:
            purchase_ids.append(purchase.id)
        view_id = self.env.ref('purchase.purchase_order_form').id
        ctx = dict(
            create=False,
        )
        if purchase_ids:
            if len(purchase_ids) <= 1:
                value = {
                    'view_mode': 'form',
                    'res_model': 'purchase.order',
                    'view_id': view_id,
                    'type': 'ir.actions.act_window',
                    'name': 'Achat',
                    'context': ctx,
                    'res_id': purchase_ids and purchase_ids[0]
                }
            else:
                value = {
                    'domain': str([('id', 'in', purchase_ids)]),
                    'view_mode': 'tree,form',
                    'res_model': 'purchase.order',
                    'view_id': False,
                    'type': 'ir.actions.act_window',
                    'context': ctx,
                    'name': 'Achat',
                    'res_id': purchase_ids
                }
            return value