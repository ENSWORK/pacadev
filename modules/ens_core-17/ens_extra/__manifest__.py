{
    'name': 'extra',
    'version': '17.0.1.0.0',
    'category': 'ENS/extra',
    'sequence': 1,
    'summary': 'ENS extra Module',
    'description': """
        ENS extra Module
    """,
    'depends': [
        'base',
        'sale',
        'product',
    ],
    'assets': {
        'web.assets_backend': [
            'ens_extra/static/src/css/sale_report.css',
        ],
    },
    'data': [
        'security/ir.model.access.csv',
        'views/category_views.xml',
        'views/menu_views.xml',
    ],
    'demo': [],
    'application': True,
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
