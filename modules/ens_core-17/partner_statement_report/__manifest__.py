# -*- coding: utf-8 -*-
{
    'name': 'Relevé de compte partenaire',
    'description': """
            Relevé de compte partenaire — module traduit en français pour afrequip
    """,
    'summary': 'Relevé de compte partenaire',
    'version': '17.0.1.4.1',
    'category': 'Accounting',
    'author': 'Yunus Abdulaziz',
    'website': "yuab.odoo@gmail.com",
    'depends': [
        'contacts',
        'account',
        'mail',
        'identifiants_fiscaux_maroc',
    ],
    'data': [
        # Security
        'security/security_access.xml',
        'security/ir.model.access.csv',
        # Data
        'data/mail_template.xml',
        # Wizard
        'wizard/partner_statement_view.xml',
        # Report
        'report/partner_statement_report_pdf.xml',
        # Views
        'views/menus.xml',
    ],
    'images': ['static/description/images/main_screenshot.png'],
    'license': 'LGPL-3',
    'installable': True,
    'application': False,
    'auto_install': False,
}
