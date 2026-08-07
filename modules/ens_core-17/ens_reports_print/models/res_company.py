# -*- coding: utf-8 -*-
from odoo import models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    # ========================================================================
    # IMPRESSION FACTURES (print_inv_*)
    # ========================================================================

    print_inv_layout = fields.Selection(
        selection=[
            ('standard', 'Standard'),
            ('compact', 'Compact'),
            ('premium', 'Premium'),
        ],
        string="Layout Facture",
        default='standard',
        help="Modèle de mise en page pour les factures clients"
    )

    print_inv_show_product_ref = fields.Boolean(
        string="Afficher référence article",
        default=True,
        help="Afficher la colonne 'Référence' dans les lignes de facture"
    )

    print_inv_show_header = fields.Boolean(
        string="Afficher en-tête et pied de page",
        default=True,
        help="Afficher l'en-tête et le pied de page du document"
    )

    print_inv_show_signature = fields.Boolean(
        string="Afficher signature",
        default=False,
        help="Afficher la signature en bas du document"
    )

    print_inv_show_sequence = fields.Boolean(
        string="Afficher numéro de ligne",
        default=True,
        help="Afficher le numéro de séquence des lignes"
    )

    # Options spécifiques factures
    print_inv_show_brand = fields.Boolean(
        string="Afficher marque produit",
        default=False,
        help="Afficher la marque du produit dans les lignes"
    )

    print_inv_show_payment_terms = fields.Boolean(
        string="Afficher conditions de paiement",
        default=True,
        help="Afficher les conditions de paiement sur la facture"
    )

    print_inv_show_lot_serial = fields.Boolean(
        string="Afficher lot/série",
        default=False,
        help="Afficher les numéros de lot et de série dans les lignes"
    )
