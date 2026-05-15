#!/usr/bin/env python3
"""02_extract_secrets.py — Migration des secrets OpenEnsdev → pacadev (SOPS/age).

Lit les secrets en clair d'OpenEnsdev :
  - OpenEnsdev/.env (ANTHROPIC_API_KEY, etc.)
  - Chaque clients/<v>/.../<client>/config/odoo.conf (admin_passwd, db_password)

Produit dans pacadev/core/secrets/ :
  - openensdev_global.enc.yaml (clés globales)
  - <client>.enc.yaml par client trouvé (sauf si déjà présent)

Chiffrement via `sops -e -i` (clé age publique dans .sops.yaml).
JAMAIS de secret affiché sur stdout/stderr.

Idempotent : ne réécrit pas les fichiers existants.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from configparser import ConfigParser
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML manquant : pip install pyyaml", file=sys.stderr)
    sys.exit(2)


OPENENSDEV_ROOT = Path("/home/abdelali/OpenEnsdev")
PACADEV_ROOT = Path("/home/abdelali/pacadev")
SECRETS_DIR = PACADEV_ROOT / "core" / "secrets"

# Schéma canonique (cohérent avec acmecorp.enc.yaml + .env.template.yaml)
SCHEMA_KEYS = [
    "db_password",
    "admin_password",
    "odoo_secret_key",
    "tailscale_auth_key",
    "github_token",
    "anthropic_api_key",
    "grafana_admin_password",
]

PLACEHOLDER = {
    "tailscale_auth_key": "tskey-auth-CHANGE_ME",
    "github_token": "ghp_CHANGE_ME",
    "anthropic_api_key": "sk-ant-api03-CHANGE_ME",
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def parse_dotenv(path: Path) -> dict[str, str]:
    """Parse simple KEY=VALUE (sans interpolation, sans quotes)."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def parse_odoo_conf(path: Path) -> dict[str, str]:
    """Lit la section [options] de odoo.conf."""
    if not path.exists():
        return {}
    cp = ConfigParser(strict=False, interpolation=None)
    try:
        cp.read(path, encoding="utf-8")
    except Exception:
        return {}
    if "options" not in cp:
        return {}
    return dict(cp["options"])


def is_real_secret(value: str) -> bool:
    """Filtre les valeurs vides / placeholders / faibles."""
    if not value:
        return False
    v = value.strip()
    if v.lower() in ("false", "true", "none", "null", ""):
        return False
    if v.startswith("$") or v.startswith("${"):  # déjà variable d'env
        return False
    if v.startswith("<") and v.endswith(">"):  # placeholder
        return False
    return True


def find_client_odoo_confs() -> list[tuple[str, str, Path]]:
    """Cherche tous les odoo.conf sous OpenEnsdev/clients/.

    Retourne [(client_name, odoo_version, config_path), ...].
    Le client name est extrait du parent du dossier config/.
    """
    found: list[tuple[str, str, Path]] = []
    seen: set[tuple[str, str]] = set()  # dédup (client, version)
    clients_root = OPENENSDEV_ROOT / "clients"
    for conf in clients_root.rglob("config/odoo.conf"):
        # Le client est le parent direct de config/
        client_dir = conf.parent.parent
        client_name = client_dir.name
        # Version : remonter jusqu'à un dossier "X.0"
        version = None
        for ancestor in client_dir.parents:
            if re.fullmatch(r"\d+\.0", ancestor.name):
                version = ancestor.name
                break
        if version is None:
            continue
        key = (client_name, version)
        if key in seen:
            continue
        seen.add(key)
        found.append((client_name, version, conf))
    return sorted(found, key=lambda t: (t[1], t[0]))


def build_client_secrets(odoo_conf: dict[str, str]) -> dict[str, str]:
    """Construit le dict secrets à partir d'un odoo.conf parsé."""
    out: dict[str, str] = {}
    admin = odoo_conf.get("admin_passwd", "").strip()
    db_pw = odoo_conf.get("db_password", "").strip()
    out["db_password"] = db_pw if is_real_secret(db_pw) else "CHANGE_ME"
    out["admin_password"] = admin if is_real_secret(admin) else "CHANGE_ME"
    # Champs non extraits → placeholders
    out["odoo_secret_key"] = "CHANGE_ME"
    out["tailscale_auth_key"] = PLACEHOLDER["tailscale_auth_key"]
    out["github_token"] = PLACEHOLDER["github_token"]
    out["anthropic_api_key"] = PLACEHOLDER["anthropic_api_key"]
    out["grafana_admin_password"] = "CHANGE_ME"
    return out


