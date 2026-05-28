{
    'name': 'Delivery from Sale Order',
    'version': '17.0.1.0.0',
    'category': 'Inventory/Delivery',
    'summary': 'Manage deliveries from sale orders',
    'description': """
        This module allows to manage deliveries directly from sale orders.
    """,
    'depends': ['sale', 'stock', 'sale_stock'],  # Ajoutez 'sale_stock' ici
    'data': [
        'security/ir.model.access.csv',
        'views/sale_order_views.xml',
        'views/stock_picking_views.xml',
        'views/delivery_wizard_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}