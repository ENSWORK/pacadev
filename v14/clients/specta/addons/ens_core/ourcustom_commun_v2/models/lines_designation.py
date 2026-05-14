from odoo import fields, models, api, _

class AccountMoveLineDesignation(models.Model):
    _inherit = "account.move.line"


#Inherit existing Function to edit line.name (Libelle)
    @api.onchange('product_id')
    def _onchange_product_id(self):
        vals = super(AccountMoveLineDesignation, self)._onchange_product_id()
            #SALE
        if self.move_id.move_type in ('out_invoice', 'out_refund'):
            if self.product_id.description_sale:
                self.name = self.product_id.name + "\n" + self.product_id.description_sale
            else:
                self.name = self.product_id.name
            #PURCHASE
        elif self.move_id.move_type in ('in_invoice', 'in_refund'):
            if self.product_id.description_purchase:
                self.name = self.product_id.name + "\n" + self.product_id.description_purchase
            else:
                self.name = self.product_id.name
            #ELSE
        else:
            self.name = self.product_id.name
        return vals


class PurchaseOrderLineDesignation(models.Model):
    _inherit = 'purchase.order.line'

    def _product_id_change(self):
        vals = super(PurchaseOrderLineDesignation, self)._product_id_change()
        if self.product_id.description_purchase:
            self.name = self.product_id.name + "\n" + self.product_id.description_purchase
        else:
            self.name = self.product_id.name
        return vals


class SaleOrderLineDesignation(models.Model):
    _inherit = 'sale.order.line'

    @api.onchange("product_id")
    def product_id_change(self):
        vals = super(SaleOrderLineDesignation, self).product_id_change()
        if self.product_id.description_sale:
            self.name = self.product_id.name + "\n" + self.product_id.description_sale
        else:
            self.name = self.product_id.name
        return vals


#Note For stock.move.line the edit made in model: ourcustom_commun in file show_product_description.py
