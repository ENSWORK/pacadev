# -*- coding: utf-8 -*-
{
    'name': "OurCustom SETTINGS",

    'summary': """OurCustom Model SETTINGS""",

    'description': """
      Model contains Enswork Settings
    """,

    'author': "ENSWORK",
    'website': "http://www.enswork.com",

    # for the full list
    'category': 'Extra Tools',
    'version': '0.2',

    # any module necessary for this one to work correctly
    'depends': ['base', 'account', 'sale'],

    # always loaded
    'data': [
        'security/groups.xml',
        'views/field_show_hide_bl_num_view.xml',
        'views/field_show_button_force_invoice_status_view.xml',
        'views/phone_required_unique_view.xml',
        'views/settings.xml',
    ],
    # only loaded in demonstration mode
#    'demo': [
#        'demo.xml',
#    ],
'installable': True,
'application': True,
'auto_install': False,
}

