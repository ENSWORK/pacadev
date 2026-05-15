#!/usr/bin/env python3
"""04_migrate_client.py — Migration structurelle d'un client OpenEnsdev → pacadev.

Tâches réalisées par client :
  1. Crée pacadev/v<V>/clients/<C>/ si absent
  2. Copie/complète addons/ (sauf ens_core qui pointe vers pacadev/modules/ens_core-<V>)
  3. Génère docker-compose.yml adapté (network=pacadev-network, secrets via env, ports)
  4. Génère config/odoo.conf depuis SOPS (admin_passwd/db_password en env vars)
  5. Copie filestore/ depuis OpenEnsdev (avec exclusions)
  6. Met à jour .pacadev/state/versions.json
  7. Génère .pacadev/clients/<C>/config.json (métadonnées migration)

NE DÉMARRE PAS de conteneurs. NE TOUCHE PAS à OpenEnsdev (lecture seule).

Usage :
  python3 04_migrate_client.py --client specta --version 14 --source <path>
  python3 04_migrate_client.py --client mecafric --version 17 --source <path>
  python3 04_migrate_client.py --dry-run ...
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

OPENENSDEV_ROOT = Path("/home/abdelali/OpenEnsdev")
PACADEV_ROOT = Path("/home/abdelali/pacadev")
PACADEV_STATE_DIR = Path.home() / ".pacadev"

# Ports alloués par client (cohérent avec OpenEnsdev pour éviter collisions
# pendant la coexistence). Ports utilisés actuellement : 8070 (afrequip).
DEFAULT_PORTS = {
    "specta": 8089,
    "mecafric": 8092,
    "mecafric_water": 8076,
    "afrequip": 8070,
}

# DB names par client (alignés sur OpenEnsdev conventions)
DEFAULT_DB_NAMES = {
    "specta": "specta_prod",
    "mecafric": "mecafric_prod",
    "mecafric_water": "mecafric_water_prod",
    "afrequip": "afrequip_prod",
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def render_compose(client: str, version: str, port: int, db_name: str) -> str:
    """Génère le contenu docker-compose.yml adapté pacadev.

    v14 : tout est dans addons/ens_core (organisation legacy, modules OCA inclus).
          Pas de bind externe (pacadev/modules/ens_core-14 est vide).
    v17+: ens_core bind externe vers pacadev/modules/ens_core-<v> + addons/oca local.
    """
    odoo_image = f"odoo:{version}.0"
    if version == "14":
        # Volumes simples : addons/ens_core local (contient tout)
        volumes_block = f"""      - ./addons/ens_core:/mnt/extra-addons/ens_core:ro
      - ./config:/etc/odoo
      - ./filestore:/var/lib/odoo/filestore"""
        addons_note = "v14 : tous les modules sont dans addons/ens_core local."
    else:
        # v17+ : ens_core externe (pacadev/modules/) + oca local
        volumes_block = f"""      - /home/abdelali/pacadev/modules/ens_core-{version}:/mnt/extra-addons/ens_core:ro
      - ./addons/oca:/mnt/extra-addons/oca:ro
      - ./config:/etc/odoo
      - ./filestore:/var/lib/odoo/filestore"""
        addons_note = f"v{version} : ens_core bind externe vers pacadev/modules/ens_core-{version}/."
    return f"""# Auto-généré par migration/from-openensdev/04_migrate_client.py
# Client : {client}  (Odoo {version})  port host : {port}
# {addons_note}
#
# Prérequis :
#   - infra pacadev démarrée : pacadev infra start
#   - DB '{db_name}' existante dans pacadev_postgres_shared
#   - Secrets injectés via : eval $(sops -d core/secrets/{client}.enc.yaml | yq ...)
#
services:
  {client}_odoo:
    image: {odoo_image}
    container_name: {client}_odoo
    environment:
      HOST: pacadev_postgres_shared
      USER: ${{POSTGRES_USER:-odoo}}
      PASSWORD: ${{POSTGRES_PASSWORD:-odoo}}
      DB_NAME: {db_name}
      ODOO_ADMIN_PASSWD: ${{ODOO_ADMIN_PASSWD:?Set via sops -d core/secrets/{client}.enc.yaml}}
    volumes:
{volumes_block}
    ports:
      - "{port}:8069"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8069/web/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - pacadev-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.{client}.rule=Host(`{client}.pacadev.local`)"
      - "traefik.http.routers.{client}.entrypoints=web"
      - "traefik.http.services.{client}.loadbalancer.server.port=8069"

networks:
  pacadev-network:
    external: true
