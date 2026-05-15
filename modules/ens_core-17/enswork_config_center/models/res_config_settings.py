from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # Rapports et Impressions
    module_custom_reports = fields.Boolean(string="Rapports personnalisés")

    # Ventes
    module_sales_order_double_approval = fields.Boolean(string="Double approbation des commandes")
    module_sales_quotations_sequences = fields.Boolean(string="Séquences des devis")
    module_sales_target = fields.Boolean(string="Objectifs de vente")

    # Facturation
    module_custom_sale_invoice = fields.Boolean(string="Facture de vente personnalisée")
    module_eg_advance_payment_in_sale = fields.Boolean(string="Paiement anticipé dans les ventes")

    # Livraison et Achats
    module_delivery_from_sale = fields.Boolean(string="Livraison à partir de la commande")
    module_sale_to_purchase = fields.Boolean(string="Commande d'achat à partir de la vente")

    # Autres
    module_eg_remove_internal_reference = fields.Boolean(string="Supprimer références internes")

    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        params = self.env['ir.config_parameter'].sudo()
        IrModule = self.env['ir.module.module'].sudo()

        # Mapping entre les noms de champs et les noms techniques des modules
        module_mapping = {
            'module_custom_reports': 'custom_reports',
            'module_sales_order_double_approval': 'sales_order_double_approval',
            'module_sales_quotations_sequences': 'sales_quotations_sequences',
            'module_sales_target': 'sales_target',
            'module_custom_sale_invoice': 'custom_sale_invoice',
            'module_eg_advance_payment_in_sale': 'eg_advance_payment_in_sale',
            'module_delivery_from_sale': 'delivery_from_sale',
            'module_sale_to_purchase': 'sale_to_purchase',
            'module_eg_remove_internal_reference': 'eg_remove_internal_reference',
        }

        # Vérifier l'état réel des modules
        for field_name, module_name in module_mapping.items():
            module = IrModule.search([('name', '=', module_name)])
            res[field_name] = module.state == 'installed'

        return res

    def set_values(self):
        super(ResConfigSettings, self).set_values()
        params = self.env['ir.config_parameter'].sudo()
        IrModule = self.env['ir.module.module'].sudo()

        # Mapping entre les noms de champs et les noms techniques des modules
        module_mapping = {
            'module_custom_reports': 'custom_reports',
            'module_sales_order_double_approval': 'sales_order_double_approval',
            'module_sales_quotations_sequences': 'sales_quotations_sequences',
            'module_sales_target': 'sales_target',
            'module_custom_sale_invoice': 'custom_sale_invoice',
            'module_eg_advance_payment_in_sale': 'eg_advance_payment_in_sale',
            'module_delivery_from_sale': 'delivery_from_sale',
            'module_sale_to_purchase': 'sale_to_purchase',
            'module_eg_remove_internal_reference': 'eg_remove_internal_reference',
        }

        # Installation/Désinstallation des modules
        for field_name, module_name in module_mapping.items():
            module = IrModule.search([('name', '=', module_name)])
            if module:
                if getattr(self, field_name):
                    if module.state != 'installed':
                        module.button_immediate_install()
                else:
                    if module.state == 'installed':
                        module.button_immediate_uninstall()