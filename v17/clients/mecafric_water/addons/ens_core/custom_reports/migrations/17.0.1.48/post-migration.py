def migrate(cr, version):
    cr.execute("""
        ALTER TABLE res_users
        ADD COLUMN IF NOT EXISTS signature_image BYTEA;
    """)