"""


def render_odoo_conf(client: str, version: str) -> str:
    """Génère odoo.conf avec admin_passwd/db_password via variables d'env."""
    if version == "14":
        addons_path = "/mnt/extra-addons/ens_core,/usr/lib/python3/dist-packages/odoo/addons"
    else:
        addons_path = "/mnt/extra-addons/ens_core,/mnt/extra-addons/oca,/usr/lib/python3/dist-packages/odoo/addons"
    return f"""# Auto-généré pour client {client} (Odoo {version})
# Les secrets sont injectés via variables d'environnement au démarrage du conteneur.
# Source : core/secrets/{client}.enc.yaml (sops -d)

[options]
addons_path = {addons_path}
data_dir = /var/lib/odoo

; Secrets injectés via env vars (cf. docker-compose.yml)
admin_passwd = $ODOO_ADMIN_PASSWD
db_host = pacadev_postgres_shared
db_port = 5432
db_user = $USER
db_password = $PASSWORD

; Performance
workers = 0
max_cron_threads = 1
limit_time_real = 600
limit_time_cpu = 600

; Sécurité
without_demo = False
list_db = False
"""


def find_oca_addons_source(client: str, version: str, openensdev_client_path: Path) -> Path | None:
    """Trouve le dossier oca le plus complet pour un client donné.

    Pour les clients du mecafric_group, les addons sont dans `shared_vps/shared_addons/oca/`.
    Pour les autres, dans `<client>/addons/oca/`.
    """
    direct = openensdev_client_path / "addons" / "oca"
    if direct.exists() and any(direct.iterdir()):
        return direct
    # Cas mecafric_group : remonter vers shared_vps
    shared = openensdev_client_path.parent / "shared_vps" / "shared_addons" / "oca"
    if shared.exists() and any(shared.iterdir()):
        return shared
    return None


def copy_addons_oca(source: Path | None, target_dir: Path, dry_run: bool) -> int:
    """Copie le dossier OCA (modules tiers) depuis source vers target."""
    target_oca = target_dir / "addons" / "oca"
    target_oca.parent.mkdir(parents=True, exist_ok=True)
    if not source:
        log(f"  ⚠️  Aucun dossier oca/ trouvé pour {target_dir.name}")
        target_oca.mkdir(exist_ok=True)
        return 0
    if target_oca.exists() and any(target_oca.iterdir()):
        log(f"  → addons/oca déjà non-vide, skip ({target_oca})")
        return 0
    if dry_run:
        log(f"  [DRY] rsync {source} → {target_oca}")
        return 0
    subprocess.run(
        ["rsync", "-a", "--exclude=__pycache__", "--exclude=*.pyc",
         f"{source}/", f"{target_oca}/"],
        check=True
    )
    count = sum(1 for _ in target_oca.iterdir())
    log(f"  ✅ oca/ : {count} modules copiés depuis {source}")
    return count


def copy_filestore(source: Path, target_dir: Path, dry_run: bool) -> int:
    """Copie le filestore depuis source."""
    target_fs = target_dir / "filestore"
    if not source.exists():
        log(f"  ⚠️  Filestore source absent : {source}")
        target_fs.mkdir(exist_ok=True)
        return 0
    target_fs.mkdir(parents=True, exist_ok=True)
    if any(target_fs.iterdir()):
        log(f"  → filestore déjà non-vide, skip ({target_fs})")
        return 0
    if dry_run:
        log(f"  [DRY] rsync {source} → {target_fs}")
        return 0
    subprocess.run(["rsync", "-a", f"{source}/", f"{target_fs}/"], check=True)
    size = sum(f.stat().st_size for f in target_fs.rglob("*") if f.is_file())
    log(f"  ✅ filestore : {size // 1024 // 1024} MB copiés")
    return size


def write_compose(target_dir: Path, client: str, version: str, port: int, db_name: str, dry_run: bool) -> None:
    compose_path = target_dir / "docker-compose.yml"
    if compose_path.exists():
        # Vérifier s'il pointe vers l'ancien odoo_postgres_shared (cassé) ou odoo-network (cassé)
        content = compose_path.read_text(encoding="utf-8")
        broken = "odoo_postgres_shared" in content or "odoo-network" in content
        if broken:
            backup = compose_path.with_suffix(".yml.openensdev_backup")
            log(f"  ⚠️  docker-compose.yml existant cassé (référence odoo_postgres_shared/odoo-network)")
            if not dry_run:
                shutil.copy2(compose_path, backup)
                log(f"     → backup : {backup.name}")
                compose_path.write_text(render_compose(client, version, port, db_name), encoding="utf-8")
                log(f"  ✅ docker-compose.yml réécrit (pacadev-compatible)")
            return
        else:
            log(f"  → docker-compose.yml existant propre, skip")
            return
    content = render_compose(client, version, port, db_name)
    if dry_run:
        log(f"  [DRY] écrirait {compose_path} ({len(content)} octets)")
        return
    compose_path.write_text(content, encoding="utf-8")
    log(f"  ✅ {compose_path.name} créé")


