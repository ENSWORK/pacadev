import typer
import subprocess
import json
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from cli.utils.state import get_client_config, update_client_state, list_clients, audit, load_versions, PACADEV_ROOT
from cli.utils.git import create_branch, current_branch, is_git_repo


def _fetch_issue_info(repo: str, number: int) -> dict:
    """Récupère titre + labels d'une issue GitHub"""
    if not repo:
        return {}
    r = subprocess.run(
        ["gh", "issue", "view", str(number), "--repo", repo,
         "--json", "number,title,labels,milestone,url"],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return {}
    return json.loads(r.stdout)


def _get_repo(client_dir: Path) -> str:
    """Détecte le repo GitHub depuis le dossier client"""
    r = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True, text=True, cwd=client_dir
    )
    return r.stdout.strip() if r.returncode == 0 else None


def _set_issue_in_progress(repo: str, number: int):
    if not repo:
        return
    subprocess.run(
        ["gh", "issue", "edit", str(number), "--repo", repo,
         "--remove-label", "status:triage",
         "--remove-label", "status:ready",
         "--add-label", "status:in-progress"],
        capture_output=True
    )

app = typer.Typer(help="Gestion des environnements de travail")
console = Console()


@app.command()
def start(
    issue: int = typer.Option(..., "--issue", "-i", help="Numéro du ticket GitHub"),
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    module: str = typer.Option(None, "--module", "-m", help="Nom du module"),
    odoo: str = typer.Option("17", "--odoo", "-o", help="Version Odoo"),
):
    """Démarre un environnement de travail pour un ticket"""
    config = get_client_config(client)
    odoo = odoo or config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    # Récupérer infos GitHub
    repo = _get_repo(client_dir) if client_dir.exists() else None
    issue_info = _fetch_issue_info(repo, issue) if repo else {}
    issue_title = issue_info.get("title", "")
    milestone = (issue_info.get("milestone") or {}).get("title", "")

    # Déduire le module depuis le titre si non fourni [CLIENT][MODULE]
    if not module and issue_title:
        import re
        m = re.search(r'\[([^\]]+)\]\[([^\]]+)\]', issue_title)
        if m:
            module = m.group(2).lower().replace(" ", "_")

    branch = f"dev/{client}/{issue}-{module or 'task'}"

    console.print(Panel(
        f"[bold]Client:[/bold]    {client} (Odoo {odoo})\n"
        f"[bold]Issue:[/bold]     #{issue}{' — ' + issue_title if issue_title else ''}\n"
        f"[bold]Branche:[/bold]   {branch}\n"
        f"[bold]Milestone:[/bold] {milestone or '—'}\n"
        f"[bold]Repo:[/bold]      {repo or 'non détecté'}\n"
        f"[bold]Chemin:[/bold]    {client_dir}",
        title="[bold blue] PACADEV — work start[/bold blue]"
    ))

    if not client_dir.exists():
        console.print(f"[red]❌ Client '{client}' introuvable: {client_dir}[/red]")
        console.print(f"[yellow]💡 Créez-le d'abord: pacadev init {client} --odoo {odoo}[/yellow]")
        raise typer.Exit(1)

    if is_git_repo(client_dir):
        if not create_branch(branch, cwd=client_dir):
            console.print(f"[yellow]⚠️  Branche '{branch}' existe déjà, basculement...[/yellow]")
            import subprocess
            subprocess.run(["git", "checkout", branch], cwd=client_dir)
        console.print("[green]✅ Branche Git prête[/green]")
    else:
        console.print("[yellow]⚠️  Pas de dépôt Git — initialisez avec: git init[/yellow]")

    update_client_state(client, {
        "current_branch": branch,
        "current_issue": f"#{issue}",
        "current_repo": repo,
        "status": "dev",
        "odoo_version": odoo,
    })
    audit("work_start", client, {"issue": issue, "branch": branch, "module": module})

    # Mettre l'issue en status:in-progress sur GitHub
    if repo:
        _set_issue_in_progress(repo, issue)
        console.print("[green]✅ Issue GitHub → status:in-progress[/green]")

    console.print("\n[bold green]✅ Environnement prêt![/bold green]")
    console.print(f"[bold]👉 cd {client_dir}[/bold]")
    console.print("[bold]👉 code .[/bold]  puis Dev Containers: Rebuild Container\n")


@app.command()
def stop(client: str = typer.Option(..., "--client", "-c", help="Slug du client")):
    """Arrête l'environnement de travail"""
    from cli.utils.docker import compose_down
    config = get_client_config(client)
    odoo = config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    if not client_dir.exists():
        console.print(f"[red]❌ Client '{client}' introuvable[/red]")
        raise typer.Exit(1)

    console.print(f"[blue]⏸  Arrêt {client}...[/blue]")
    if compose_down(client_dir):
        console.print("[green]✅ Environnement arrêté[/green]")
        update_client_state(client, {"status": "stopped"})
        audit("work_stop", client)
    else:
        console.print("[yellow]⚠️  Aucun container actif ou erreur[/yellow]")


@app.command()
def status():
    """Affiche l'état de tous les clients"""
    versions = load_versions()
    clients = versions.get("clients", {})

    if not clients:
        console.print("[yellow]Aucun client enregistré. Utilisez: pacadev init <client>[/yellow]")
        return

    console.print(Panel(
        f"[bold]PACADEV v{versions.get('pacadev_version', '1.0.0')}[/bold]\n"
        f"Dernière sync: {versions.get('last_sync', 'jamais')}",
        title="[bold blue] État PACADEV[/bold blue]"
    ))

    from rich.table import Table
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Client")
    table.add_column("Odoo")
    table.add_column("Statut")
    table.add_column("Branche")
    table.add_column("Issue")

    for name, info in clients.items():
        status_color = {"dev": "yellow", "initialized": "blue", "stopped": "dim", "deployed": "green"}.get(info.get("status", ""), "white")
        table.add_row(
            name,
            info.get("odoo_version", "?"),
            f"[{status_color}]{info.get('status', '?')}[/{status_color}]",
            info.get("current_branch", "-"),
            info.get("current_issue", "-"),
        )

    console.print(table)
