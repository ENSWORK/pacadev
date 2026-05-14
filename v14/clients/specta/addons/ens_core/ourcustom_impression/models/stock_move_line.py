from odoo import api, fields, models

class StockMoveLineInhImp(models.Model):
    _inherit = 'stock.move.line'

    #Function used only in delivery report(BL) whre state=done

    def _get_aggregated_product_quantities_pr(self, **kwargs):
        """ Returns a dictionary of products (key = id+name+description+uom) and corresponding values of interest.

        Allows aggregation of data across separate move lines for the same product. This is expected to be useful
        in things such as delivery reports. Dict key is made as a combination of values we expect to want to group
        the products by (i.e. so data is not lost). This function purposely ignores lots/SNs because these are
        expected to already be properly grouped by line.

        returns: dictionary {product_id+name+description+uom: {product, name, description, qty_done, product_uom}, ...}
        """
        aggregated_move_lines = {}
        for move_line in self.sorted(key=lambda r: r.sl_no):
            name = move_line.product_id.display_name
            description = move_line.move_id.description_picking
            if description == name or description == move_line.product_id.name:
                description = False
            uom = move_line.product_uom_id
            line_key = str(move_line.product_id.id) + "_" + name + (description or "") + "uom " + str(uom.id)

            if line_key not in aggregated_move_lines:
                aggregated_move_lines[line_key] = {'name': name,
                                                   'description': description,
                                                   'qty_done': move_line.qty_done,
                                                   'product_uom': uom.name,
                                                   'product': move_line.product_id,
                                                   'pr_sale': move_line.move_id.sale_line_id.price_unit,
                                                   'pr_subtotal_sale': move_line.move_id.sale_line_id.price_subtotal,
                                                   'sl_no': move_line.sl_no,
                                                   'sale_line_id_name': move_line.move_id.sale_line_id.name,
                                                   'ourname': move_line.ourname,
                                                   'default_code': move_line.product_id.default_code,
                                                   }
            else:
                aggregated_move_lines[line_key]['qty_done'] += move_line.qty_done

        return aggregated_move_lines
