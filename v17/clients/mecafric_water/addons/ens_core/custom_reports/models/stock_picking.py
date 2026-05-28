# -*- coding: utf-8 -*-
from odoo import fields, models


class StockPicking(models.Model):
    """
    Extension du modèle Stock Picking pour les options d'impression
    des bons de livraison.

    Ajoute les mêmes options d'impression que les commandes de vente :
    - Affichage/masquage des références produit
    - Affichage/masquage de l'en-tête personnalisé
    - Affichage/masquage de la numérotation des lignes

    Compatible avec les 3 templates (ENS, DB, MEC).
    """

    _inherit = "stock.picking"

    # Options d'impression
    print_with_ref = fields.Boolean(
        string="Imprimer avec références",
        default=True,
        help="Afficher la colonne des références produit dans les bons "
        "de livraison. Décocher pour masquer la colonne 'Ref' "
        "dans le tableau.",
    )
    print_with_header = fields.Boolean(
        string="Imprimer avec en-tête",
        default=True,
        help="Afficher l'en-tête personnalisé dans les bons de livraison. "
        "Décocher pour générer un bon sans header/footer.",
    )
    print_with_line_number = fields.Boolean(
        string="Imprimer avec N°",
        default=True,
        help="Afficher la colonne N° dans le tableau des produits livrés.",
    )
    print_with_visa = fields.Boolean(
        string="Imprimer avec Visa",
        default=True,
        help="Afficher la section 'Visa Service / Client' à la fin "
        "du bon de livraison. Décocher pour masquer les zones "
        "de signature.",
    )
    print_with_price = fields.Boolean(
        string="Imprimer avec prix",
        default=False,
        help="Afficher la colonne Prix Unitaire dans le bon de livraison. "
        "Les prix sont récupérés depuis la commande de vente liée.",
    )
