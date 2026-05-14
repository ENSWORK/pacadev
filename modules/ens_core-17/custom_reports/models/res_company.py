# -*- coding: utf-8 -*-
from odoo import fields, models


class ResCompany(models.Model):
    """
    Extension du modèle Company pour la gestion des templates
    d'impression.

    Ce modèle ajoute la configuration globale des rapports pour toute
    la société. Les templates disponibles sont :

    - ENS : Template simple et épuré
    - DB (DoliBarr) : Template professionnel avec infos fiscales
      détaillées
    - MEC (Template MEC) : Template hautement personnalisable avec images
    - Odoo : Template natif d'Odoo

    Configuration accessible via : Paramètres > Sociétés > Options
    d'impression
    """

    _inherit = "res.company"

    print_template = fields.Selection(
        [
            ("ens", "Template ENS"),
            ("db", "Template DB"),
            ("mec", "Template MEC"),
            ("odoo", "Template Odoo"),
        ],
        string="Template d'impression",
        default="ens",
        help="Choisir le template d'impression par défaut pour tous "
        "les documents (devis, factures, livraisons, achats). "
        "Ce choix peut être combiné avec les options spécifiques "
        "de chaque document.",
    )

    closing_message = fields.Text(
        string="Message de clôture",
        default="Nous vous remercions de votre attention",
        help="Message personnalisé affiché après le tableau des articles. "
        "Recommandé : 2-3 lignes maximum pour une meilleure lisibilité.",
    )

    # Images Template MEC
    header_image_mec = fields.Binary(
        string="Image En-tête Template MEC",
        help="Image d'en-tête pour les rapports Template MEC "
        "(prend toute la largeur de la page). "
        "Format recommandé : PNG/JPG, largeur min 800px. "
        "Utilisée uniquement si mec_header_type='image'.",
    )
    footer_image_mec = fields.Binary(
        string="Image Pied de page Template MEC",
        help="Image de pied de page pour les rapports Template MEC "
        "(prend toute la largeur de la page). "
        "Format recommandé : PNG/JPG, largeur min 800px.",
    )

    primary_color = fields.Char(
        string="Couleur primaire",
        default="#000000",
        help="Couleur primaire utilisée dans les rapports "
        "(format hexadécimal #RRGGBB). "
        "Appliquée aux titres, textes importants et éléments "
        "de mise en valeur. "
        "Utilisée dans tous les templates.",
    )

    # Couleur d'arrière-plan de l'entête
    header_background_color = fields.Char(
        string="Couleur arrière-plan entête",
        default="#00BFFF",
        help="Couleur d'arrière-plan pour la zone d'entête "
        "(format hexadécimal #RRGGBB). "
        "Particulièrement visible dans le template MEC avec "
        "style 'colored'. "
        "Conseil : Utiliser une couleur contrastée avec le texte "
        "blanc.",
    )

    # Options de configuration pour le rapport MEC
    mec_header_type = fields.Selection(
        [("logo", "Logo normal"), ("image", "Image pleine largeur")],
        string="Type de header MEC",
        default="image",
        help="Type d'en-tête pour le template MEC :\n"
        "- Logo normal : Utilise le logo de la société "
        "(company_id.logo)\n"
        "- Image pleine largeur : Utilise l'image personnalisée "
        "(header_image_mec)",
    )

    mec_header_style = fields.Selection(
        [("colored", "Avec arrière-plan coloré"), ("simple", "Simple/Sans couleur")],
        string="Style de l'entête MEC",
        default="colored",
        help="Style de la zone d'informations (Offre N°, Date, Client) :\n"
        "- Avec arrière-plan coloré : Fond coloré avec texte blanc (header_background_color)\n"
        "- Simple/Sans couleur : Affichage épuré sans fond coloré",
    )

    mec_show_closing_message = fields.Boolean(
        string="Afficher le message de clôture",
        default=True,
        help="Afficher ou masquer le message de clôture dans le rapport MEC. "
        "Le message est défini dans le champ 'closing_message'. "
        "Utile pour désactiver le message sur certains types de documents.",
    )

    report_show_project = fields.Boolean(
        string="Afficher le champ Projet dans les rapports",
        default=True,
        help="Afficher le champ 'Projet' dans tous les rapports de vente. "
        "Si décoché, le champ projet sera masqué dans les formulaires ET les impressions. "
        "Applicable à tous les templates (ENS, DB, MEC).",
    )

    # Configuration spécifique pour les factures MEC
    invoice_mec_header_type = fields.Selection(
        [("logo", "Logo normal"), ("image", "Image pleine largeur")],
        string="Type de header Facture MEC",
        default="logo",
        help="Type d'en-tête pour les factures MEC :\n"
        "- Logo normal : Utilise le logo de la société (company_id.logo)\n"
        "- Image pleine largeur : Utilise l'image personnalisée (header_image_invoice_mec)",
    )

    header_image_invoice_mec = fields.Binary(
        string="Image En-tête Facture MEC",
        help="Image d'en-tête pour les factures Template MEC (pleine largeur). "
        "Format recommandé : PNG/JPG, largeur min 800px. "
        "Utilisée uniquement si invoice_mec_header_type='image'.",
    )

    # Configuration du pied de page DB
    footer_db_type = fields.Selection(
        [
            ("text", "Texte (informations fiscales)"),
            ("image", "Image pleine largeur"),
            ("none", "Aucun pied de page"),
        ],
        string="Type de pied de page DB",
        default="text",
        help="Type de pied de page pour le template DB :\n"
        "- Texte : Affiche les informations fiscales de la "
        "société (par défaut)\n"
        "- Image : Utilise l'image personnalisée "
        "(footer_image_db)\n"
        "- Aucun : N'affiche pas de pied de page",
    )

    footer_image_db = fields.Binary(
        string="Image Pied de page DB",
        help="Image de pied de page pour les rapports DB "
        "(pleine largeur). "
        "Format recommandé : PNG/JPG, largeur min 800px. "
        "Utilisée uniquement si footer_db_type='image'.",
    )

    footer_text_db = fields.Html(
        string="Texte Pied de page DB",
        help="Texte personnalisé pour le pied de page DB. "
        "Si laissé vide, les informations fiscales par défaut "
        "seront affichées. "
        "Utilisé uniquement si footer_db_type='text'.",
    )

    # Image de tampon pour les factures MEC
    stamp_image = fields.Binary(
        string="Image de tampon/cachet",
        help="Image du tampon ou cachet de la société (champ non utilisé actuellement). "
        "Format recommandé : PNG avec fond transparent, 300x150px. "
        "Conservé pour usage futur ou personnalisations.",
    )

    # Position du bloc infos facture (Template DB)
    invoice_info_position = fields.Selection(
        [
            ("default", "Position par défaut (en haut à droite)"),
            ("top_left", "Remplace le bloc Émetteur"),
        ],
        string="Position infos facture DB",
        default="default",
        help="Choisir l'emplacement du bloc d'informations facture (Réf, Date, etc.) "
        "pour le template DB. "
        "Si 'Remplace le bloc Émetteur' : les infos facture s'affichent à la place du bloc Émetteur.",
    )

    # ==========================================
    # Configuration des tailles de logos
    # ==========================================

    logo_height = fields.Integer(
        string="Hauteur du logo (px)",
        default=85,
        help="Hauteur maximale du logo dans tous les templates (en pixels). "
        "Valeur par défaut : 85px. "
        "Appliquée à tous les documents (devis, factures, BL, achats) "
        "et tous les templates (ENS, DB, MEC). "
        "Après modification, pensez à vider le cache Odoo et régénérer les PDFs.",
    )
    logo_width = fields.Integer(
        string="Largeur du logo (px)",
        default=350,
        help="Largeur maximale du logo dans tous les templates (en pixels). "
        "Valeur par défaut : 350px. "
        "Appliquée à tous les documents (devis, factures, BL, achats) "
        "et tous les templates (ENS, DB, MEC). "
        "Après modification, pensez à vider le cache Odoo et régénérer les PDFs.",
    )
