"""Load pacadev client configurations into Mem0. Run once after install."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from memory.mem0_local import get_memory  # noqa: E402

m = get_memory()
if m is None:
    print("ERROR: mem0 not available. pip install mem0ai chromadb", file=sys.stderr)
    sys.exit(1)

# Clients migrés vers pacadev (5 en v17 + specta en v14)
CLIENTS = {
    "afrequip": {
        "version": "17.0",
        "env": "local",
        "modules": ["ens_purchase", "partner_statement_report"],
        "notes": "Active dev. Current ticket: #3 partner_statement_report. Branch: dev/afrequip/3-partner_statement_report.",
    },
    "specta": {
        "version": "14.0",
        "env": "local",
        "modules": ["stock", "ens_core"],
        "notes": "V14: no api.depends; use _compute_XXX. All modules in addons/ens_core/ (no separate oca/).",
    },
    "mecafric": {
        "version": "17.0",
        "env": "local",
        "modules": ["ens_stock", "ens_sale"],
        "notes": "Do not modify stock.picking (EDI connector fragile). Shares OCA addons with mecafric_water via mecafric_group/shared_vps/shared_addons/oca.",
    },
    "mecafric_water": {
        "version": "17.0",
        "env": "local",
        "modules": ["ens_stock"],
        "notes": "Stock module with lot traceability for water. Shares OCA addons with mecafric.",
    },
    "sofetelec": {
        "version": "17.0",
        "env": "local",
        "modules": ["hr_payroll_community"],
        "notes": "23 modules OCA importés de production (v17/clients/sofetelec/addons/oca/). Ticket #11 clôturé. Branche: dev/sofetelec/11-hr_payroll_community.",
    },
}

for client, cfg in CLIENTS.items():
    text = (
        f"Client {client}: Odoo {cfg['version']}, env {cfg['env']}, "
        f"modules: {', '.join(cfg['modules'])}. {cfg['notes']}"
    )
    m.add(text, user_id=client)
    print(f"OK: {client}")

print("OK: clients loaded into pacadev Mem0")
