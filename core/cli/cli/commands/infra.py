"""Commande `pacadev infra` — orchestration de l'infrastructure partagée.

Sous-commandes :
    start                  — démarre pacadev-network + postgres + traefik
    stop                   — arrête postgres + traefik (données préservées)
    status                 — état des services partagés
    verify                 — diagnostic UFW + Docker (sudo requis)
    start-all-clients      — démarre tous les clients déclarés dans v14/v17/v19
    recreate               — recrée tous les conteneurs (--force-recreate)
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Orchestration infrastructure partagée (PG + Traefik + scripts)")
console = Console()

# Racine du repo pacadev (resolution stable depuis ce fichier)
_THIS = Path(__file__).resolve()
PACADEV_ROOT = _THIS.parents[4]  # commands → cli → cli → core → pacadev
INFRA_ROOT = PACADEV_ROOT / "core" / "infra"
SCRIPTS_DIR = INFRA_ROOT / "scripts"


def _ensure_network(name: str = "pacadev-network") -> bool:
    """Crée le network Docker s'il n'existe pas."""
    r = subprocess.run(
        ["docker", "network", "inspect", name],
        capture_output=True, text=True
    )
    if r.returncode == 0:
        return False
    subprocess.run(["docker", "network", "create", name], check=True)
    return True


def _compose_path(service: str) -> Path:
    return INFRA_ROOT / service / "docker-compose.yml"


def _run_compose(service: str, action: str, *extra: str) -> int:
    compose = _compose_path(service)
    if not compose.exists():
        console.print(f"[red]❌ Compose introuvable : {compose}[/red]")
        return 1
    return subprocess.run(
        ["docker", "compose", "-f", str(compose), action, *extra]
    ).returncode


def _container_status(name: str) -> str:
    r = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Status}}", name],
        capture_output=True, text=True
    )
    return r.stdout.strip() if r.returncode == 0 else "absent"


@app.command()
def start():
    """Démarre l'infra partagée (network + postgres + traefik)."""
    console.print("[blue]🚀 Démarrage infra pacadev...[/blue]")
    created = _ensure_network()
    if created:
        console.print("[green]  ✅ Network pacadev-network créé[/green]")
    else:
        console.print("[dim]  → Network pacadev-network OK[/dim]")

    if _run_compose("postgres", "up", "-d") != 0:
        console.print("[red]❌ Échec démarrage PostgreSQL[/red]")
        raise typer.Exit(1)
    console.print("[green]  ✅ pacadev_postgres_shared démarré[/green]")

    if _run_compose("traefik", "up", "-d") != 0:
        console.print("[red]❌ Échec démarrage Traefik[/red]")
        raise typer.Exit(1)
    console.print("[green]  ✅ pacadev_traefik démarré[/green]")

    console.print("\n[bold]Accès :[/bold]")
    console.print("  🗄  PostgreSQL : localhost:5434  (user=odoo)")
    console.print("  🔀 Traefik web : http://localhost:8090")
    console.print("  📊 Traefik dash: http://localhost:8091")


@app.command()
def stop():
    """Arrête l'infra partagée (données préservées)."""
    console.print("[blue]⏸  Arrêt infra pacadev...[/blue]")
    _run_compose("traefik", "down")
    _run_compose("postgres", "down")
    console.print("[green]✅ Infra arrêtée. Données préservées dans ./data[/green]")


@app.command()
def status():
    """État des services partagés."""
    table = Table(title="État infra pacadev")
    table.add_column("Service", style="bold")
    table.add_column("Container", style="cyan")
    table.add_column("Status")
    table.add_column("Ports")

    targets = {
        "PostgreSQL": "pacadev_postgres_shared",
        "Traefik": "pacadev_traefik",
    }

    for label, container in targets.items():
        st = _container_status(container)
        color = {
            "running": "[green]running[/green]",
            "exited": "[red]exited[/red]",
            "absent": "[dim]absent[/dim]",
        }.get(st, f"[yellow]{st}[/yellow]")
        ports = subprocess.run(
            ["docker", "port", container],
            capture_output=True, text=True
        ).stdout.strip() if st == "running" else "—"
        table.add_row(label, container, color, ports or "—")

    console.print(table)

    # Network
    net = subprocess.run(
        ["docker", "network", "inspect", "pacadev-network"],
        capture_output=True
    ).returncode == 0
    console.print(
        f"\nNetwork pacadev-network : "
        + ("[green]présent[/green]" if net else "[red]absent[/red]")
    )


@app.command()
def verify():
    """Diagnostic UFW + Docker (peut nécessiter sudo)."""
    script = SCRIPTS_DIR / "verify-ufw-docker.sh"
    if not script.exists():
        console.print(f"[red]❌ Script introuvable : {script}[/red]")
        raise typer.Exit(1)
    subprocess.run(["bash", str(script)])


@app.command("start-all-clients")
def start_all_clients():
    """Démarre tous les clients déclarés dans v14/v17/v19."""
    script = SCRIPTS_DIR / "start-all-clients.sh"
    if not script.exists():
        console.print(f"[red]❌ Script introuvable : {script}[/red]")
        raise typer.Exit(1)
    subprocess.run(["bash", str(script)])


@app.command()
def recreate():
    """Recrée tous les conteneurs (infra + clients) avec --force-recreate."""
    if not typer.confirm("Recréer TOUS les conteneurs (infra + clients) ?", default=False):
        console.print("[yellow]Annulé.[/yellow]")
        raise typer.Exit(0)
    script = SCRIPTS_DIR / "recreate-containers.sh"
    subprocess.run(["bash", str(script)])


@app.command()
def logs(
    service: str = typer.Argument(..., help="postgres | traefik"),
    tail: int = typer.Option(50, "--tail", "-n"),
):
    """Affiche les logs d'un service infra."""
    container_map = {
        "postgres": "pacadev_postgres_shared",
        "traefik": "pacadev_traefik",
    }
    container = container_map.get(service)
    if not container:
        console.print(f"[red]Service inconnu : {service}. Utilise : {list(container_map)}[/red]")
        raise typer.Exit(1)
    subprocess.run(["docker", "logs", "--tail", str(tail), "-f", container])
