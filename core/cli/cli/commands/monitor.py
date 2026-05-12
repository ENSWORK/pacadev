import typer
import subprocess
from pathlib import Path
from rich.console import Console

app = typer.Typer(help="Gestion du monitoring (Prometheus + Grafana + Loki)")
console = Console()

MONITORING_DIR = Path.home() / ".pacadev" / "monitoring"


def _compose(args: list, env: dict = None) -> int:
    import os
    e = os.environ.copy()
    if env:
        e.update(env)
    r = subprocess.run(["docker", "compose", "-f", str(MONITORING_DIR / "docker-compose.yml")] + args, env=e)
    return r.returncode


@app.command()
def start(
    password: str = typer.Option("admin", "--password", "-p", help="Mot de passe Grafana admin"),
):
    """Démarre la stack monitoring"""
    console.print("[blue]📊 Démarrage monitoring PACADEV...[/blue]")
    rc = _compose(["up", "-d"], env={"GRAFANA_ADMIN_PASSWORD": password})
    if rc != 0:
        console.print("[red]❌ Échec démarrage monitoring[/red]")
        raise typer.Exit(1)
    console.print("[green]✅ Monitoring démarré![/green]")
    console.print("\n[bold]Accès:[/bold]")
    console.print("  📈 Grafana:    http://localhost:3000  (admin / " + password + ")")
    console.print("  🔬 Prometheus: http://localhost:9090")
    console.print("  📋 Loki:       http://localhost:3100")


@app.command()
def stop():
    """Arrête la stack monitoring"""
    console.print("[blue]⏸  Arrêt monitoring...[/blue]")
    _compose(["down"])
    console.print("[green]✅ Monitoring arrêté[/green]")


@app.command()
def status():
    """Vérifie l'état des services monitoring"""
    services = {
        "pacadev_prometheus": ("Prometheus", "http://localhost:9090/-/ready"),
        "pacadev_grafana":    ("Grafana",    "http://localhost:3000/api/health"),
        "pacadev_loki":       ("Loki",       "http://localhost:3100/ready"),
    }
    import urllib.request

    console.print("\n[bold]📊 État Monitoring PACADEV[/bold]\n")
    for container, (name, url) in services.items():
        running = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", container],
            capture_output=True, text=True
        ).stdout.strip() == "true"

        if running:
            try:
                urllib.request.urlopen(url, timeout=2)
                console.print(f"  [green]✅ {name}[/green]  {url}")
            except Exception:
                console.print(f"  [yellow]⚠️  {name}[/yellow]  (container up, endpoint pas encore prêt)")
        else:
            console.print(f"  [red]❌ {name}[/red]  (arrêté)")

    console.print()


@app.command()
def logs(
    service: str = typer.Argument("grafana", help="Service: prometheus / grafana / loki / promtail"),
    tail: int = typer.Option(50, "--tail", "-n"),
):
    """Affiche les logs d'un service monitoring"""
    _compose(["logs", "--tail", str(tail), f"pacadev_{service}"])
