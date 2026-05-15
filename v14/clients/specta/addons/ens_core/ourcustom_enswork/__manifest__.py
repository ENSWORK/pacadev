# -*- coding: utf-8 -*-
{
    'name': "OurCustom ENSWORK",

    'summary': """Model used to edit Login Page""",

    'description': """
      Model used to edit Login Page
    """,

    'author': "ENSWORK",
    'website': "http://www.enswork.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/14.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Extra Tools',
    'version': '0.2',

    # any module necessary for this one to work correctly
    'depends': ['base',],

    # always loaded
    'data': [
        'templates/login_page.xml',

    ],
    # only loaded in demonstration mode
#    'demo': [
#        'demo.xml',
#    ],
'installable': True,
'application': True,
'auto_install': False,
}
