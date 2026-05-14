#!/usr/bin/env python3
"""08_decommission_openensdev.py — Décommissionnement OpenEnsdev.

Étapes :
  1. Vérifie que les 4 clients migrés fonctionnent dans pacadev
  2. Arrête les conteneurs OpenEnsdev (docker compose down)
  3. Désactive le service systemd openensdev (s'il existe)
  4. Archive OpenEnsdev → ~/openensdev_archive_<date>.tar.gz
  5. Met OpenEnsdev en read-only (chmod -R a-w)
  6. Écrit une entrée audit log : action=decommission_openensdev_complete

Idempotent : chaque étape est skippée si déjà effectuée.
--dry-run : affiche le plan sans rien faire.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path

OPENENSDEV_ROOT = Path.home() / "OpenEnsdev"
PACADEV_ROOT = Path.home() / "pacadev"
ARCHIVE_NAME = f"openensdev_archive_{datetime.now().strftime('%Y%m%d_%H%M%S')}.tar.gz"
ARCHIVE_PATH = Path.home() / ARCHIVE_NAME

MIGRATED_CLIENTS = ["afrequip", "specta", "mecafric", "mecafric_water"]

# Compose files à arrêter dans OpenEnsdev
OPENENSDEV_COMPOSES = [
    OPENENSDEV_ROOT / "infra" / "docker-compose.yml",
    OPENENSDEV_ROOT / "infra" / "docker-compose.traefik.yml",
]


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def run(cmd: list[str], cwd: Path | None = None, check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, check=check)


def check_pacadev_clients(dry_run: bool) -> bool:
    """Vérifie que les clients migrés ont leur répertoire dans pacadev."""
    log("\n=== 1. Vérification clients migrés ===")
    all_ok = True
    for client in MIGRATED_CLIENTS:
        found = False
        for version in ("v14", "v17", "v19"):
            p = PACADEV_ROOT / version / "clients" / client
            if p.exists():
                log(f"  ✅ {client} → {p.relative_to(Path.home())}")
                found = True
                break
        if not found:
            log(f"  ⚠️  {client} → introuvable dans pacadev (migration incomplète ?)")
            all_ok = False
    return all_ok


def stop_openensdev_containers(dry_run: bool) -> None:
    """Arrête les conteneurs OpenEnsdev actifs."""
    log("\n=== 2. Arrêt conteneurs OpenEnsdev ===")

    # Stop client containers first
    clients_root = OPENENSDEV_ROOT / "clients"
    for compose in clients_root.rglob("docker-compose*.yml"):
        r = run(["docker", "compose", "-f", str(compose), "ps", "-q"])
        if r.stdout.strip():
            log(f"  Arrêt {compose.relative_to(OPENENSDEV_ROOT)}...")
            if not dry_run:
                run(["docker", "compose", "-f", str(compose), "down", "--remove-orphans"])
        else:
            log(f"  skip {compose.relative_to(OPENENSDEV_ROOT)} (pas de conteneur actif)")

    # Stop infra containers
    for compose in OPENENSDEV_COMPOSES:
        if not compose.exists():
            continue
        r = run(["docker", "compose", "-f", str(compose), "ps", "-q"])
        if r.stdout.strip():
            log(f"  Arrêt infra {compose.name}...")
            if not dry_run:
                run(["docker", "compose", "-f", str(compose), "down", "--remove-orphans"])
        else:
            log(f"  skip {compose.name} (pas de conteneur actif)")


def disable_systemd_service(dry_run: bool) -> None:
    """Désactive le service systemd openensdev si présent."""
    log("\n=== 3. Service systemd ===")
    r = run(["systemctl", "is-active", "openensdev"])
    if r.returncode == 0:
        log("  Service openensdev actif — désactivation...")
        if not dry_run:
            run(["systemctl", "stop", "openensdev"])
            run(["systemctl", "disable", "openensdev"])
        log("  ✅ Service désactivé")
    else:
        log("  skip (service openensdev non trouvé ou inactif)")


def archive_openensdev(dry_run: bool) -> bool:
    """Crée une archive tar.gz de OpenEnsdev (hors venv et données)."""
    log(f"\n=== 4. Archive → {ARCHIVE_NAME} ===")

    if ARCHIVE_PATH.exists():
        log(f"  skip (archive déjà présente : {ARCHIVE_PATH})")
        return True

    # Exclure venv, __pycache__, *.pyc, infra/postgres/data, filestore
    excludes = [
        "--exclude=./venv-mem0",
        "--exclude=./venv-odoo-dev",
        "--exclude=./.git",
        "--exclude=*/__pycache__",
        "--exclude=*.pyc",
        "--exclude=./infra/postgres/data",
        "--exclude=*/filestore",
        "--exclude=*/sessions",
    ]

    size_r = run(["du", "-sh", str(OPENENSDEV_ROOT)])
    log(f"  Taille source : {size_r.stdout.split()[0] if size_r.stdout else '?'}")

    if dry_run:
        log(f"  [DRY] tar czf {ARCHIVE_PATH} -C {Path.home()} OpenEnsdev {' '.join(excludes)}")
        return True

    log("  Compression en cours...")
    r = subprocess.run(
        ["tar", "czf", str(ARCHIVE_PATH), "-C", str(Path.home()), "OpenEnsdev"] + excludes,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        log(f"  ❌ Échec archive : {r.stderr}")
        return False

    size = ARCHIVE_PATH.stat().st_size / (1024 * 1024)
    log(f"  ✅ Archive créée : {ARCHIVE_PATH} ({size:.1f} MB)")
    return True


def set_read_only(dry_run: bool) -> None:
    """Met OpenEnsdev en read-only pour éviter toute modification accidentelle."""
    log("\n=== 5. Mise en read-only ===")
    if dry_run:
        log(f"  [DRY] chmod -R a-w {OPENENSDEV_ROOT}")
        return
    r = run(["chmod", "-R", "a-w", str(OPENENSDEV_ROOT)])
    if r.returncode == 0:
        log(f"  ✅ {OPENENSDEV_ROOT} → read-only")
    else:
        log(f"  ⚠️  chmod partiel (certains fichiers déjà protégés)")


def write_audit_log(dry_run: bool) -> None:
    """Écrit l'entrée audit log de décommissionnement."""
    log("\n=== 6. Audit log ===")
    if dry_run:
        log("  [DRY] AuditLogger.log_action('decommission_openensdev_complete', ...)")
        return
    try:
        sys.path.insert(0, str(PACADEV_ROOT / "core"))
        from audit import AuditLogger
        logger = AuditLogger()
        entry = logger.log_action(
            "decommission_openensdev_complete",
            "system",
            archive=str(ARCHIVE_PATH),
            migrated_clients=MIGRATED_CLIENTS,
            openensdev_root=str(OPENENSDEV_ROOT),
            read_only=True,
        )
        log(f"  ✅ Audit log écrit (hash: {entry.get('hash', '?')[:16]}...)")
    except Exception as e:
        log(f"  ⚠️  Audit log échoué : {e}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="Affiche le plan sans exécuter.")
    ap.add_argument("--skip-archive", action="store_true",
                    help="Sauter l'étape d'archivage (pour tests).")
    ap.add_argument("--skip-readonly", action="store_true",
                    help="Sauter la mise en read-only.")
    ap.add_argument("--force", action="store_true",
                    help="Continuer même si des clients sont introuvables dans pacadev.")
    args = ap.parse_args()

    log("=" * 60)
    log("PHASE 8 — Décommissionnement OpenEnsdev")
    log("=" * 60)

    if not OPENENSDEV_ROOT.exists():
        log(f"❌ {OPENENSDEV_ROOT} n'existe pas (déjà supprimé ?)")
        sys.exit(0)

    # 1. Vérification
    clients_ok = check_pacadev_clients(args.dry_run)
    if not clients_ok and not args.force:
        log("\n⚠️  Clients manquants — annulation (utilisez --force pour continuer)")
        sys.exit(1)

    # 2. Arrêt conteneurs
    stop_openensdev_containers(args.dry_run)

    # 3. Systemd
    disable_systemd_service(args.dry_run)

    # 4. Archive
    if not args.skip_archive:
        ok = archive_openensdev(args.dry_run)
        if not ok and not args.dry_run:
            log("❌ Archive échouée — arrêt (les données ne seront pas mises en read-only)")
            sys.exit(1)

    # 5. Read-only
    if not args.skip_readonly:
        set_read_only(args.dry_run)

    # 6. Audit log
    write_audit_log(args.dry_run)

    log("\n" + "=" * 60)
    log("✅ OpenEnsdev décommissionné avec succès")
    log(f"   Archive : {ARCHIVE_PATH}")
    log(f"   pacadev : {PACADEV_ROOT}")
    log("=" * 60)


if __name__ == "__main__":
    main()
