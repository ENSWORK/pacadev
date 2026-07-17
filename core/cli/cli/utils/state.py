import json
import yaml
from pathlib import Path
from datetime import datetime

STATE_DIR = Path.home() / ".pacadev" / "state"
AUDIT_LOG = STATE_DIR / "audit-log.jsonl"
VERSIONS_FILE = STATE_DIR / "versions.json"
CONFIG_FILE = Path.home() / ".pacadev" / "config.yaml"
PACADEV_ROOT = Path("/home/pacadev/pacadev")


def load_versions() -> dict:
    if not VERSIONS_FILE.exists():
        return {"clients": {}, "last_sync": None, "pacadev_version": "1.0.0"}
    return json.loads(VERSIONS_FILE.read_text())


def save_versions(data: dict):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    VERSIONS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def get_client_config(client: str) -> dict:
    versions = load_versions()
    return versions["clients"].get(client, {})


def update_client_state(client: str, updates: dict):
    versions = load_versions()
    if client not in versions["clients"]:
        versions["clients"][client] = {}
    versions["clients"][client].update(updates)
    versions["last_sync"] = datetime.now().isoformat()
    save_versions(versions)


def init_client(client: str, odoo_version: str, template: str):
    client_dir = PACADEV_ROOT / f"v{odoo_version}" / "clients" / client
    for sub in ["addons/oca", "addons/custom", "data", ".pacadev"]:
        (client_dir / sub).mkdir(parents=True, exist_ok=True)

    meta = {"client": client, "odoo_version": odoo_version, "template": template, "created_at": datetime.now().isoformat()}
    (client_dir / ".pacadev" / "metadata.json").write_text(json.dumps(meta, indent=2))

    update_client_state(client, {
        "odoo_version": odoo_version,
        "template": template,
        "path": str(client_dir),
        "status": "initialized",
        "created_at": datetime.now().isoformat(),
    })


def list_clients() -> list:
    return list(load_versions()["clients"].keys())


def audit(action: str, client: str, details: dict = None):
    entry = {
        "ts": datetime.now().isoformat(),
        "action": action,
        "client": client,
        **(details or {}),
    }
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with AUDIT_LOG.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    return yaml.safe_load(CONFIG_FILE.read_text()) or {}
