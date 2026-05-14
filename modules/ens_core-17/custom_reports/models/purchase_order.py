# -*- coding: utf-8 -*-
from odoo import fields, models


class PurchaseOrder(models.Model):
    """
    Extension du modèle Purchase Order pour les options d'impression
    personnalisées.

    Ce modèle ajoute des options permettant de contrôler l'affichage
    des rapports d'achat selon 3 templates disponibles (ENS, DB, MEC).

    Les options d'impression peuvent être configurées :
    - Au niveau global : via res.company.print_template
    - Au niveau document : via les champs print_with_*

    Le système de rapports dynamiques combine ces deux niveaux pour
    générer le PDF approprié automatiquement.

    Configuration accessible via : Achats > Bon de commande > Onglet
    "Options d'impression"
    """

    _inherit = "purchase.order"

    # Options d'impression
    print_with_ref = fields.Boolean(
        string="Imprimer avec références",
        default=True,
        help="Afficher la colonne des références produit dans les bons "
        "de commande. Décocher pour masquer la colonne 'Ref' dans le "
        "tableau des articles.",
    )
    print_with_header = fields.Boolean(
        string="Imprimer avec en-tête",
        default=True,
        help="Afficher l'en-tête personnalisé dans les bons de commande. "
        "Décocher pour générer un rapport sans header/footer.",
    )
    print_with_line_number = fields.Boolean(
        string="Imprimer avec N°",
        default=True,
        help="Afficher la colonne N° dans le tableau des articles. "
        "La numérotation est calculée automatiquement.",
    )
    print_with_expected_date = fields.Boolean(
        string="Imprimer avec date prévue",
        default=True,
        help="Afficher la colonne 'Date prévue' dans les demandes de "
        "prix. Cette colonne indique la date de livraison attendue pour "
        "chaque article.",
    )
    print_with_buyer = fields.Boolean(
        string="Imprimer avec acheteur",
        default=True,
        help="Afficher le bloc Acheteur / Téléphone / E-mail dans les "
        "bons de commande. Décocher pour masquer ces informations. "
        "Applicable uniquement au template MEC.",
    )
    print_with_payment_terms = fields.Boolean(
        string="Imprimer avec conditions de paiement",
        default=True,
        help="Afficher les conditions de paiement dans les bons de commande. "
        "Décocher pour masquer les conditions de livraison, paiement et date "
        "de livraison prévue.",
    )
    print_with_signature = fields.Boolean(
        string="Imprimer avec signature",
        default=False,
        help="Afficher la signature de l'utilisateur acheteur dans le "
        "rapport. La signature doit être configurée dans Paramètres > "
        "Utilisateurs > Onglet Signature. Si l'utilisateur n'a pas de "
        "signature, rien ne s'affichera. Format recommandé : PNG "
        "200x80px avec fond transparent.",
    )
