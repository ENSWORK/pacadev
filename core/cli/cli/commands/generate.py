import typer
import shutil
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from rich.console import Console
from cli.utils.state import get_client_config, PACADEV_ROOT

app = typer.Typer(help="Génération des fichiers projet (devcontainer, CI, config)")
console = Console()

TEMPLATES_DIR = Path("/home/pacadev/pacadev/core/templates/devcontainer")
CI_TEMPLATES_DIR = Path("/home/pacadev/pacadev/core/ci-templates")

ODOO_PORTS = {"14": "8069", "17": "8069", "19": "8070"}


def _render(template_name: str, context: dict, base_dir: Path) -> str:
    env = Environment(loader=FileSystemLoader(str(base_dir)))
    return env.get_template(template_name).render(**context)


@app.command()
def devcontainer(
    client: str = typer.Argument(..., help="Slug du client"),
    odoo: str = typer.Option(None, "--odoo", "-o", help="Version Odoo (14/17/19)"),
    port: str = typer.Option(None, "--port", "-p", help="Port Odoo local"),
    force: bool = typer.Option(False, "--force", "-f", help="Écraser si existant"),
):
    """Génère les fichiers devcontainer + config pour un client"""
    config = get_client_config(client)
    odoo_ver = odoo or config.get("odoo_version", "17")
    odoo_port = port or ODOO_PORTS.get(odoo_ver, "8069")
    client_dir = PACADEV_ROOT / f"v{odoo_ver}" / "clients" / client

    if not client_dir.exists():
        console.print(f"[red]❌ Client '{client}' introuvable. Créez-le: pacadev init {client}[/red]")
        raise typer.Exit(1)

    context = {"client_slug": client, "odoo_version": odoo_ver, "odoo_port": odoo_port}

    files = {
        "docker-compose.dev.yml": client_dir / "docker-compose.dev.yml",
        "odoo.conf":              client_dir / "config" / "odoo.conf",
        "devcontainer.json":      client_dir / ".devcontainer" / "devcontainer.json",
        "continue.json":          client_dir / ".vscode" / "continue.json",
        ".aiignore":              client_dir / ".aiignore",
    }

    console.print(f"\n[bold blue]⚙️  Génération devcontainer — {client} (Odoo {odoo_ver})[/bold blue]\n")

    for tpl, dest in files.items():
        if dest.exists() and not force:
            console.print(f"[dim]   ↩  {dest.relative_to(client_dir)} (existe, --force pour écraser)[/dim]")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        if tpl == ".aiignore":
            shutil.copy(TEMPLATES_DIR / ".aiignore", dest)
        else:
            dest.write_text(_render(tpl, context, TEMPLATES_DIR))
        console.print(f"[green]   ✅ {dest.relative_to(client_dir)}[/green]")

    env_example = client_dir / ".env.example"
    if not env_example.exists() or force:
        env_example.write_text(
            "DB_PASSWORD=dev_password\n"
            "ADMIN_PASSWORD=123456\n"
            "ANTHROPIC_API_KEY=sk-ant-api03-CHANGE_ME\n"
        )
        console.print("[green]   ✅ .env.example[/green]")

    console.print(f"\n[bold green]✅ Devcontainer prêt pour '{client}'![/bold green]")
    console.print(f"[dim]   cd {client_dir} && cp .env.example .env && code .[/dim]\n")


@app.command()
def ci(
    client: str = typer.Argument(..., help="Slug du client"),
    odoo: str = typer.Option(None, "--odoo", "-o", help="Version Odoo"),
    repo_path: str = typer.Option(None, "--repo", "-r", help="Chemin du repo client (défaut: répertoire client)"),
    force: bool = typer.Option(False, "--force", "-f", help="Écraser si existant"),
):
    """Génère les workflows GitHub Actions pour un client"""
    config = get_client_config(client)
    odoo_ver = odoo or config.get("odoo_version", "17")
    client_dir = Path(repo_path) if repo_path else PACADEV_ROOT / f"v{odoo_ver}" / "clients" / client

    if not client_dir.exists():
        console.print(f"[red]❌ Répertoire introuvable: {client_dir}[/red]")
        raise typer.Exit(1)

    workflows_dir = client_dir / ".github" / "workflows"
    workflows_dir.mkdir(parents=True, exist_ok=True)

    console.print(f"\n[bold blue]⚙️  Génération CI/CD — {client} (Odoo {odoo_ver})[/bold blue]\n")

    files = {
        "pipeline-base.yml": "pipeline.yml",
        "deploy.yml": "deploy.yml",
    }

    for src_name, dest_name in files.items():
        src = CI_TEMPLATES_DIR / src_name
        dest = workflows_dir / dest_name
        if dest.exists() and not force:
            console.print(f"[dim]   ↩  .github/workflows/{dest_name} (existe, --force pour écraser)[/dim]")
            continue
        shutil.copy(src, dest)
        console.print(f"[green]   ✅ .github/workflows/{dest_name}[/green]")

    # Générer .github/variables.json pour référence
    vars_file = client_dir / ".github" / "variables.example.json"
    if not vars_file.exists() or force:
        import json
        vars_file.write_text(json.dumps({
            "CLIENT_SLUG": client,
            "ODOO_VERSION": odoo_ver,
            "DEPLOY_HOST": f"user@{client}-prod.example.com",
            "ODOO_HOST": f"{client}-prod.example.com",
        }, indent=2))
        console.print("[green]   ✅ .github/variables.example.json[/green]")

    # Générer .pylintrc si absent
    pylintrc = client_dir / ".pylintrc"
    if not pylintrc.exists() or force:
        pylintrc.write_text(
            "[MASTER]\nload-plugins=pylint_odoo\n\n"
            "[FORMAT]\nmax-line-length=120\n\n"
            "[MESSAGES CONTROL]\ndisable=C0114,C0115,C0116,R0903\n"
        )
        console.print("[green]   ✅ .pylintrc[/green]")

    console.print(f"\n[bold green]✅ CI/CD généré pour '{client}'![/bold green]")
    console.print("\n[bold]Secrets GitHub à configurer:[/bold]")
    console.print("  ANTHROPIC_API_KEY — clé Anthropic pour le risk scorer")
    console.print("  DEPLOY_SSH_KEY    — clé SSH pour déploiement")
    console.print("  GITHUB_TOKEN      — auto-fourni par GitHub Actions\n")
    console.print("[dim]  → Settings → Secrets and variables → Actions[/dim]\n")
