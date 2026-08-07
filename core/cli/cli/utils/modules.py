"""Utilitaires de gestion des modules partagés : versions manifest + lock files.

Le lock file (`module-versions.lock`, YAML) épingle, pour chaque client, la version
des modules partagés réellement chargée au runtime. L'ordre addons_path est
déterminant : oca → ens_core → ens_core_shared (le premier dossier trouvé gagne).
"""
import ast
import re
from datetime import datetime
from pathlib import Path

import yaml

SHARED_DIR_REL = "modules/ens_core-17"
LOCK_FILE_NAME = "module-versions.lock"
# Ordre du addons_path (le premier dossier contenant le module gagne)
ADDONS_ORDER = ["oca", "ens_core", "ens_core_shared"]


def get_manifest(module_dir: Path) -> dict:
    """Charge __manifest__.py d'un module (dict de littéraux Python)."""
    manifest_file = module_dir / "__manifest__.py"
    if not manifest_file.exists():
        return {}
    src = manifest_file.read_text(encoding="utf-8", errors="replace")
    try:
        # ast.literal_eval refuse les commentaires : on les retire en début de ligne
        cleaned = re.sub(r"(?m)^\s*#.*$", "", src)
        data = ast.literal_eval(cleaned)
        return data if isinstance(data, dict) else {}
    except (ValueError, SyntaxError):
        # Fallback : regex sur la clé version
        m = re.search(r"['\"]version['\"]\s*:\s*['\"]([^'\"]+)['\"]", src)
        return {"version": m.group(1)} if m else {}


def module_version(module_dir: Path) -> str | None:
    """Version du manifest d'un module (None si absent)."""
    return get_manifest(module_dir).get("version")


def find_modules(base_dir: Path) -> dict:
    """{nom_module: version} pour les sous-dossiers ayant un __manifest__.py."""
    out = {}
    if not base_dir.exists():
        return out
    for child in sorted(base_dir.iterdir()):
        if child.is_dir() and (child / "__manifest__.py").exists():
            out[child.name] = module_version(child) or "0"
    return out


def shared_dir(root: Path) -> Path:
    return root / SHARED_DIR_REL


def resolve_client_modules(root: Path, client: str, odoo_version: str) -> dict:
    """Résout les versions des modules PARTAGÉS effectivement chargées par un client.

    Périmètre = modules du dossier partagé (modules/ens_core-17). Pour chacun,
    la version chargée suit l'ordre addons_path : oca → ens_core → ens_core_shared
    (le premier dossier contenant le module gagne, ce qui permet de détecter les
    forks locaux qui masquent le partagé).

    Retourne {module: {"version": str, "source": "oca"|"ens_core"|"ens_core_shared"}}.
    """
    client_base = root / f"v{odoo_version}" / "clients" / client / "addons"
    shared_modules = find_modules(shared_dir(root))
    resolved = {}
    for name in shared_modules:
        for addon in ADDONS_ORDER:
            base = shared_dir(root) if addon == "ens_core_shared" else client_base / addon
            versions = find_modules(base)
            if name in versions:
                resolved[name] = {"version": versions[name], "source": addon}
                break
    return resolved


def lock_path(root: Path, client: str, odoo_version: str) -> Path:
    return root / f"v{odoo_version}" / "clients" / client / LOCK_FILE_NAME


def load_lock(root: Path, client: str, odoo_version: str) -> dict:
    """Charge le lock file d'un client ({} si absent)."""
    path = lock_path(root, client, odoo_version)
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data.get("modules", {}) if isinstance(data, dict) else {}


def save_lock(root: Path, client: str, odoo_version: str, modules: dict) -> Path:
    """Écrit le lock file des versions épinglées pour un client."""
    path = lock_path(root, client, odoo_version)
    data = {
        "client": client,
        "odoo_version": odoo_version,
        "generated_at": datetime.now().isoformat(),
        "comment": "Généré par PACADEV. Épingle les versions effectivement chargées.",
        "modules": {name: info["version"] for name, info in sorted(modules.items())},
    }
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True))
    return path


def check_lock(root: Path, client: str, odoo_version: str) -> dict:
    """Compare le lock au code réellement monté.

    Retourne {module: {"locked", "actual", "source", "ok"}}.
    """
    locked = load_lock(root, client, odoo_version)
    resolved = resolve_client_modules(root, client, odoo_version)
    report = {}
    for name, locked_ver in locked.items():
        actual = resolved.get(name)
        actual_ver = actual["version"] if actual else None
        report[name] = {
            "locked": locked_ver,
            "actual": actual_ver,
            "source": actual["source"] if actual else "missing",
            "ok": actual_ver == locked_ver,
        }
    return report
