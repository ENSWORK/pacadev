# -*- coding: utf-8 -*-
from odoo import fields, models


class AccountMove(models.Model):
    """
    Extension du modèle Account Move pour les options d'impression
    des factures.

    Ajoute les options d'impression personnalisées pour les factures
    clients/fournisseurs :
    - Affichage/masquage des références produit
    - Affichage/masquage de l'en-tête personnalisé
    - Affichage/masquage de la numérotation des lignes

    Compatible avec les 3 templates (ENS, DB, MEC).
    Applicable aux factures, avoirs et autres pièces comptables.
    """

    _inherit = "account.move"

    # Options d'impression
    print_with_ref = fields.Boolean(
        string="Imprimer avec références",
        default=True,
        help="Afficher la colonne des références produit dans les factures. "
        "Décocher pour masquer la colonne 'Ref' dans le tableau.",
    )
    print_with_header = fields.Boolean(
        string="Imprimer avec en-tête",
        default=True,
        help="Afficher l'en-tête personnalisé dans les factures. "
        "Décocher pour générer une facture sans header/footer.",
    )
    print_with_line_number = fields.Boolean(
        string="Imprimer avec N°",
        default=True,
        help="Afficher la colonne N° dans le tableau des lignes de facture.",
    )
    print_with_signature = fields.Boolean(
        string="Imprimer avec signature",
        default=False,
        help="Afficher la signature de l'utilisateur créateur dans le footer. "
        "La signature doit être configurée dans Préférences utilisateur. "
        "Format recommandé : PNG 500x250px avec fond transparent.",
    )
    print_with_brand = fields.Boolean(
        string="Imprimer avec marque",
        default=False,
        help="Afficher la marque du produit dans les lignes de facture. "
        "Applicable uniquement au template DB.",
    )
    print_with_origin = fields.Boolean(
        string="Imprimer avec origine",
        default=False,
        help="Afficher l'origine (pays) du produit dans les lignes de facture. "
        "Applicable uniquement au template DB.",
    )
    print_with_representative = fields.Boolean(
        string="Imprimer avec représentant",
        default=True,
        help="Afficher le bloc Représentant / Téléphone / E-mail dans les factures. "
        "Décocher pour masquer ces informations. "
        "Applicable uniquement au template MEC.",
    )
