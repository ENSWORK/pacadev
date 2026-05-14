
import time
from odoo import api, fields, models, _
from datetime import datetime
import odoo.addons.decimal_precision as dp
from odoo.exceptions import UserError

###########################################################
#I inherited this model to show the Purchase Order
# created when clicking on button: Create Purchase Order
###########################################################

class createpurchaseorderinherit(models.TransientModel):
	_inherit = 'create.purchaseorder'


	#Override The Original Function : action_create_purchase_order
	def action_create_purchase_order(self):
		#------------------------------ORIGINAL CODE---------------------------------------
		self.ensure_one()
		res = self.env['purchase.order'].browse(self._context.get('id', []))
		value = []
		so = self.env['sale.order'].browse(self._context.get('active_id'))
		pricelist = self.partner_id.property_product_pricelist
		partner_pricelist = self.partner_id.property_product_pricelist
		sale_order_id = so.id #I added This custom line to use it in achat_origin bellow
		sale_order_name = ""
		for data in self.new_order_line_ids:
			sale_order_name = data.order_id.name
			if not sale_order_name:
				sale_order_name = so.name
			if partner_pricelist:
				product_context = dict(self.env.context, partner_id=self.partner_id.id, date=self.date_order,
									   uom=data.product_uom.id)
				final_price, rule_id = partner_pricelist.with_context(product_context).get_product_price_rule(
					data.product_id, data.product_qty or 1.0, self.partner_id)

			else:
				final_price = data.product_id.standard_price
			value.append([0, 0, {
				'product_id': data.product_id.id,
				'name': data.name,
				'product_qty': data.product_qty,
				'order_id': data.order_id.id,
				'product_uom': data.product_uom.id,
				'taxes_id': data.product_id.supplier_taxes_id.ids,
				'date_planned': data.date_planned,
				'price_unit': final_price,
			}])
		res.create({
			'partner_id': self.partner_id.id,
			'date_order': str(self.date_order),
			'order_line': value,
			'origin': sale_order_name,
			'partner_ref': sale_order_name,
			'vente_origine': sale_order_id #I added This custom line
		})

		#---------------------------CUSTOM CODE:To Open the created PurchaseOrder-----------------------
		# Chercher PurchaseOrder avec document origine = name of this SaleOrder
		purchase_obj = self.env['purchase.order'].search([('origin', '=', sale_order_name)])
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
		return res


