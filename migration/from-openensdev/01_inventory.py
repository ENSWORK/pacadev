#!/usr/bin/env python3
"""01_inventory.py — Inventaire exhaustif de l'orchestrateur OpenEnsdev.

Scanne /home/abdelali/OpenEnsdev et produit un YAML décrivant :
- chaque client (version Odoo, chemin, état Docker, taille filestore, modules custom, secrets)
- les bases PostgreSQL accessibles via les conteneurs running
- l'état des services partagés (Traefik, Portainer, PG)
- les modules ENS centralisés dans main-dev-repo/

Sortie : migration/from-openensdev/inventory_<YYYY-MM-DD_HHMM>.yaml
Lecture seule. Aucune action destructive.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from configparser import ConfigParser
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("PyYAML manquant. Installer avec: pip install pyyaml", file=sys.stderr)
    sys.exit(2)


OPENENSDEV_ROOT = Path("/home/abdelali/OpenEnsdev")
PACADEV_ROOT = Path("/home/abdelali/pacadev")


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def du_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for f in path.rglob("*"):
        try:
            if f.is_file() and not f.is_symlink():
                total += f.stat().st_size
        except (OSError, PermissionError):
            continue
    return total


def fmt_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}PB"


def docker_running_containers() -> list[dict[str, str]]:
    r = run(["docker", "ps", "--format", "{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"])
    out = []
    for line in r.stdout.strip().splitlines():
        parts = line.split("|", 3)
        if len(parts) == 4:
            out.append({"name": parts[0], "image": parts[1], "status": parts[2], "ports": parts[3]})
    return out


def docker_all_containers() -> list[dict[str, str]]:
    r = run(["docker", "ps", "-a", "--format", "{{.Names}}|{{.Image}}|{{.Status}}"])
    out = []
    for line in r.stdout.strip().splitlines():
        parts = line.split("|", 2)
        if len(parts) == 3:
            out.append({"name": parts[0], "image": parts[1], "status": parts[2]})
    return out


def docker_networks() -> list[str]:
    r = run(["docker", "network", "ls", "--format", "{{.Name}}"])
    return [n for n in r.stdout.strip().splitlines() if n]


def docker_volumes() -> list[str]:
    r = run(["docker", "volume", "ls", "--format", "{{.Name}}"])
    return [v for v in r.stdout.strip().splitlines() if v]


def pg_list_databases(container: str, user: str = "odoo") -> list[dict[str, Any]]:
    """Liste les bases (nom + taille) d'un conteneur PostgreSQL."""
    q = (
        "SELECT datname, pg_database_size(datname) "
        "FROM pg_database WHERE datistemplate=false ORDER BY datname;"
    )
    # se connecter à la DB 'postgres' (toujours présente) pour éviter les erreurs
    # quand l'utilisateur n'a pas de DB éponyme.
    r = run(["docker", "exec", container, "psql", "-U", user, "-d", "postgres", "-tAc", q])
    if r.returncode != 0:
        return [{"error": r.stderr.strip() or "psql failed"}]
    rows = []
    for line in r.stdout.strip().splitlines():
        if "|" in line:
            name, size = line.split("|", 1)
            try:
                rows.append({"name": name.strip(), "size_bytes": int(size.strip()), "size": fmt_size(int(size.strip()))})
            except ValueError:
                rows.append({"name": name.strip(), "size_bytes": 0, "size": "?"})
    return rows


def parse_odoo_conf(path: Path) -> dict[str, str]:
    """Lit odoo.conf et retourne un dict des options (avec secrets éventuels)."""
    if not path.exists():
        return {}
    cp = ConfigParser()
    try:
        cp.read(path)
    except Exception as e:
        return {"_parse_error": str(e)}
    if "options" not in cp:
        return {"_no_options_section": True}
    return dict(cp["options"])


