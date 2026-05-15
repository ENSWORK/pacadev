 
# -*- coding: utf-8 -*-
{
    'name': "OurCustom Maintenance From Sale",

    'summary': """Create Maintenance Request From sale Order""",

    'description': """
        Create Maintenance Request From sale Order
    """,

    'author': "ENSWORK",
    'website': "https://www.enswork.com",

    # for the full list
    'category': 'Extra Tools',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base', 'sale', 'maintenance'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'wizards/maintenance_from_sale_wz_view.xml',
        'views/maintenance_from_sale_view.xml',
    ],

'installable': True,
'application': True,
'auto_install': False,
}
