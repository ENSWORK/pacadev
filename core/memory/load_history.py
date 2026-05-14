"""Load historical fixes/bugs into Mem0. Run regularly (monthly)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from memory.mem0_local import get_memory  # noqa: E402

m = get_memory()
if m is None:
    print("ERROR: mem0 not available. pip install mem0ai chromadb", file=sys.stderr)
    sys.exit(1)

FIXES = [
    ("mecafric", "Bug #45: computed field delivery_delay crash on partner without country_id -> guard on country_id"),
    ("mecafric", "Migration from OpenEnsdev: odoo.conf admin_passwd was in clear text — now managed via SOPS/age secrets (mecafric.enc.yaml)."),
    ("mecafric_water", "Migration from OpenEnsdev: shares odoo.conf with mecafric_group/shared_vps — no standalone config file."),
    ("afrequip", "Issue #3 partner_statement_report: module lives in addons/oca/ (not ens_core/). Branch: dev/afrequip/3-partner_statement_report."),
    ("specta", "V14: _compute_amount() in loop -> timeout on 10k lines -> use read_group()"),
    ("specta", "Migration from OpenEnsdev: v14 stores ALL modules (OCA+ENS) in addons/ens_core/ — no separate addons/oca/."),
]

for client, fix in FIXES:
    m.add(f"Past fix: {fix}", user_id=f"history_{client}")
    print(f"OK: history {client}")

print("OK: history loaded into pacadev Mem0")
