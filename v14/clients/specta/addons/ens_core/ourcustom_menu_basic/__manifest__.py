# -*- coding: utf-8 -*-
{
    'name': "OurCustom Menu Basic",

    'summary': """Ce modele Organise le Menu des modules de base: Accounting,Sale,Purchase,Stock,CRM""",

    'description': """
        Ce modele Organise le Menu des modules de base: Accounting,Sale,Purchase,Stock
    """,

    'author': "Enswork",
    'website': "http://www.enswork.com",

    'category': 'Extra Tools',
    'version': '0.4',

    # any module necessary for this one to work correctly
    'depends': ['base', 'purchase', 'stock', 'contacts', 'account', 'crm', 'sale', 'sales_team',
                'website_crm_partner_assign', 'abs_sales_cancel_reason', 'product_brand_purchase',
                'mail', 'board', 'calendar', 'account_reconciliation_widget', 'payment', 'base_account_budget','ourcustom_commun',
                'utm','om_account_asset','om_account_accountant', 'stock_account','purchase_order_line_discount'],

    # always loaded
    'data': [
        'security/security.xml',
        'security/ir_module_category_data.xml',
        'views/ourcustom_menu_groups.xml',
        'views/ourcustom_menu_accueil.xml',
        'views/ourcustom_menu_achats.xml',
        'views/ourcustom_menu_stock.xml',
        'views/ourcustom_menu_contacts.xml',
        'views/ourcustom_menu_crm_ventes.xml',
        'views/ourcustom_menu_produits_services.xml',
        'views/ourcustom_menu_compta.xml',
        'views/sale_order_lines_view.xml',
        'views/purchase_order_lines_view.xml',
    ],
    # only loaded in demonstration mode
    #    'demo': [
    #        'demo.xml',
    #    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}

#   Depend on purchase_order_line_discount because discount is shown in Lignes de achats File: purchase_order_lines_view.xml