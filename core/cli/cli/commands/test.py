import typer
import subprocess
from rich.console import Console
from cli.utils.state import get_client_config, PACADEV_ROOT

app = typer.Typer(help="Lancement des tests Odoo")
console = Console()


@app.command()
def run(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    module: str = typer.Option(..., "--module", "-m", help="Module à tester"),
    tag: str = typer.Option(None, "--tag", "-t", help="Tag de test spécifique"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Logs verbeux"),
):
    """Lance les tests unitaires Odoo"""
    config = get_client_config(client)
    odoo = config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    if not client_dir.exists():
        console.print(f"[red]❌ Client '{client}' introuvable[/red]")
        raise typer.Exit(1)

    test_tags = f"/{module}"
    if tag:
        test_tags += f":{tag}"

    compose_file = client_dir / "docker-compose.yml"
    if not compose_file.exists():
        console.print(f"[red]❌ docker-compose.yml introuvable dans {client_dir}[/red]")
        raise typer.Exit(1)

    console.print(f"[blue]🧪 Tests: {module} ({test_tags})[/blue]")

    cmd = [
        "docker", "compose", "-f", str(compose_file),
        "run", "--rm", "odoo",
        "odoo-bin",
        "--test-enable",
        f"--test-tags={test_tags}",
        "-d", f"{client}_db",
        "--stop-after-init",
    ]
    if verbose:
        cmd += ["--log-level=debug"]

    result = subprocess.run(cmd, cwd=client_dir)

    if result.returncode == 0:
        console.print("[bold green]✅ Tests passés[/bold green]")
    else:
        console.print("[bold red]❌ Tests échoués[/bold red]")
        raise typer.Exit(result.returncode)
