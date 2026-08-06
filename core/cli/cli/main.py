#!/usr/bin/env python3
from pathlib import Path

import typer
from rich.console import Console

from cli.utils.state import PACADEV_ROOT

_ENV_FILE = Path(PACADEV_ROOT) / ".env"
if _ENV_FILE.exists():
    from dotenv import load_dotenv
    load_dotenv(_ENV_FILE)

from cli.commands import work, deploy, backup, rollback, test, secrets, generate, monitor, runbook, issue, infra, memory, ai, modules  # noqa: E402
from cli.utils.state import init_client, list_clients, load_versions  # noqa: E402

app = typer.Typer(
    name="pacadev",
    help=" PACADEV v1.0 — Orchestrateur de Développement Odoo",
    add_completion=True,
    no_args_is_help=True,
)

app.add_typer(work.app, name="work")
app.add_typer(deploy.app, name="deploy")
app.add_typer(backup.app, name="backup")
app.add_typer(rollback.app, name="rollback")
app.add_typer(test.app, name="test")
app.add_typer(secrets.app, name="secrets")
app.add_typer(generate.app, name="generate")
app.add_typer(monitor.app, name="monitor")
app.add_typer(runbook.app, name="runbook")
app.add_typer(issue.app, name="issue")
app.add_typer(infra.app, name="infra")
app.add_typer(memory.app, name="memory")
app.add_typer(ai.app, name="ai")
app.add_typer(modules.app, name="modules")

console = Console()


@app.command()
def version():
    """Affiche la version de PACADEV"""
    console.print("[bold blue]PACADEV[/bold blue] v1.0.0")
    console.print("Orchestrateur Odoo multi-versions piloté par IA")
    console.print(f"Workspace: {PACADEV_ROOT}")


@app.command()
def init(
    client: str = typer.Argument(..., help="Slug du client (ex: acmecorp)"),
    odoo: str = typer.Option("17", "--odoo", "-o", help="Version Odoo (14/17/19)"),
    template: str = typer.Option("standard", "--template", "-t", help="Template"),
):
    """Initialise un nouveau client"""
    console.print(f"[blue]🔹 Initialisation client [bold]{client}[/bold] (Odoo {odoo})[/blue]")
    init_client(client, odoo, template)
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client
    console.print(f"[green]✅ Client créé: {client_dir}[/green]")
    console.print(f"[dim]Prochain: pacadev work start --client {client} --issue <N>[/dim]")


@app.command(name="list")
def list_cmd():
    """Liste tous les clients enregistrés"""
    clients = list_clients()
    if not clients:
        console.print("[yellow]Aucun client. Créez-en un: pacadev init <client>[/yellow]")
        return
    for c in clients:
        console.print(f"  [cyan]•[/cyan] {c}")


@app.command()
def health(
    client: str = typer.Option(None, "--client", "-c", help="Client spécifique"),
    all: bool = typer.Option(False, "--all", help="Vérifie tous les clients"),
):
    """Vérifie la santé des services (conteneur {client}_odoo + Postgres partagé + HTTP)"""
    from cli.utils.docker import container_running
    targets = list_clients() if all else ([client] if client else [])

    if not targets:
        console.print("[yellow]Spécifiez --client ou --all[/yellow]")
        return

    # Postgres partagé (vérifié une seule fois)
    pg_ok = container_running("pacadev_postgres_shared")
    pg = "[green]✅[/green]" if pg_ok else "[red]❌[/red]"

    versions = load_versions()
    for c in targets:
        info = versions["clients"].get(c, {})
        odoo_ver = info.get("odoo_version", "17")
        odoo_ok = container_running(f"{c}_odoo")
        o = "[green]✅[/green]" if odoo_ok else "[red]❌[/red]"
        console.print(f"[bold]{c}[/bold] (Odoo {odoo_ver})  Odoo:{o}  Postgres partagé:{pg}")


@app.callback()
def main():
    """PACADEV CLI"""
    pass


if __name__ == "__main__":
    app()