def build_global_secrets(env: dict[str, str]) -> dict[str, str]:
    """Secrets globaux extraits de OpenEnsdev/.env."""
    out = {k: "CHANGE_ME" for k in SCHEMA_KEYS}
    for k in PLACEHOLDER:
        out[k] = PLACEHOLDER[k]
    api_key = env.get("ANTHROPIC_API_KEY", "")
    if is_real_secret(api_key):
        out["anthropic_api_key"] = api_key
    return out


def write_yaml_atomic(path: Path, data: dict) -> None:
    """Écrit YAML avec restrictions de permission (0600)."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(yaml.safe_dump(data, sort_keys=False, default_flow_style=False, allow_unicode=True), encoding="utf-8")
    tmp.chmod(0o600)
    tmp.replace(path)


def sops_encrypt_inplace(path: Path) -> None:
    """Lance `sops -e -i` sur le fichier."""
    r = subprocess.run(
        ["sops", "-e", "-i", str(path)],
        capture_output=True, text=True,
        cwd=PACADEV_ROOT / "core",  # pour résoudre .sops.yaml
    )
    if r.returncode != 0:
        raise RuntimeError(f"sops failed for {path}: {r.stderr}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true",
                    help="Écraser les .enc.yaml existants (par défaut : skip).")
    ap.add_argument("--dry-run", action="store_true",
                    help="N'écrit rien, affiche juste le plan.")
    args = ap.parse_args()

    if not SECRETS_DIR.exists():
        log(f"❌ {SECRETS_DIR} n'existe pas")
        sys.exit(1)

    # 1) Secrets globaux
    log("=== Extraction secrets globaux (OpenEnsdev/.env) ===")
    env = parse_dotenv(OPENENSDEV_ROOT / ".env")
    global_secrets = build_global_secrets(env)
    have_real_key = is_real_secret(env.get("ANTHROPIC_API_KEY", ""))
    log(f"  ANTHROPIC_API_KEY trouvé : {'OUI' if have_real_key else 'NON (placeholder)'}")

    global_target = SECRETS_DIR / "openensdev_global.enc.yaml"
    global_clear = SECRETS_DIR / "openensdev_global.yaml"

    if global_target.exists() and not args.force:
        log(f"  SKIP {global_target.name} (existe déjà, --force pour écraser)")
    elif args.dry_run:
        log(f"  [DRY] Écrirait {global_target}")
    else:
        write_yaml_atomic(global_clear, global_secrets)
        sops_encrypt_inplace(global_clear)
        # sops -e -i remplace le contenu, mais ne renomme pas → on renomme nous-mêmes
        global_clear.rename(global_target)
        log(f"  ✅ {global_target.name}")

    # 2) Secrets par client (odoo.conf)
    log("\n=== Extraction secrets clients (odoo.conf) ===")
    confs = find_client_odoo_confs()
    log(f"  {len(confs)} configs trouvées :")
    summary: list[tuple[str, str, str]] = []  # (client, version, action)
    for client, version, conf_path in confs:
        secrets = build_client_secrets(parse_odoo_conf(conf_path))
        target = SECRETS_DIR / f"{client}.enc.yaml"
        clear = SECRETS_DIR / f"{client}.yaml"
        has_real = (
            secrets["admin_password"] != "CHANGE_ME"
            or secrets["db_password"] != "CHANGE_ME"
        )
        if target.exists() and not args.force:
            summary.append((client, version, f"skip (existant)"))
            continue
        if args.dry_run:
            summary.append((client, version, f"DRY (has_real={has_real})"))
            continue
        write_yaml_atomic(clear, secrets)
        try:
            sops_encrypt_inplace(clear)
            clear.rename(target)
            summary.append((client, version, f"OK (has_real={has_real})"))
        except Exception as e:
            # Sécurité : si chiffrement échoue, supprimer le clair
            if clear.exists():
                clear.unlink()
            summary.append((client, version, f"FAIL: {e}"))

    log("\n=== Résumé ===")
    for client, version, action in summary:
        log(f"  {version}/{client:30} → {action}")

    # 3) Nettoyage paranoid : aucun .yaml clair résiduel à part le template
    leftovers = [
        p for p in SECRETS_DIR.glob("*.yaml")
        if p.name not in (".env.template.yaml",) and not p.name.endswith(".enc.yaml")
    ]
    if leftovers:
        log("\n⚠️  ATTENTION : fichiers clairs résiduels (à supprimer manuellement) :")
        for p in leftovers:
            log(f"    {p}")
    else:
        log("\n✅ Aucun fichier clair résiduel.")


if __name__ == "__main__":
    main()
