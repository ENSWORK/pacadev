# -*- coding: utf-8 -*-
{
    'name': "OurCustom  SPECTA",

    'summary': """OurCustom SPECTA Model""",

    'description': """
        Ce model contient tous les changements pour 
        Afriqua Pool Technologies
    """,

    'author': "ENSWORK",
    'website': "http://www.enswork.com",

    # for the full list
    'category': 'Extra Tools',
    'version': '0.5',

    # any module necessary for this one to work correctly
    'depends': ['base', 'sale', 'ourcustom_impression', 'product', 'purchase', 'maintenance'],

    # always loaded
    'data': [
        'views/product_cost_acess.xml',
        'views/maintenance_views.xml',
        'report/edit_bl_facture_specta.xml',
        'report/edit_bc_dp_specta.xml',
        'report/ourcustom_saleorder_document_inherit_specta.xml',
        'report/proforma_edit.xml',
        'report/edit_db_headers_footers.xml',
        'report/report_saleorder_commande_dollibar.xml',
        'report/report_delivery_dollibar_specta.xml',
        'report/reports.xml',
    ],
    # only loaded in demonstration mode
#    'demo': [
#        'demo.xml',
#    ],
'installable': True,
'application': True,
'auto_install': False,
}
