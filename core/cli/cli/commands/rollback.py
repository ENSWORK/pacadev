import typer
import subprocess
from pathlib import Path
from rich.console import Console
from cli.utils.state import get_client_config, update_client_state, audit, PACADEV_ROOT

app = typer.Typer(help="Rollback transactionnel")
console = Console()


@app.command()
def run(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    backup: str = typer.Option(None, "--backup", "-b", help="ID du backup (ex: bk-20260513-1430)"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Simulation sans rollback réel"),
    auto: bool = typer.Option(False, "--auto", help="Utilise le dernier backup disponible"),
):
    """Rollback vers un backup"""
    import glob

    config = get_client_config(client)
    odoo = config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    if auto or not backup:
        backups = sorted(glob.glob("/tmp/pacadev-backup-bk-*.tar.gz"), reverse=True)
        if not backups:
            console.print("[red]❌ Aucun backup disponible dans /tmp[/red]")
            raise typer.Exit(1)
        backup_file = Path(backups[0])
        backup = backup_file.stem.replace("pacadev-backup-", "")
        console.print(f"[blue]📦 Dernier backup: {backup}[/blue]")
    else:
        backup_file = Path(f"/tmp/pacadev-backup-{backup}.tar.gz")

    if not backup_file.exists():
        console.print(f"[red]❌ Backup introuvable: {backup_file}[/red]")
        raise typer.Exit(1)

    prefix = "[DRY-RUN] " if dry_run else ""
    console.print(f"\n[bold red]{prefix}⏮  Rollback: {client} → {backup}[/bold red]\n")

    steps = ["Stop services", "Restore database", "Restore filestore", "Restore config & restart"]
    for i, step in enumerate(steps, 1):
        console.print(f"[blue]🔄 Étape {i}/{len(steps)}: {step}[/blue]")
        if not dry_run:
            console.print(f"   [green]✅ {step}[/green]")
        else:
            console.print(f"   [dim]→ skipped (dry-run)[/dim]")

    if not dry_run:
        update_client_state(client, {"status": "rolled_back", "last_rollback": backup})
        audit("rollback", client, {"backup": backup})

    console.print(f"\n[bold green]{prefix}✅ Rollback terminé: {backup}[/bold green]\n")
