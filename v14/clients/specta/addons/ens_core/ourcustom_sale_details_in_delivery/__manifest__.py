# -*- coding: utf-8 -*-
{
    'name': "Sale Details in Delivery",

    'summary': """Pass Sale Order Details [Lines: Price Unit, Taxe, Discount, Price subtotal] 
    To Delivery""",

    'description': """
 
    """,

    'author': "ENSWORK",
    'website': "http://www.enswork.com",

    'category': 'Extra Tools',
    'version': '1.0',

    # any module necessary for this one to work correctly
    'depends': ['base', 'stock', 'sale', 'sale_stock'],

    # always loaded
    'data': [
        'views/stock_move_view.xml',
    ],

'installable': True,
'application': True,
'auto_install': False,
}
