"""Commande `pacadev memory` — contexte IA via Mem0 + ChromaDB + LiteLLM/OpenRouter."""
from __future__ import annotations

import sys
import subprocess
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Contexte IA (Mem0 + ChromaDB + LiteLLM/OpenRouter)")
console = Console()

_CORE_DIR = str(Path(__file__).resolve().parents[3])
if _CORE_DIR not in sys.path:
    sys.path.insert(0, _CORE_DIR)

_SCRIPTS_DIR = Path(__file__).resolve().parents[3] / "memory"

_RULE_USERS = ["odoo17_official", "odoo14_official", "odoo19_official",
               "ens_best_practices", "ens_security"]
_CLIENT_SLUGS = ["afrequip", "specta", "mecafric", "mecafric_water", "sofetelec"]


def _get_memory():
    try:
        from memory.mem0_local import get_memory
        return get_memory()
    except Exception as e:
        console.print(f"[red]❌ mem0 non disponible : {e}[/red]")
        console.print("[yellow]💡 pip install mem0ai chromadb (dans .venv)[/yellow]")
        return None


@app.command()
def search(
    query: str = typer.Argument(..., help="Requête de recherche"),
    client: str = typer.Option(None, "--client", "-c", help="Filtrer par client"),
    rules: bool = typer.Option(False, "--rules", "-r", help="Chercher dans les règles Odoo"),
    limit: int = typer.Option(5, "--limit", "-n", help="Nombre de résultats"),
):
    """Cherche dans la mémoire IA (règles, contexte client, historique)."""
    m = _get_memory()
    if m is None:
        raise typer.Exit(1)

    user_ids: list[str] = []
    if client:
        user_ids += [client, f"history_{client}"]
    if rules:
        user_ids += _RULE_USERS
    if not user_ids:
        user_ids = _CLIENT_SLUGS + [f"history_{c}" for c in _CLIENT_SLUGS] + _RULE_USERS

    console.print(f"[blue]🔍 Recherche : [bold]{query}[/bold][/blue]\n")

    seen: set[str] = set()
    found = False
    for uid in user_ids:
        try:
            results = m.search(query, filters={"user_id": uid}, limit=limit)
        except Exception as e:
            console.print(f"[yellow]⚠️  Erreur recherche (user_id={uid}): {e}[/yellow]")
            continue
        memories = results.get("results", results) if isinstance(results, dict) else results
        for r in (memories or []):
            mem_text = r.get("memory", str(r)) if isinstance(r, dict) else str(r)
            if mem_text in seen:
                continue
            seen.add(mem_text)
            found = True
            score = r.get("score", "") if isinstance(r, dict) else ""
            label = f"[dim](score={score:.3f})[/dim]" if score else ""
            console.print(f"[cyan]•[/cyan] {mem_text} {label}")

    if not found:
        console.print("[yellow]Aucun résultat trouvé.[/yellow]")


@app.command("load-rules")
def load_rules():
    """Charge les règles Odoo + bonnes pratiques ENS dans Mem0."""
    script = _SCRIPTS_DIR / "load_rules.py"
    console.print("[blue]📚 Chargement des règles...[/blue]")
    r = subprocess.run([sys.executable, str(script)])
    if r.returncode == 0:
        console.print("[green]✅ Règles chargées[/green]")
    else:
        raise typer.Exit(r.returncode)


@app.command("load-clients")
def load_clients():
    """Charge les configurations des clients pacadev dans Mem0."""
    script = _SCRIPTS_DIR / "load_clients.py"
    console.print("[blue]👥 Chargement des clients...[/blue]")
    r = subprocess.run([sys.executable, str(script)])
    if r.returncode == 0:
        console.print("[green]✅ Clients chargés[/green]")
    else:
        raise typer.Exit(r.returncode)


@app.command("load-history")
def load_history():
    """Charge l'historique des bugs/corrections dans Mem0."""
    script = _SCRIPTS_DIR / "load_history.py"
    console.print("[blue]🐛 Chargement de l'historique...[/blue]")
    r = subprocess.run([sys.executable, str(script)])
    if r.returncode == 0:
        console.print("[green]✅ Historique chargé[/green]")
    else:
        raise typer.Exit(r.returncode)


@app.command()
def stats():
    """Affiche les statistiques de la base mémoire ChromaDB."""
    m = _get_memory()
    if m is None:
        raise typer.Exit(1)

    from memory.mem0_local import CHROMA_DIR, HISTORY_DB

    table = Table(title="Mem0 pacadev — stats")
    table.add_column("Paramètre", style="bold")
    table.add_column("Valeur", style="cyan")

    table.add_row("Store ChromaDB", str(CHROMA_DIR))
    table.add_row("History DB", str(HISTORY_DB))

    chroma_size = sum(f.stat().st_size for f in CHROMA_DIR.rglob("*") if f.is_file()) if CHROMA_DIR.exists() else 0
    table.add_row("Taille ChromaDB", f"{chroma_size / 1024:.1f} KB")

    hist_size = HISTORY_DB.stat().st_size if HISTORY_DB.exists() else 0
    table.add_row("Taille history.db", f"{hist_size / 1024:.1f} KB")

    try:
        import chromadb
        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        collections = client.list_collections()
        for col in collections:
            table.add_row(f"Collection: {col.name}", f"{col.count()} entrées")
    except Exception as e:
        table.add_row("ChromaDB collections", f"[yellow]{e}[/yellow]")

    console.print(table)


@app.command()
def init():
    """Initialise Mem0 (charge règles + clients + historique en une commande)."""
    console.print("[blue]🚀 Initialisation mémoire pacadev...[/blue]")
    for cmd_fn, label in [(load_rules, "règles"), (load_clients, "clients"), (load_history, "historique")]:
        try:
            cmd_fn()
        except SystemExit:
            console.print(f"[red]❌ Échec chargement {label}[/red]")
            raise typer.Exit(1)
    console.print("\n[bold green]✅ Mémoire initialisée[/bold green]")
    console.print("[dim]Utilisation: pacadev memory search 'odoo v17 computed fields'[/dim]")
