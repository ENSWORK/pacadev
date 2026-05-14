# -*- coding: utf-8 -*-
{
    'name': "OurCustom Commun V2",

    'summary': """OurCustom Model Commun V2""",

    'description': """
        Ce Model Contient La suite des changements Communs
    """,

    'author': "ENSWORK",
    'website': "https://www.enswork.com",

    # for the full list
    'category': 'Extra Tools',
    'version': '1.0',

    # any module necessary for this one to work correctly
    'depends': ['base', 'sale', 'purchase', 'account', 'ourcustom_settings', 'purchase_order_line_discount', 'inputmask_widget', 'ourcustom_commun', 'product'],

    # always loaded
    'data': [
        'views/assets.xml',
        'views/res_config_settings.xml',
        'views/add_identifiant_cnss_view.xml',
        'views/force_sale_invoice_status_view.xml',
        'views/phone_unique_required_view.xml',
        'views/inventory_by_category.xml',
        'views/ice_15_char.xml',
        'views/add_warning.xml',
        'views/add_date_bon_commande.xml',
        'views/min_discount.xml',
    ],
    # only loaded in demonstration mode
#    'demo': [
#        'demo.xml',
#    ],
'installable': True,
'application': True,
'auto_install': False,
}
