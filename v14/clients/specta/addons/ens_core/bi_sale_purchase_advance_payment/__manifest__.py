# -*- coding: utf-8 -*-
# Part of BrowseInfo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Advance Down Payment for Sales and Purchase',
    'version': '14.0.0.2',
    'category': 'Sales',
    'summary': 'Sale Advance payment purchase advance payment advance sale payment advance purchase payment sale down payment purchase down payment advance down payment for sales advance down payment for purchase sale purchase advance payment for sale purchase advance',
    'description': """

        Sale Order and Purchase Order Advance Payment in odoo,
        Sale Order Advance Payment in odoo,
        Purchase Order Advance Payment in odoo,
        Make an Advance Payment from Sale and Purchase Order in odoo,
        Advance Payment in odoo,
        Advance Payments will be Listed in Payment Advance Tab in odoo.
        Advance Payment Wizard in odoo,
        Outstanding Credit balance in odoo,
        Outstanding Debit balance in odoo,

    """,
    'author': 'BrowseInfo',
    "price": 15,
    "currency": 'EUR',
    'website': 'https://www.browseinfo.com',
    'depends': ['sale_management','purchase','account','stock'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/sale_advance_payment_views.xml',
        'wizard/purchase_advance_payment_views.xml',
        'views/sale_views.xml',
        'views/purchase_views.xml',
    
    ],
    'demo': [],
    'test': [],
    'installable': True,
    'auto_install': False,
    'live_test_url': 'https://youtu.be/Sn4cB4CdpII',
    "images": ['static/description/Banner.png'],
}