def detect_clear_secrets(conf: dict[str, str]) -> list[str]:
    """Détecte les secrets en clair dans une config Odoo."""
    flags = []
    for k in ("admin_passwd", "db_password"):
        v = conf.get(k, "").strip()
        if v and v not in ("False", "false", "", "$ODOO_ADMIN_PASSWD", "$DB_PASSWORD"):
            flags.append(f"{k}=<CLAIR>")
    return flags


def parse_manifest(manifest_path: Path) -> dict[str, Any]:
    """Parse __manifest__.py (un dict Python) sans l'exécuter."""
    if not manifest_path.exists():
        return {}
    src = manifest_path.read_text(encoding="utf-8", errors="ignore")
    # parse via ast.literal_eval — sécurisé
    import ast
    try:
        node = ast.parse(src, mode="exec")
        for stmt in node.body:
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Dict):
                d = ast.literal_eval(stmt.value)
                if isinstance(d, dict):
                    return d
    except Exception:
        # fallback regex
        try:
            m = re.search(r"\{.*\}", src, re.DOTALL)
            if m:
                return ast.literal_eval(m.group(0))
        except Exception as e:
            return {"_parse_error": str(e)}
    return {}


def list_compose_services(compose: Path) -> dict[str, Any]:
    """Liste les services d'un docker-compose.yml."""
    if not compose.exists():
        return {}
    try:
        data = yaml.safe_load(compose.read_text(encoding="utf-8"))
    except Exception as e:
        return {"_parse_error": str(e)}
    services = data.get("services", {}) if isinstance(data, dict) else {}
    out = {}
    for sname, svc in services.items():
        out[sname] = {
            "image": svc.get("image", "?"),
            "ports": svc.get("ports", []),
            "networks": list((svc.get("networks") or {}).keys()) if isinstance(svc.get("networks"), dict) else (svc.get("networks") or []),
            "volumes_count": len(svc.get("volumes", []) or []),
        }
    return out


def list_addons(addons_dir: Path) -> list[str]:
    """Liste les sous-dossiers (= modules) d'un dossier addons."""
    if not addons_dir.exists() or not addons_dir.is_dir():
        return []
    out = []
    for p in sorted(addons_dir.iterdir()):
        if p.is_dir() and (p / "__manifest__.py").exists():
            out.append(p.name)
    return out


def inventory_client(client_dir: Path, version: str, running_containers: list[dict]) -> dict[str, Any]:
    cname = client_dir.name
    compose = client_dir / "docker-compose.yml"
    config_path = client_dir / "config" / "odoo.conf"
    filestore = client_dir / "filestore"
    addons_dir = client_dir / "addons"
    backups_dir = client_dir / "backups"

    odoo_conf = parse_odoo_conf(config_path)
    secrets_flags = detect_clear_secrets(odoo_conf)

    # détecter conteneurs liés
    related_containers = [c for c in running_containers if cname in c["name"]]

    addon_buckets = {}
    if addons_dir.exists():
        for sub in addons_dir.iterdir():
            if sub.is_dir():
                addon_buckets[sub.name] = list_addons(sub)

    return {
        "name": cname,
        "odoo_version": version,
        "path": str(client_dir),
        "compose": list_compose_services(compose),
        "odoo_conf": {
            k: ("<MASKED>" if k in ("admin_passwd", "db_password") and v not in ("", "False", "false") else v)
            for k, v in odoo_conf.items()
        },
        "secrets_in_clear": secrets_flags,
        "filestore_size_bytes": du_bytes(filestore),
        "filestore_size": fmt_size(du_bytes(filestore)),
        "addons_buckets": addon_buckets,
        "backups_dir_exists": backups_dir.exists(),
        "running_containers": [c["name"] for c in related_containers],
        "container_status": {c["name"]: c["status"] for c in related_containers},
    }


