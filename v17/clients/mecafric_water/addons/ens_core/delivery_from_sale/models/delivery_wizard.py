from odoo import models, fields, api
from odoo.exceptions import UserError

class DeliveryWizard(models.TransientModel):
    _name = 'delivery.wizard'
    _description = 'Delivery Wizard'

    picking_id = fields.Many2one('stock.picking', string='Delivery Order', required=True)
    move_ids = fields.One2many('stock.move', related='picking_id.move_ids', readonly=False)

    @api.model
    def default_get(self, fields):
        res = super(DeliveryWizard, self).default_get(fields)
        if self.env.context.get('active_id'):
            sale_order = self.env['sale.order'].browse(self.env.context['active_id'])
            picking = sale_order.picking_ids.filtered(lambda p: p.state not in ['done', 'cancel'])
            if not picking:
                raise UserError("Aucun bon de livraison en attente trouvé pour cette commande.")
            res['picking_id'] = picking[0].id
        return res

    def action_validate_delivery(self):
        self.ensure_one()
        picking = self.picking_id

        # Mettre à jour les quantités sur les mouvements de stock
        for move in self.move_ids:
            move.quantity = move.quantity  # Utilisez la quantité saisie dans le wizard

        # Vérifier si toutes les quantités sont entièrement traitées
        if all(move.quantity == move.product_uom_qty for move in picking.move_ids):
            # Si toutes les quantités correspondent, valider directement
            return picking.button_validate()
        else:
            # Sinon, appeler l'assistant de reliquat standard d'Odoo
            return picking.with_context(skip_backorder=False).button_validate()