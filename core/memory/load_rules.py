"""Load Odoo standards + pacadev best practices into Mem0. Run once after install."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from memory.mem0_local import get_memory  # noqa: E402

m = get_memory()
if m is None:
    print("ERROR: mem0 not available. pip install mem0ai chromadb", file=sys.stderr)
    sys.exit(1)

RULES = [
    ("odoo17_official", """
Odoo V17 Official Standards:
- Always create ir.model.access.csv for new models
- Use api.depends() for computed fields
- Unit tests in /tests/ with TransactionCase
- XML views: use xpath inheritance, no full replace
- Security: groups on fields/views, not only menus
- Performance: avoid read() in loops, use mapped()
- ORM: prefer env['model'].search() over self.env['model'].search()
- Many2many: define relation with relation= and column1/column2
- Translations: use _(...) for user-facing strings
"""),
    ("odoo19_official", """
Odoo V19 Updates:
- Many2many multi-company native
- Use @api.model_create_multi for bulk create
- Web components v2: use owl for new widgets
- Security: stricter record rules by default
- Performance: improved prefetching on relations
"""),
    ("odoo14_official", """
Odoo V14 Legacy:
- No computed fields with api.depends (use _compute_XXX)
- No @api.model_create_multi (use create())
- Tests: use at_install(False) for slow tests
- Security: record rules less strict -> be careful
"""),
    ("ens_best_practices", """
ENS / pacadev Best Practices:
- 1 commit = 1 logical feature
- Commit names: [ADD]/[FIX]/[REM]/[REF] + short description
- Before commit: run flake8 + pylint-odoo
- Modules: prefix "ens_" for custom modules
- Inheritance: use _inherit; _name only for new model
- Security: test in demo before prod
- Performance: limit complex domains on list views (>10k records)
- Docs: README.md required for each module
- Changelog: keep CHANGELOG.md up to date with semantic versioning
"""),
    ("ens_security", """
Security & RGPD Odoo:
- Never put client data in logs (mask emails/phones)
- Sensitive fields: groups='base.group_system'
- Backups: encrypt PostgreSQL dumps before cloud storage
- API keys: store in secrets/*.enc.yaml (SOPS/age), never in git
- Sessions: 15min timeout for prod
- Audit trail: enable auditlog for sensitive clients
- CSV export: disable for models with personal data
"""),
]

for user_id, text in RULES:
    m.add(text, user_id=user_id)
    print(f"OK: {user_id}")

print("OK: rules loaded into pacadev Mem0")