def inventory_modules(repo_root: Path) -> dict[str, Any]:
    """Inventaire des modules ENS centralisés."""
    out = {}
    for v in (14, 17, 19):
        ens_dir = repo_root / f"ens_core-{v}"
        if not ens_dir.exists():
            continue
        modules = []
        for mod_dir in sorted(ens_dir.iterdir()):
            if not mod_dir.is_dir() or not (mod_dir / "__manifest__.py").exists():
                continue
            m = parse_manifest(mod_dir / "__manifest__.py")
            modules.append({
                "name": mod_dir.name,
                "version": m.get("version", "?"),
                "summary": m.get("summary", ""),
                "depends": m.get("depends", []),
                "installable": m.get("installable", True),
                "license": m.get("license", "?"),
            })
        out[f"v{v}"] = modules
    return out


def inventory_infra(root: Path) -> dict[str, Any]:
    services = {}
    for svc_name in ("postgres", "traefik", "portainer"):
        svc_dir = root / "infra" / svc_name
        compose = svc_dir / "docker-compose.yml"
        if compose.exists():
            services[svc_name] = {
                "compose_path": str(compose),
                "services": list_compose_services(compose),
            }
    # Scripts
    scripts = {}
    for script_dir in (root / "infra" / "scripts", root / "scripts"):
        if script_dir.exists():
            scripts[str(script_dir.relative_to(root))] = sorted(
                p.name for p in script_dir.iterdir() if p.is_file()
            )
    return {"services": services, "scripts": scripts}


