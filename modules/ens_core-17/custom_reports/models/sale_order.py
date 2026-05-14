# -*- coding: utf-8 -*-
from odoo import api, fields, models


class SaleOrder(models.Model):
    """
    Extension du modèle Sale Order pour gérer les options d'impression personnalisées.

    Ce modèle ajoute des options permettant de contrôler l'affichage des rapports
    de vente selon 3 templates disponibles (ENS, DB, MEC).

    Les options d'impression peuvent être configurées :
    - Au niveau global : via res.company.print_template
    - Au niveau document : via les champs print_with_*

    Le système de rapports dynamiques combine ces deux niveaux pour générer
    le PDF approprié automatiquement.
    """

    _inherit = "sale.order"

    # Champ Projet
    projet = fields.Char(
        string="Projet",
        help="Nom du projet associé à cette commande. Visible selon la configuration "
        "de la société (res.company.report_show_project)",
    )

    # Champ calculé pour rendre la visibilité réactive
    show_projet_field = fields.Boolean(
        string="Afficher Projet",
        compute="_compute_show_projet_field",
        help="Champ calculé pour gérer la visibilité du champ Projet selon la config société",
    )

    # Options d'impression
    print_with_ref = fields.Boolean(
        string="Imprimer avec références",
        default=True,
        help="Afficher la colonne des références produit dans les rapports. "
        "Décocher pour masquer la colonne 'Ref' dans le tableau des articles.",
    )
    print_with_header = fields.Boolean(
        string="Imprimer avec en-tête",
        default=True,
        help="Afficher l'en-tête personnalisé dans les rapports. "
        "Décocher pour générer un rapport sans header/footer.",
    )
    print_with_line_number = fields.Boolean(
        string="Imprimer avec N°",
        default=True,
        help="Afficher la colonne N° dans le tableau des articles. "
        "La numérotation est calculée automatiquement (sl_no).",
    )
    print_with_signature = fields.Boolean(
        string="Imprimer avec signature",
        default=False,
        help="Afficher la signature de l'utilisateur vendeur dans le "
        "rapport. La signature doit être configurée dans Paramètres > "
        "Utilisateurs > Onglet Signature. Si l'utilisateur n'a pas de "
        "signature, rien ne s'affichera. Format recommandé : PNG "
        "200x80px avec fond transparent.",
    )
    print_with_payment_terms = fields.Boolean(
        string="Imprimer avec conditions de paiement",
        default=True,
        help="Afficher les conditions de paiement dans le devis. "
        "Décocher pour masquer le mode de règlement.",
    )

    # Champ ICE client
    ice_client = fields.Char(
        string="ICE Client",
        help="Identifiant du client (ICE) associé à cette commande.",
    )

    @api.depends("company_id")
    def _compute_show_projet_field(self):
        """Calcule dynamiquement si le champ Projet doit être affichable"""
        for record in self:
            record.show_projet_field = record.company_id.report_show_project


class SaleOrderLine(models.Model):
    """
    Extension du modèle Sale Order Line pour la numérotation automatique et délais.

    Ajoute :
    - Un champ de numérotation automatique des lignes (excluant sections/notes)
    - Un champ de délai de livraison personnalisable par ligne
    """

    _inherit = "sale.order.line"

    ourdelai = fields.Char(
        string="Délai de livraison",
        help="Délai de livraison spécifique pour cette ligne de commande. "
        "Affiché dans les rapports si le template le supporte.",
    )
    sl_no = fields.Integer(
        string="N° Ligne",
        compute="_compute_sl_no",
        store=True,
        help="Numéro automatique de la ligne (calculé). "
        "Exclut les lignes de type 'section' et 'note'.",
    )

    @api.depends("sequence", "order_id")
    def _compute_sl_no(self):
        """
        Calcule automatiquement le numéro de ligne pour chaque article.

        Logique :
        1. Filtre les lignes sans display_type (exclut sections et notes)
        2. Trie par séquence
        3. Numérote de 1 à N

        Ce champ est stocké en base pour améliorer les performances.
        """
        for order in self.mapped("order_id"):
            lines = order.order_line.filtered(lambda l: not l.display_type)
            for i, line in enumerate(lines.sorted("sequence"), 1):
                line.sl_no = i
