{
    'name': 'Custom Sale Invoice',
    'version': '17.0.1.0.0',
    'category': 'Sales',
    'summary': 'Enhance sale order with direct invoice creation and force sale options',
    'description': """
This module adds the following features to sale orders:
- Create and validate invoices directly from sale orders
- Force sale completion without generating invoices
- Add user group for accessing these options
""",
    'author': 'ENSWORK',
    'website': 'https://www.enswork.com',
    'depends': ['sale', 'account'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/sale_order_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}