def inventory_state(home: Path) -> dict[str, Any]:
    """État runtime ~/.ensdev/, ChromaDB, Mem0 history."""
    out = {}
    ensdev_dir = home / ".ensdev"
    if ensdev_dir.exists():
        wf_dir = ensdev_dir / "workflow"
        out["ensdev"] = {
            "path": str(ensdev_dir),
            "workflow_tickets": (
                [p.name for p in wf_dir.iterdir() if p.is_file()] if wf_dir.exists() else []
            ),
            "history_log_bytes": (
                (ensdev_dir / "history.log").stat().st_size
                if (ensdev_dir / "history.log").exists()
                else 0
            ),
        }
    chroma = OPENENSDEV_ROOT / "cli" / "ensdev" / "memory" / "chroma_db"
    if chroma.exists():
        out["chroma_db"] = {
            "path": str(chroma),
            "size_bytes": du_bytes(chroma),
            "size": fmt_size(du_bytes(chroma)),
        }
    mem0 = home / ".mem0"
    if mem0.exists():
        out["mem0"] = {"path": str(mem0), "size_bytes": du_bytes(mem0), "size": fmt_size(du_bytes(mem0))}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output-dir", default=str(PACADEV_ROOT / "migration" / "from-openensdev"))
    ap.add_argument("--include-pg-databases", action="store_true",
                    help="Interroger les conteneurs PostgreSQL pour lister les bases (lent).")
    args = ap.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_file = output_dir / f"inventory_{ts}.yaml"

    print(f"== INVENTAIRE OpenEnsdev → {out_file} ==", file=sys.stderr)

    running = docker_running_containers()
    all_containers = docker_all_containers()

    # Clients
    clients_dir = OPENENSDEV_ROOT / "clients"
    clients_inventory: dict[str, list[dict]] = {}
    for version_dir in sorted(clients_dir.glob("*.0")):
        version = version_dir.name  # ex: "14.0"
        clients_inventory[version] = []
        # local + vps_partage + vps_dedie
        for parent in version_dir.iterdir():
            if not parent.is_dir():
                continue
            # cherche client dirs (peut être profondeur 1 ou 2)
            candidates = [parent] if (parent / "docker-compose.yml").exists() else list(parent.iterdir())
            for client_dir in candidates:
                if not client_dir.is_dir():
                    continue
                if not (client_dir / "docker-compose.yml").exists():
                    # essayer un niveau plus bas (vps_dedie/<client>/)
                    for deeper in client_dir.iterdir() if client_dir.is_dir() else []:
                        if deeper.is_dir() and (deeper / "docker-compose.yml").exists():
                            print(f"  - {version} :: {deeper.name}", file=sys.stderr)
                            clients_inventory[version].append(
                                inventory_client(deeper, version, running)
                            )
                    continue
                print(f"  - {version} :: {client_dir.name}", file=sys.stderr)
                clients_inventory[version].append(inventory_client(client_dir, version, running))

    # Modules ENS
    modules = inventory_modules(OPENENSDEV_ROOT / "main-dev-repo")

    # Infra
    infra = inventory_infra(OPENENSDEV_ROOT)

    # État runtime
    state = inventory_state(Path.home())

    # Bases PostgreSQL (optionnel)
    pg_dbs = {}
    if args.include_pg_databases:
        pg_containers = [c for c in running if "postgres" in c["image"]]
        for c in pg_containers:
            print(f"  PG: {c['name']}...", file=sys.stderr)
            pg_dbs[c["name"]] = {
                "image": c["image"],
                "databases": pg_list_databases(c["name"]),
            }

    # Compute totals
    total_clients = sum(len(v) for v in clients_inventory.values())
    total_filestore = sum(
        c["filestore_size_bytes"] for v in clients_inventory.values() for c in v
    )
    secrets_count = sum(
        len(c["secrets_in_clear"]) for v in clients_inventory.values() for c in v
    )

    doc = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "openensdev_root": str(OPENENSDEV_ROOT),
            "pacadev_root": str(PACADEV_ROOT),
            "host": run(["hostname"]).stdout.strip(),
            "user": run(["whoami"]).stdout.strip(),
        },
        "summary": {
            "total_clients_with_compose": total_clients,
            "total_filestore_bytes": total_filestore,
            "total_filestore": fmt_size(total_filestore),
            "secrets_in_clear_count": secrets_count,
            "running_containers": len(running),
            "all_containers": len(all_containers),
        },
        "docker": {
            "running_containers": running,
            "all_containers": all_containers,
            "networks": docker_networks(),
            "volumes": docker_volumes(),
        },
        "infra": infra,
        "modules_ens": modules,
        "clients": clients_inventory,
        "runtime_state": state,
        "postgres_databases": pg_dbs if args.include_pg_databases else "skipped (use --include-pg-databases)",
    }

    out_file.write_text(yaml.safe_dump(doc, default_flow_style=False, sort_keys=False, allow_unicode=True))
    print(f"\nOK: {out_file} ({out_file.stat().st_size} bytes)", file=sys.stderr)
    print(f"Clients: {total_clients} | Filestore total: {fmt_size(total_filestore)} | Secrets en clair: {secrets_count}", file=sys.stderr)

    # also produce a quick human-readable summary
    summary_file = output_dir / f"inventory_{ts}_summary.md"
    lines = [
        f"# Inventaire OpenEnsdev — {ts}",
        "",
        "## Synthèse",
        f"- Clients avec docker-compose : **{total_clients}**",
        f"- Filestore total : **{fmt_size(total_filestore)}**",
        f"- Secrets en clair détectés : **{secrets_count}**",
        f"- Conteneurs running : **{len(running)}** / total : **{len(all_containers)}**",
        "",
        "## Conteneurs running",
        "",
    ]
    for c in running:
        lines.append(f"- `{c['name']}` ({c['image']}) — {c['status']}")
    lines.append("")
    lines.append("## Clients par version")
    for version, clist in clients_inventory.items():
        lines.append(f"\n### {version} ({len(clist)} clients)")
        lines.append("")
        for c in clist:
            running_str = ", ".join(c["running_containers"]) if c["running_containers"] else "—"
            lines.append(
                f"- **{c['name']}** | filestore: {c['filestore_size']} | containers: {running_str} | secrets clair: {len(c['secrets_in_clear'])}"
            )
    lines.append("")
    lines.append("## Modules ENS")
    for v, mods in modules.items():
        lines.append(f"\n### {v} ({len(mods)} modules)")
        lines.append("")
        for m in mods:
            lines.append(f"- `{m['name']}` v{m['version']} — deps: {len(m['depends'])}")

    summary_file.write_text("\n".join(lines))
    print(f"OK: {summary_file}", file=sys.stderr)


if __name__ == "__main__":
    main()
