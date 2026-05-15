from odoo import models, fields, api, _

class ProductNameBL(models.Model):
    _inherit = "stock.move.line"


    #Field will take product description declared in command
    #we will print it in BL report when state = done

    #Edit of 11-04-2022 : ourname still take product description declared in command if exist
    #If it doesn't exist it will take just name (+sale or purchase description if they exist) without Ref

    ourname = fields.Char(string="Description", compute='_get_command_description', store=True, readonly=False)


    @api.depends('product_id')
    def _get_command_description(self):
        for rec in self:
                #.Sale
            if rec.move_id.picking_type_id.code == 'outgoing':
                #If it's linked to a Sale Order
                if rec.move_id.sale_line_id.name:
                    ourname = rec.move_id.sale_line_id.name
                #If not
                else:
                    #If there is a description Show it
                    if rec.product_id.description_sale:
                        ourname = rec.product_id.name + "\n" + rec.product_id.description_sale
                    else:
                        ourname = rec.product_id.name

                #.Purchase
            elif rec.move_id.picking_type_id.code == 'incoming':
                # If it's linked to a Purchase Order
                if rec.move_id.purchase_line_id.name:
                    ourname = rec.move_id.purchase_line_id.name
                # If not
                else:
                    # If there is a description Show it
                    if rec.product_id.description_purchase:
                        ourname = rec.product_id.name + "\n" + rec.product_id.description_purchase
                    else:
                        ourname = rec.product_id.name

                #ELSE
            else:
                ourname = rec.product_id.name
            rec.update({
                'ourname': ourname,
            })
