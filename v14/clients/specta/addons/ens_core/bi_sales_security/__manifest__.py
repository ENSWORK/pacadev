# -*- coding : utf-8 -*-
# Part of BrowseInfo. See LICENSE file for full copyright and licensing details.

{
    'name'          : 'Salesperson permission for Own Customer in Odoo ',
    'version'       : '14.0.0.1',
    'category'      : 'Sales',
    'summary'       : 'Salesperson Own sale order Salesperson Own Customer Salesperson Own sales person own customer sale person own customer access own customer access by sales person own customer access by salesman customer based sales person permission saleperson own customer',
    'description'   : """You can manage the 

odoo customer by grouping them in new group for better 
Odoo sales access for salesperson own customers
odoo customer based on sales person permissions salesperson access permission salesperson restricted access
Odoo Salesperson Own Customer and Sale Orders sales person customerwise access 
Odoo salesperson customer access
Odoo salesperson permission SalesPerson can view only customers
Allow you to set multiple sales person on customer form.
SalesPerson on Quote/Sales order can view his own customers only.
SalesPerson on Invoice/Bill can view his own customers only.
Own customers on sales order and invoice forms for sales person login.
Odoo Allow Sales person can see Own Customer Allow Salesperson can see Own Customer into sale order.
Odoo Allow Sales person can see Own Customer into Invoices Manager can assign multiple sales person to one customer
Odoo sales Person customer add many sales person for single customer
Odoo Add Multipe or one salesperson into salesperson field on customer form.
odoo own customer access by sales person own customer access by sales man 
Odoo salesman own customer access

      
    """,
    'author'        : 'BrowseInfo',
    'website'       : 'https://www.browseinfo.in',
    "price":  9,
    "currency": 'EUR',
    'depends'       : ['base','sale_management'],
    'data'          : [
        'security/sales_person.xml',
        'security/ir.model.access.csv',
        'wizard/allow_customers_views.xml',
        'views/customer_views.xml',
        ],
    'qweb': [
    ],
    'installable'   : True,
    'auto_install'  : False,
    'live_test_url' :'https://youtu.be/S3zDkfNT56Y',
    "images":["static/description/Banner.png"],
    
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
