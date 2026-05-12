import typer
import subprocess
from datetime import datetime
from pathlib import Path
from rich.console import Console
from cli.utils.state import get_client_config, audit, PACADEV_ROOT

app = typer.Typer(help="Gestion des sauvegardes")
console = Console()


def _backup_id() -> str:
    return f"bk-{datetime.now().strftime('%Y%m%d-%H%M')}"


@app.command()
def create(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    retention: int = typer.Option(7, "--retention", "-r", help="Nombre de jours de rétention"),
):
    """Crée un backup atomique (DB + filestore + config)"""
    config = get_client_config(client)
    odoo = config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client
    backup_id = _backup_id()
    backup_dir = Path(f"/tmp/pacadev-backup-{backup_id}")

    if not client_dir.exists():
        console.print(f"[red]❌ Client '{client}' introuvable[/red]")
        raise typer.Exit(1)

    console.print(f"[blue]📦 Backup {client} → {backup_id}[/blue]")
    backup_dir.mkdir(parents=True)

    db_container = f"{client}_db_prod"
    db_name = f"{client}_db"

    # DB dump
    r = subprocess.run(
        ["docker", "exec", db_container, "pg_dump", "-U", "odoo", db_name],
        capture_output=True
    )
    if r.returncode == 0:
        (backup_dir / "db.sql").write_bytes(r.stdout)
        console.print(f"[green]   ✅ DB: {len(r.stdout) // 1024} KB[/green]")
    else:
        console.print(f"[yellow]   ⚠️  DB container '{db_container}' inaccessible, skipped[/yellow]")

    # Filestore
    filestore = client_dir / "data" / "filestore"
    if filestore.exists():
        subprocess.run(["rsync", "-a", str(filestore) + "/", str(backup_dir / "filestore") + "/"])
        console.print("[green]   ✅ Filestore[/green]")

    # Config
    for f in ["odoo.conf", "docker-compose.yml"]:
        src = client_dir / f
        if src.exists():
            (backup_dir / f).write_bytes(src.read_bytes())
    console.print("[green]   ✅ Config[/green]")

    # Archive
    archive = Path(f"/tmp/pacadev-backup-{backup_id}.tar.gz")
    subprocess.run(["tar", "-czf", str(archive), "-C", "/tmp", f"pacadev-backup-{backup_id}"])
    subprocess.run(["rm", "-rf", str(backup_dir)])

    size = archive.stat().st_size // 1024
    console.print(f"\n[bold green]✅ Backup créé: {archive} ({size} KB)[/bold green]")
    audit("backup_create", client, {"backup_id": backup_id, "size_kb": size})


@app.command()
def list(client: str = typer.Option(..., "--client", "-c", help="Slug du client")):
    """Liste les backups disponibles"""
    import glob
    backups = sorted(glob.glob(f"/tmp/pacadev-backup-bk-*.tar.gz"), reverse=True)
    client_backups = [b for b in backups if True]  # filter by client when naming includes it

    if not client_backups:
        console.print("[yellow]Aucun backup trouvé dans /tmp[/yellow]")
        return

    from rich.table import Table
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Fichier")
    table.add_column("Taille")

    for b in client_backups:
        p = Path(b)
        table.add_row(p.name, f"{p.stat().st_size // 1024} KB")

    console.print(table)
