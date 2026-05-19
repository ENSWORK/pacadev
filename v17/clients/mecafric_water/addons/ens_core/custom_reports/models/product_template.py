# -*- coding: utf-8 -*-
from odoo import fields, models


class ProductTemplate(models.Model):
    """
    Extension du modèle Product Template pour l'origine géographique.

    Ajoute un champ pour tracer le pays d'origine du produit,
    utile pour les rapports commerciaux et la conformité réglementaire.
    """

    _inherit = "product.template"

    origin = fields.Many2one(
        "res.country",
        string="Origin",
        help="Pays d'origine du produit. "
        "Cette information peut être affichée dans les rapports de vente/achat "
        "selon les besoins réglementaires ou commerciaux.",
    )
