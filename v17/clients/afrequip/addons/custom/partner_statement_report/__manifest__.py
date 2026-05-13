{
    'name': 'Partner Statement Report - Afrequip Custom',
    'version': '17.0.1.0.0',
    'category': 'Accounting',
    'summary': 'Partner Statement Report with Afrequip customizations',
    'author': 'ENSWORK',
    'depends': ['account', 'partner_statement_report'],
    'data': [
        'security/ir.model.access.csv',
        'views/partner_statement_report_view.xml',
        'report/partner_statement_report_pdf.xml',
        'report/partner_statement_details.xml',
        'data/reports.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'AGPL-3',
}
