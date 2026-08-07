{
    'name': 'ENSWORK Configuration Center',
    'version': '1.0',
    'category': 'Administration',
    'summary': 'Centralisation des paramètres et configurations de système ENSWORK',
    'description': """Module centralisé pour la gestion des paramètres spécifiques à ENSWORK.
        Module de configuration pour les modules Enswork.
        Permet d'activer ou désactiver différentes fonctionnalités.
    """,
    'author': 'ENSWORK',
    'website': 'https://www.enswork.com',
    'depends': [
        'base_setup',
        'web',
        'base',
        'sale_management',
        'purchase',
        'stock',
    ],
    'data': [
        'security/enswork_security.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',    ],

    'assets': {
        'web.assets_backend': [
           'enswork/static/description/settings_enswork.svg',
        ],
    },
    'installable': True,
    'application': True,
    'sequence': 1,
    'auto_install': False,
    'license': 'LGPL-3',
}
