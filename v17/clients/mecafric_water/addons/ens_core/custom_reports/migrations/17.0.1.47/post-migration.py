def migrate(cr, version):
    cr.execute("""
        ALTER TABLE res_company
        ADD COLUMN IF NOT EXISTS table_font_size INTEGER DEFAULT 13;
    """)
    cr.execute("""
        ALTER TABLE res_company
        ADD COLUMN IF NOT EXISTS table_title_font_size INTEGER DEFAULT 14;
    """)
