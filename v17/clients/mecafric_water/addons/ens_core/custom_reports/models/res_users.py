# -*- coding: utf-8 -*-
from odoo import fields, models


class ResUsers(models.Model):
    """
    Extension du modèle Users pour les signatures personnalisées.

    Permet à chaque utilisateur d'uploader une image de signature
    qui sera affichée dans les rapports (devis, factures, etc.).
    """

    _inherit = "res.users"

    signature_image = fields.Binary(
        string="Signature",
        help="Image de signature personnalisée pour les rapports. "
        "Format recommandé : PNG avec fond transparent, dimensions max 200x80px. "
        "Utilisée dans le footer des documents selon le template choisi.",
    )
