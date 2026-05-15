# -*- coding: utf-8 -*-
{
    'name': "OurCustom Commun",

    'summary': """OurCustom Model Commun""",

    'description': """
        Ce Model Contient Les changements Communs
    """,

    'author': "ENSWORK",
    'website': "https://www.enswork.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/14.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Extra Tools',
    'version': '0.4',

    # any module necessary for this one to work correctly
    'depends': ['base', 'product', 'purchase', 'account', 'sale', 'bi_convert_purchase_from_sales',
                'bi_sales_invoice_details', 'stock'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'data/sequence.xml',
        'data/followup_levels.xml',
        'views/add_identifiants_client_partner_views.xml',
        'views/rename_tva_by_ice.xml',
        'views/stock_quant_tree_view.xml',
        'views/add_ref_code_article.xml',
        'views/our_product_template_search_view.xml',
        'views/article_prix_de_vente_view.xml',
        'views/unique_fields_view.xml',
        'views/account_followup.xml',
        'views/followup_report.xml',
        'views/sale_view.xml',
        'views/achat_origine_view.xml',
        'views/account_move.xml',
        'views/stock_move_view.xml',
        'views/invoice_origin_view.xml',
        'views/product_template_view.xml',
        'views/show_product_description.xml',
    ],
    # only loaded in demonstration mode
#    'demo': [
#        'demo.xml',
#    ],
'installable': True,
'application': True,
'auto_install': False,
}
