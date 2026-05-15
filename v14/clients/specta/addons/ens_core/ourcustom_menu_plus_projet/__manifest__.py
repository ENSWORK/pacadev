# -*- coding: utf-8 -*-
{
    'name': "OurCustom Menu Basic + Projet",

    'summary': """OurCustom Model Menu Basic + Projet""",

    'description': """
        Ce modele Organise le Menu.
    """,

    'author': "Enswork",
    'website': "http://www.enswork.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/14.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Extra Tools',
    'version': '0.2',

    # any module necessary for this one to work correctly
    'depends': ['base', 'project', 'ourcustom_menu_basic'],

    # always loaded
    'data': [
        'views/ourcustom_menu_project.xml',
    ],
    # only loaded in demonstration mode
    #    'demo': [
    #        'demo.xml',
    #    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}

