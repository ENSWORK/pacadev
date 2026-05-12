import typer
from rich.console import Console
from rich.table import Table
from cli.utils.secrets import load_secrets, init_client_secrets, SECRETS_DIR

app = typer.Typer(help="Gestion des secrets chiffrés (SOPS + age)")
console = Console()


@app.command()
def show(client: str = typer.Argument(..., help="Slug du client")):
    """Affiche les clés secrets d'un client (valeurs masquées)"""
    try:
        secrets = load_secrets(client)
    except RuntimeError as e:
        console.print(f"[red]❌ {e}[/red]")
        raise typer.Exit(1)

    if not secrets:
        console.print(f"[yellow]Aucun secret pour '{client}'[/yellow]")
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Clé")
    table.add_column("Valeur")

    for k, v in secrets.items():
        masked = str(v)[:4] + "****" if v and str(v) != "CHANGE_ME" else "[red]⚠ NON CONFIGURÉ[/red]"
        table.add_row(k, masked)

    console.print(table)


@app.command()
def init(client: str = typer.Argument(..., help="Slug du client")):
    """Crée le fichier secrets chiffré pour un nouveau client"""
    dest = SECRETS_DIR / f"{client}.enc.yaml"
    if dest.exists():
        console.print(f"[yellow]⚠️  Secrets déjà initialisés: {dest}[/yellow]")
        return
    try:
        init_client_secrets(client)
        console.print(f"[green]✅ Secrets créés: {dest}[/green]")
        console.print(f"[dim]Éditez avec: sops {dest}[/dim]")
    except Exception as e:
        console.print(f"[red]❌ {e}[/red]")
        raise typer.Exit(1)


@app.command()
def edit(client: str = typer.Argument(..., help="Slug du client")):
    """Ouvre le fichier secrets dans l'éditeur SOPS"""
    import subprocess, os
    dest = SECRETS_DIR / f"{client}.enc.yaml"
    if not dest.exists():
        console.print(f"[red]❌ Pas de secrets pour '{client}'. Utilisez: pacadev secrets init {client}[/red]")
        raise typer.Exit(1)
    env = os.environ.copy()
    env["SOPS_AGE_KEY_FILE"] = str(SECRETS_DIR.parent.parent / ".config" / "sops" / "age" / "keys.txt")
    subprocess.run(["sops", str(dest)], env=env)
