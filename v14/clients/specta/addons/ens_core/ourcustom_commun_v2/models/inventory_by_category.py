from odoo import fields, models, api, _
from odoo.osv import expression

class InventoryByCategory(models.Model):
    _inherit = "stock.inventory"


    product_cetegory = fields.Many2many('product.category', string="Catégories d'articles", readonly=True, states={'draft': [('readonly', False)]},
                                        help="Spécifier des catégories pour limiter votre inventaire a certaines catégories")

    @api.onchange('product_cetegory')
    def onchange_product_cetegory(self):
        for rec in self:
            #clear selected articles
            rec.product_ids = [(5, 0, 0)]
            if len(rec.product_cetegory) >= 1:
                ids = []
                for categ in rec.product_cetegory:
                    # get product_ids of every category
                    products_obj = self.env['product.product'].search([('categ_id', '=', categ._origin.id)])
                    if products_obj:
                        for product in products_obj:
                            ids.append(product.id)
                return {'domain': {'product_ids': [('type', '=', 'product'), '|', ('company_id', '=', False), ('company_id', '=', rec.company_id), ('id', 'in', ids)]}}
            return {'domain': {'product_ids': [('type', '=', 'product'), '|', ('company_id', '=', False), ('company_id', '=', rec.company_id)]}}


    #---- Override the function that open inventory mouvement view to spicify the view (with or without create )
    def action_open_inventory_lines(self):
        self.ensure_one()
        action = {
            'type': 'ir.actions.act_window',
            'view_mode': 'tree',
            'name': _('Inventory Lines'),
            'res_model': 'stock.inventory.line',
        }
        context = {
            'default_is_editable': True,
            'default_inventory_id': self.id,
            'default_company_id': self.company_id.id,
        }
        # Define domains and context
        domain = [
            ('inventory_id', '=', self.id),
            ('location_id.usage', 'in', ['internal', 'transit'])
        ]
        if self.location_ids:
            context['default_location_id'] = self.location_ids[0].id
            if len(self.location_ids) == 1:
                if not self.location_ids[0].child_ids:
                    context['readonly_location_id'] = True

        if self.product_ids:
            # no_create on product_id field
            action['view_id'] = self.env.ref('stock.stock_inventory_line_tree_no_product_create').id
            if len(self.product_ids) == 1:
                context['default_product_id'] = self.product_ids[0].id

        #------------MODIF---------------------
            #--- If no product selected but there is categories
        elif self.product_cetegory and not self.product_ids:
            # no_create on product_id field
            action['view_id'] = self.env.ref('stock.stock_inventory_line_tree_no_product_create').id
        #------------MODIF FIN!----------------
        else:
            # no product_ids => we're allowed to create new products in tree
            action['view_id'] = self.env.ref('stock.stock_inventory_line_tree').id

        action['context'] = context
        action['domain'] = domain
        return action

           #----------------Override function _get_quantities & _get_exhausted_inventory_lines_vals
        #----------These Functions are used in function  that create inventory lines  _get_inventory_lines_values

    # Without Exhausted Products (Les articles epuisés)
    def _get_quantities(self):
        """Return quantities group by product_id, location_id, lot_id, package_id and owner_id

        :return: a dict with keys as tuple of group by and quantity as value
        :rtype: dict
        """
        self.ensure_one()
        if self.location_ids:
            domain_loc = [('id', 'child_of', self.location_ids.ids)]
        else:
            domain_loc = [('company_id', '=', self.company_id.id), ('usage', 'in', ['internal', 'transit'])]
        locations_ids = [l['id'] for l in self.env['stock.location'].search_read(domain_loc, ['id'])]

        domain = [('company_id', '=', self.company_id.id),
                  ('quantity', '!=', '0'),
                  ('location_id', 'in', locations_ids)]
        if self.prefill_counted_quantity == 'zero':
            domain.append(('product_id.active', '=', True))

        if self.product_ids:
            domain = expression.AND([domain, [('product_id', 'in', self.product_ids.ids)]])

        # ------------MODIF---------------------
        if self.product_cetegory and not self.product_ids:
            ids = []
            for categ in self.product_cetegory:
                # get product_ids of every category
                products_obj = self.env['product.product'].search([('type', '=', 'product'), ('categ_id', '=', categ.id)])
                if products_obj:
                    for product in products_obj:
                        ids.append(product.id)
            domain = expression.AND([domain, [('product_id', 'in', ids)]])
        # ------------MODIF FIN!----------------

        fields = ['product_id', 'location_id', 'lot_id', 'package_id', 'owner_id', 'quantity:sum']
        group_by = ['product_id', 'location_id', 'lot_id', 'package_id', 'owner_id']

        quants = self.env['stock.quant'].read_group(domain, fields, group_by, lazy=False)
        return {(
            quant['product_id'] and quant['product_id'][0] or False,
            quant['location_id'] and quant['location_id'][0] or False,
            quant['lot_id'] and quant['lot_id'][0] or False,
            quant['package_id'] and quant['package_id'][0] or False,
            quant['owner_id'] and quant['owner_id'][0] or False):
            quant['quantity'] for quant in quants
        }

    # With Exhausted Products (Les articles epuisés)
    def _get_exhausted_inventory_lines_vals(self, non_exhausted_set):
        """Return the values of the inventory lines to create if the user
        wants to include exhausted products. Exhausted products are products
        without quantities or quantity equal to 0.

        :param non_exhausted_set: set of tuple (product_id, location_id) of non exhausted product-location
        :return: a list containing the `stock.inventory.line` values to create
        :rtype: list
        """
        self.ensure_one()
        if self.product_ids:
            product_ids = self.product_ids.ids

        # ------------MODIF---------------------
        elif self.product_cetegory and not self.product_ids:
            ids = []
            for categ in self.product_cetegory:
                # get product_ids of every category
                products_obj = self.env['product.product'].search([('type', '=', 'product'), ('categ_id', '=', categ.id)])
                if products_obj:
                    for product in products_obj:
                        ids.append(product.id)
            product_ids = ids
        # ------------MODIF FIN!----------------

        else:
            product_ids = self.env['product.product'].search_read([
                '|', ('company_id', '=', self.company_id.id), ('company_id', '=', False),
                ('type', '=', 'product'),
                ('active', '=', True)], ['id'])
            product_ids = [p['id'] for p in product_ids]

        if self.location_ids:
            location_ids = self.location_ids.ids
        else:
            location_ids = self.env['stock.warehouse'].search([('company_id', '=', self.company_id.id)]).lot_stock_id.ids

        vals = []
        for product_id in product_ids:
            for location_id in location_ids:
                if ((product_id, location_id) not in non_exhausted_set):
                    vals.append({
                        'inventory_id': self.id,
                        'product_id': product_id,
                        'location_id': location_id,
                        'theoretical_qty': 0
                    })
        return vals


class InventoryLineByCategory(models.Model):
    _inherit = "stock.inventory.line"

    #Override the function
    @api.model
    def _domain_product_id(self):
        if self.env.context.get('active_model') == 'stock.inventory':
            inventory = self.env['stock.inventory'].browse(self.env.context.get('active_id'))
            #-----Inventory By Category
            if inventory.exists():
                #---- If products are selected
                if len(inventory.product_ids) > 1:
                    return "[('type', '=', 'product'), '|', ('company_id', '=', False), ('company_id', '=', company_id), ('id', 'in', %s)]" % inventory.product_ids.ids
                #---- If there is no products but Categories are filled
                if len(inventory.product_cetegory) >= 1 and not inventory.product_ids:
                    ids = []
                    for categ in inventory.product_cetegory:
                        # get product_ids of every category
                        products_obj = self.env['product.product'].search([('categ_id', '=', categ.id)])
                        for product in products_obj:
                            ids.append(product.id)
                    return "[('type', '=', 'product'), '|', ('company_id', '=', False), ('company_id', '=', company_id), ('id', 'in', %s)]" % ids
        return "[('type', '=', 'product'), '|', ('company_id', '=', False), ('company_id', '=', company_id)]"
