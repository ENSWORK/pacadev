from odoo import models, fields, api, _
from odoo.exceptions import UserError
from odoo import tools
import logging

_logger = logging.getLogger(__name__)

class SaleOrder(models.Model):
    _inherit = 'sale.order'

    invoice_status = fields.Selection(selection_add=[('force_invoiced', 'Force Invoiced')])
    delivery_status = fields.Selection([
        ('no', 'Nothing to Deliver'),
        ('partial', 'Partially Delivered'),
        ('full', 'Fully Delivered')
    ], string='Delivery Status', compute='_compute_delivery_status', store=True)

    @api.depends('state', 'order_line.qty_delivered', 'order_line.product_uom_qty')
    def _compute_delivery_status(self):
        for order in self:
            if order.state not in ['sale', 'done']:
                order.delivery_status = 'no'
            elif all(line.qty_delivered >= line.product_uom_qty for line in order.order_line if line.product_id.type != 'service'):
                order.delivery_status = 'full'
            elif any(line.qty_delivered > 0 for line in order.order_line if line.product_id.type != 'service'):
                order.delivery_status = 'partial'
            else:
                order.delivery_status = 'no'

    def action_force_sale(self):
        self.ensure_one()
        if self.state not in ['sale', 'done']:
            raise UserError(_("You can only force invoiced status on confirmed sales."))
        if self.delivery_status != 'full':
            raise UserError(_("You can only force invoiced status on fully delivered orders."))
        self.invoice_status = 'force_invoiced'
        self.message_post(body=_("This sale has been marked as force invoiced without generating an invoice."))

    @api.depends('state', 'order_line.invoice_status', 'order_line.invoice_lines')
    def _compute_invoice_status(self):
        super()._compute_invoice_status()
        for order in self:
            if order.invoice_status == 'force_invoiced':
                continue  # Keep the force_invoiced status


class SaleAdvancePaymentInv(models.TransientModel):
    _inherit = 'sale.advance.payment.inv'

    def create_and_validate_invoices(self):
        # Create invoices
        result = self.create_invoices()

        # Identify the created invoices
        if isinstance(result, dict):
            invoice_ids = result.get('res_id') if 'res_id' in result else result.get('domain')[0][2]
        else:
            invoice_ids = result.ids

        invoices = self.env['account.move'].browse(invoice_ids)

        # Post (validate) the invoices
        for invoice in invoices:
            invoice.action_post()

        # Return the same result structure as create_invoices
        if isinstance(result, dict):
            return result
        else:
            return {
                'name': _('Invoices'),
                'view_mode': 'form',
                'res_model': 'account.move',
                'view_id': False,
                'type': 'ir.actions.act_window',
                'domain': [('id', 'in', invoices.ids)],
            }
# Ajouter la vue combinée des commandes de vente et factures dans le modèle

class CombinedSaleInvoice(models.Model):
    _name = 'combined.sale.invoice'
    _description = 'Vue combinée des commandes de vente et factures'
    _auto = False

    name = fields.Char(string='Numéro', readonly=True)
    date_order = fields.Datetime(string='Date de la commande', readonly=True)
    partner_id = fields.Many2one('res.partner', string='Client', readonly=True)
    user_id = fields.Many2one('res.users', string='Vendeur', readonly=True)
    activity = fields.Char(string='Activités', readonly=True)
    amount_total = fields.Float(string='Total', readonly=True)
    amount_paid = fields.Float(string='Advance Payment', readonly=True)
    amount_due = fields.Float(string='Remaining Payment', readonly=True)
    payment_state = fields.Selection([
        ('paid', 'Paid'),
        ('partially_paid', 'Partially Paid'),
        ('not_paid', 'Not Paid')
    ], string='Payment State', readonly=True)
    delivery_status = fields.Selection([
        ('fully_delivered', 'Fully Delivered'),
        ('partially_delivered', 'Partially Delivered'),
        ('not_delivered', 'Non livré')
    ], string='Statut de livraison', readonly=True)
    invoice_status = fields.Selection([
        ('invoiced', 'Entièrement facturé'),
        ('to_invoice', 'À facturer'),
        ('no', 'Rien à facturer')
    ], string='Statut de la facture', readonly=True)
    amount_to_invoice = fields.Float(string='Montant à facturer', readonly=True)
    reference = fields.Char(string='Référence client', readonly=True)
    type = fields.Selection([('so', 'Commande'), ('invoice', 'Facture')], string='Type', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute(f"""
            CREATE OR REPLACE VIEW {self._table} AS (
                SELECT
                    so.id::text || '-so' as id,
                    so.name,
                    so.date_order,
                    so.partner_id,
                    so.user_id,
                    so.amount_total,
                    so.advance_payment_amount as amount_paid,
                    so.remaining_payment as amount_due,
                    so.payment_state,
                    so.delivery_status,
                    so.invoice_status,
                    so.amount_to_invoice,
                    so.client_order_ref as reference,
                    'so' as type
                FROM
                    sale_order so
                WHERE
                    so.invoice_status != 'invoiced' OR so.payment_state != 'paid'
                UNION ALL
                SELECT
                    am.id::text || '-inv' as id,
                    am.name,
                    am.invoice_date as date_order,
                    am.partner_id,
                    am.invoice_user_id as user_id,
                    am.amount_total_signed as amount_total,
                    am.amount_total_signed - am.amount_residual_signed as amount_paid,
                    am.amount_residual_signed as amount_due,
                    am.payment_state,
                    'fully_delivered' as delivery_status,
                    'invoiced' as invoice_status,
                    0 as amount_to_invoice,
                    am.ref as reference,
                    'invoice' as type
                FROM
                    account_move am
                WHERE
                    am.move_type IN ('out_invoice', 'out_refund')
                    AND am.payment_state != 'paid'
            )
        """)
        _logger.info(f"Vue SQL créée pour {self._table}")

        # Vérifiez le contenu de la vue
        self.env.cr.execute(f"SELECT COUNT(*) FROM {self._table}")
        count = self.env.cr.fetchone()[0]
        _logger.info(f"Nombre d'enregistrements dans la vue : {count}")

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None):
        _logger.info(f"Début de search_read avec domain={domain}, fields={fields}")
        res = super(CombinedSaleInvoice, self).search_read(domain=domain, fields=fields, offset=offset, limit=limit,
                                                           order=order)
        _logger.info(f"Résultat de search_read : {len(res)} éléments")
        _logger.info(f"Premier élément (si existant) : {res[0] if res else 'Aucun élément'}")
        return res

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        _logger.info(f"Début de search avec args={args}")
        res = super(CombinedSaleInvoice, self).search(args, offset=offset, limit=limit, order=order, count=count)
        _logger.info(f"Résultat de search : {len(res) if not count else res} éléments")
        return res

    def action_view_not_paid(self):
        return {
            'name': 'Éléments non payés',
            'type': 'ir.actions.act_window',
            'res_model': 'combined.sale.invoice',
            'view_mode': 'tree,form',
            'domain': [('payment_state', '=', 'not_paid')],
        }

    def action_view_to_invoice(self):
        return {
            'name': 'Éléments à facturer',
            'type': 'ir.actions.act_window',
            'res_model': 'combined.sale.invoice',
            'view_mode': 'tree,form',
            'domain': [('invoice_status', '=', 'to invoice')],
        }