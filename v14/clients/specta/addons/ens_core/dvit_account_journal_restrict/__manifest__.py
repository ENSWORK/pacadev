# -*- coding: utf-8 -*-
#It was v10 and wa adapted to v14 by L
{
    'name': "Journal Restrictions[Migrated 10 ->14]",
    'summary': """Restrict users to certain journals""",
    'description': """Restrict users to certain journals.""",
    'author': "DVIT.ME",
    'website': "http://www.dvit.me",
    'license': 'AGPL-3',
    'category': 'account',
    'version': '14.0.0.0',
    'depends': ['account'],
    'data': [
        'views/users.xml',
        'security/security.xml',
    ],
    "images": [
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
}