def write_odoo_conf(target_dir: Path, client: str, version: str, dry_run: bool) -> None:
    config_dir = target_dir / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    conf_path = config_dir / "odoo.conf"
    if conf_path.exists():
        # Vérifier qu'il ne contient pas de secret en clair (chars : @, _, -, etc. tolérés)
        content = conf_path.read_text(encoding="utf-8", errors="ignore")
        has_clear = bool(re.search(r"admin_passwd\s*=\s*[^\s$\n<][\w@!#%^&*()_+\-=.]+", content))
        if has_clear:
            log(f"  ⚠️  odoo.conf existant contient admin_passwd en clair, RÉÉCRITURE forcée")
            if not dry_run:
                # backup avant écrasement
                backup = conf_path.with_suffix(".conf.openensdev_backup")
                shutil.copy2(conf_path, backup)
                log(f"     → backup : {backup.name}")
                conf_path.write_text(render_odoo_conf(client, version), encoding="utf-8")
            log(f"  ✅ odoo.conf nettoyé (secrets → env vars)")
        else:
            log(f"  → odoo.conf existant déjà propre (sans secrets clair), skip")
        return
    if dry_run:
        log(f"  [DRY] écrirait {conf_path}")
        return
    conf_path.write_text(render_odoo_conf(client, version), encoding="utf-8")
    log(f"  ✅ config/odoo.conf créé")


def update_versions_json(client: str, version: str, source_path: Path, dry_run: bool) -> None:
    """Met à jour .pacadev/state/versions.json."""
    state_file = PACADEV_STATE_DIR / "state" / "versions.json"
    state_file.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if state_file.exists():
        try:
            data = json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    data.setdefault("clients", {})[client] = {
        "odoo_version": version,
        "status": "migrated",
        "migrated_from": "openensdev",
        "migration_date": datetime.utcnow().isoformat(),
        "source_path": str(source_path),
        "target_path": str(PACADEV_ROOT / f"v{version}" / "clients" / client),
    }
    if dry_run:
        log(f"  [DRY] versions.json + clients.{client}")
        return
    state_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"  ✅ versions.json mis à jour")


def write_client_config(client: str, version: str, source_path: Path, port: int, db_name: str, dry_run: bool) -> None:
    """Génère .pacadev/clients/<C>/config.json."""
    client_dir = PACADEV_STATE_DIR / "clients" / client
    client_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "client": client,
        "odoo_version": version,
        "migrated_from": "openensdev",
        "migration_date": datetime.utcnow().isoformat(),
        "source_path": str(source_path),
        "target_path": str(PACADEV_ROOT / f"v{version}" / "clients" / client),
        "db_name": db_name,
        "host_port": port,
        "secrets_file": f"core/secrets/{client}.enc.yaml",
    }
    config_file = client_dir / "config.json"
    if dry_run:
        log(f"  [DRY] {config_file}")
        return
    config_file.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"  ✅ .pacadev/clients/{client}/config.json créé")


def migrate_client(client: str, version: str, source: Path, copy_filestore_flag: bool, dry_run: bool) -> dict:
    """Migration complète d'un client. Retourne un récap."""
    if not source.exists():
        raise FileNotFoundError(f"Source introuvable : {source}")

    target = PACADEV_ROOT / f"v{version}" / "clients" / client
    log(f"\n━━━ Migration {client} (v{version}) ━━━")
    log(f"  Source : {source}")
    log(f"  Target : {target}")

    target.mkdir(parents=True, exist_ok=True)

    port = DEFAULT_PORTS.get(client, 8000 + hash(client) % 100)
    db_name = DEFAULT_DB_NAMES.get(client, f"{client}_prod")

    # 1. Compose
    write_compose(target, client, version, port, db_name, dry_run)
    # 2. odoo.conf
    write_odoo_conf(target, client, version, dry_run)
    # 3. addons/oca
    oca_source = find_oca_addons_source(client, version, source)
    copy_addons_oca(oca_source, target, dry_run)
    # 4. filestore
    fs_size = 0
    if copy_filestore_flag:
        fs_source = source / "filestore"
        fs_size = copy_filestore(fs_source, target, dry_run)
    # 5. State
    update_versions_json(client, version, source, dry_run)
    write_client_config(client, version, source, port, db_name, dry_run)

    return {
        "client": client,
        "version": version,
        "port": port,
        "db_name": db_name,
        "filestore_bytes": fs_size,
        "target": str(target),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--client", required=True, help="Slug du client (specta, mecafric, ...)")
    ap.add_argument("--version", required=True, choices=["14", "17", "19"], help="Version Odoo")
    ap.add_argument("--source", required=True, type=Path, help="Chemin source dans OpenEnsdev")
    ap.add_argument("--skip-filestore", action="store_true",
                    help="Ne pas copier le filestore (utile pour tests).")
    ap.add_argument("--dry-run", action="store_true", help="Affiche le plan sans écrire")
    args = ap.parse_args()

    summary = migrate_client(
        args.client, args.version, args.source,
        copy_filestore_flag=not args.skip_filestore,
        dry_run=args.dry_run,
    )
    log(f"\n=== Récap migration ===")
    log(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
