# __manifest__.py

{
    'name': 'Custom Company Fields',
    'version': '17.0.1.0.0',
    'category': 'Tools',
    'summary': 'Ajoute des champs personnalisés aux informations de société',
    'author': 'Votre Nom',
    'website': 'https://votre-site.com ',
    'depends': ['base'],
    'data': [
        'views/custom_company_fields_views.xml',
    ],
    'installable': True,
    'application': False,
}
