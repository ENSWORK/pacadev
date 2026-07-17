import typer
import subprocess
from pathlib import Path
from rich.console import Console
from rich.markdown import Markdown

app = typer.Typer(help="Accès rapide aux procédures d'urgence")
console = Console()

RUNBOOK = Path("/home/pacadev/pacadev/docs/RUNBOOK.md")
ARCH = Path("/home/pacadev/pacadev/docs/ARCHITECTURE.md")

SECTIONS = {
    "p0-down":      "P0 — Odoo Production Down",
    "p0-db":        "P0 — Corruption Base de Données",
    "p1-500":       "P1 — Erreurs 500 en Masse",
    "p1-deploy":    "P1 — Déploiement Échoué",
    "p2-perf":      "P2 — Performance Dégradée",
    "maintenance":  "Opérations de Maintenance",
    "monitoring":   "Monitoring — Requêtes Utiles",
    "checklist":    "Checklist Post-Incident",
}


@app.command()
def show(
    section: str = typer.Argument(None, help=f"Section: {', '.join(SECTIONS.keys())}"),
):
    """Affiche le RUNBOOK ou une section spécifique"""
    if not RUNBOOK.exists():
        console.print(f"[red]❌ RUNBOOK introuvable: {RUNBOOK}[/red]")
        raise typer.Exit(1)

    content = RUNBOOK.read_text()

    if section:
        if section not in SECTIONS:
            console.print(f"[red]Section inconnue: '{section}'[/red]")
            console.print(f"Sections disponibles: {', '.join(SECTIONS.keys())}")
            raise typer.Exit(1)
        title = SECTIONS[section]
        lines = content.split("\n")
        start = next((i for i, l in enumerate(lines) if title in l), None)
        if start is None:
            console.print(f"[yellow]Section '{title}' non trouvée[/yellow]")
            raise typer.Exit(1)
        end = next((i for i, l in enumerate(lines[start+1:], start+1) if l.startswith("## ")), len(lines))
        content = "\n".join(lines[start:end])

    console.print(Markdown(content))


@app.command()
def emergency(client: str = typer.Argument(..., help="Slug du client en urgence")):
    """Diagnostic express d'urgence pour un client"""
    from cli.utils.docker import container_running
    from cli.utils.state import get_client_config, load_versions, PACADEV_ROOT

    console.print(f"\n[bold red]🚨 DIAGNOSTIC URGENCE — {client}[/bold red]\n")

    config = get_client_config(client)
    odoo_ver = config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo_ver}" / "clients" / client

    checks = [
        (f"{client}_odoo_prod", "Odoo container"),
        (f"{client}_db_prod", "DB container"),
    ]

    all_ok = True
    for container, label in checks:
        ok = container_running(container)
        status = "[green]✅ UP[/green]" if ok else "[red]❌ DOWN[/red]"
        console.print(f"  {status}  {label} ({container})")
        if not ok:
            all_ok = False

    import urllib.request
    try:
        urllib.request.urlopen("http://localhost:8069/web/health", timeout=3)
        console.print("  [green]✅ UP[/green]  HTTP /web/health")
    except Exception:
        console.print("  [red]❌ DOWN[/red]  HTTP /web/health")
        all_ok = False

    import glob
    backups = sorted(glob.glob("/tmp/pacadev-backup-bk-*.tar.gz"), reverse=True)
    if backups:
        from pathlib import Path as P
        latest = P(backups[0])
        console.print(f"\n  [cyan]📦 Dernier backup:[/cyan] {latest.name}")
    else:
        console.print("\n  [yellow]⚠️  Aucun backup local disponible[/yellow]")

    console.print()
    if not all_ok:
        console.print("[bold red]Actions recommandées:[/bold red]")
        console.print("  1. [bold]pacadev rollback --client " + client + " --auto[/bold]")
        console.print("  2. [bold]pacadev runbook show p0-down[/bold]")
        console.print("  3. [bold]docker logs --tail 50 " + client + "_odoo_prod[/bold]")
    else:
        console.print("[bold green]✅ Tous les checks OK[/bold green]")

    console.print()


@app.command()
def sections():
    """Liste toutes les sections du RUNBOOK"""
    console.print("\n[bold]Sections disponibles:[/bold]\n")
    for key, title in SECTIONS.items():
        console.print(f"  [cyan]{key:<16}[/cyan] {title}")
    console.print()
    console.print("[dim]Usage: pacadev runbook show <section>[/dim]\n")
