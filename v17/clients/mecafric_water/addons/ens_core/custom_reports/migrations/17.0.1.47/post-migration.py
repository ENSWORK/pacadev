from openupgrade_tools import logging_

_logger = logging_.getLogger(__name__)


def migrate(cr, version):
    _logger.info('Ajout des colonnes de configuration de taille de tableau')
    cr.execute("""
        ALTER TABLE res_company
        ADD COLUMN IF NOT EXISTS table_font_size INTEGER DEFAULT 13;
    """)
    cr.execute("""
        ALTER TABLE res_company
        ADD COLUMN IF NOT EXISTS table_title_font_size INTEGER DEFAULT 14;
    """)
    _logger.info('Colonnes ajoutées avec succès')
