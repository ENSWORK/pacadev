# models/custom_company_fields.py

from odoo import models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    # Champ 1 et 2 : Texte simple
    custom_field_text_1 = fields.Text(string="Champ 1")
    custom_field_text_2 = fields.Text(string="Champ 2")

    # Champ 3 : Sélection entre texte ou image
    custom_field_selection = fields.Selection(
        selection=[
            ('text', 'Texte'),
            ('image', 'Image'),
        ],
        string="Champ 3",
        default='text'
    )
    # Champ dynamique : utilisé pour texte ou image selon la sélection
    custom_field_dynamic = fields.Binary(
        string="Contenu",
        attachment=True,
    )
    custom_field_text_4 = fields.Text(string="Champ 4")

    # Nouveau champ 5 : Image
    custom_field_image_5 = fields.Binary(
        string="Champ 5 - Image",
        attachment=True,
        help="Image pour le champ 5"
    )
    custom_field_image_6 = fields.Binary(
        string="Champ 6 - Image",
        attachment=True,
        help="Image pour le champ 6"
    )
