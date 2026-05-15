from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class AddWarning(models.Model):
    _inherit = "product.template"

    WARNING_MESSAGE = [
        ('no-message', 'Aucun Message'),
        ('block', 'Message Bloquant')
    ]
    WARNING_HELP = 'En sélectionnant l\'option "Message Bloquant", une exception sera levée (au moment de la confiration de la commande) avec le message et le flux sera bloqué. Le message doit être écrit dans le champ suivant.'

    warn = fields.Selection(WARNING_MESSAGE, 'Ligne de commande de vente', help=WARNING_HELP, required=True,
                            default="no-message")
    warn_msg = fields.Text('Message à afficher')

    purchase_warn = fields.Selection(WARNING_MESSAGE, 'Ligne de commande d\'achat', help=WARNING_HELP, required=True,
                                     default="no-message")
    purchase_warn_msg = fields.Text('Message à afficher')


class SaleOrder(models.Model):
    _inherit = "sale.order"

    def action_confirm(self):
        res = super(SaleOrder, self).action_confirm()
        if any(line.product_id.warn != 'no-message' for line in self.order_line):
            for l in self.order_line:
                if l.product_id.warn == 'block':
                    raise ValidationError(
                        _('Le Produit  "%s" a un Message Bloquant : "%s"')
                        % (
                            l.product_id.name, l.product_id.warn_msg
                        )
                    )
        return res


class PurchaseOrder(models.Model):
    _inherit = "purchase.order"

    def button_confirm(self):
        res = super(PurchaseOrder, self).button_confirm()
        if any(line.product_id.purchase_warn != 'no-message' for line in self.order_line):
            for l in self.order_line:
                if l.product_id.purchase_warn == 'block':
                    raise ValidationError(
                        _('Le Produit  "%s" a un Message Bloquant : "%s"')
                        % (
                            l.product_id.name, l.product_id.purchase_warn_msg
                        )
                    )
        return res



class AccountMove(models.Model):
    _inherit = "account.move"

    def action_post(self):
        res = super(AccountMove, self).action_post()
        if any(line.product_id.purchase_warn != 'no-message' for line in self.invoice_line_ids):
            for l in self.invoice_line_ids:
                if l.product_id.purchase_warn == 'block':
                    if self.move_type == 'in_invoice':
                        raise ValidationError(
                            _('Le Produit  "%s" a un Message Bloquant : "%s"')
                            % (
                                l.product_id.name, l.product_id.purchase_warn_msg
                            )
                        )
        if any(line.product_id.warn != 'no-message' for line in self.invoice_line_ids):
            for l in self.invoice_line_ids:
                if l.product_id.warn == 'block':
                    if self.move_type == 'out_invoice':
                        raise ValidationError(
                            _('Le Produit  "%s" a un Message Bloquant : "%s"')
                            % (
                                l.product_id.name, l.product_id.warn_msg
                            )
                        )
        return res


class StockPicking(models.Model):
    _inherit = "stock.picking"

    def button_validate(self):
        res = super(StockPicking, self).button_validate()
        if any(line.product_id.purchase_warn != 'no-message' for line in self.move_line_ids_without_package):
            for l in self.move_line_ids_without_package:
                if l.product_id.purchase_warn == 'block':
                    if self.picking_type_code == 'incoming':
                        raise ValidationError(
                            _('Le Produit  "%s" a un Message Bloquant : "%s"')
                            % (
                                l.product_id.name, l.product_id.purchase_warn_msg
                            )
                        )
        if any(line.product_id.warn != 'no-message' for line in self.move_line_ids_without_package):
            for l in self.move_line_ids_without_package:
                if l.product_id.warn == 'block':
                    if self.picking_type_code == 'outgoing':
                        raise ValidationError(
                            _('Le Produit  "%s" a un Message Bloquant : "%s"')
                            % (
                                l.product_id.name, l.product_id.warn_msg
                            )
                        )
        return res
