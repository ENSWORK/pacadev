import typer
from rich.console import Console
from rich.table import Table

from cli.utils.modules import (
    check_lock,
    resolve_client_modules,
    save_lock,
)
from cli.utils.state import PACADEV_ROOT, list_clients, load_versions

app = typer.Typer(help="Gestion des modules partagés et lock files (versions épinglées)")
console = Console()


def _client_odoo(client: str) -> str:
    versions = load_versions()
    return versions["clients"].get(client, {}).get("odoo_version", "17")


def _targets(client: str) -> list:
    return list_clients() if client == "all" else [client]


@app.command()
def lock(
    client: str = typer.Argument(..., help="Slug du client, ou 'all'"),
):
    """Génère/met à jour le lock file à partir des versions réellement chargées"""
    for c in _targets(client):
        odoo = _client_odoo(c)
        resolved = resolve_client_modules(PACADEV_ROOT, c, odoo)
        path = save_lock(PACADEV_ROOT, c, odoo, resolved)
        console.print(
            f"[green]✅ {c}: lock écrit ({len(resolved)} modules) → "
            f"{path.relative_to(PACADEV_ROOT)}[/green]"
        )
        for name in sorted(resolved):
            info = resolved[name]
            if info["source"] != "ens_core_shared":
                console.print(
                    f"   [yellow]⚠️  {name} v{info['version']} "
                    f"(source: {info['source']} ≠ shared) — fork local à arbitrer[/yellow]"
                )


@app.command()
def check(
    client: str = typer.Argument(..., help="Slug du client, ou 'all'"),
):
    """Vérifie la cohérence lock file ↔ code effectivement monté"""
    ok = True
    for c in _targets(client):
        odoo = _client_odoo(c)
        report = check_lock(PACADEV_ROOT, c, odoo)
        table = Table(title=f"Lock check — {c}")
        table.add_column("Module")
        table.add_column("Locked")
        table.add_column("Actuel")
        table.add_column("Source")
        table.add_column("État")
        for name in sorted(report):
            row = report[name]
            state = "[green]✅[/green]" if row["ok"] else "[red]❌[/red]"
            table.add_row(
                name,
                str(row["locked"]),
                str(row["actual"]),
                row["source"],
                state,
            )
        console.print(table)
        if report and all(r["ok"] for r in report.values()):
            console.print(f"[green]✅ {c}: lock cohérent ({len(report)} modules)[/green]")
        elif not report:
            console.print(f"[yellow]⚠️  {c}: pas de lock file — lancez 'pacadev modules lock {c}'[/yellow]")
            ok = False
        else:
            ok = False
            console.print(f"[red]❌ {c}: divergences lock ↔ code monté[/red]")
            console.print("[yellow]💡 'pacadev modules lock <client>' pour réépingler, "
                          "ou arbitrer les forks (modules/README.md)[/yellow]")
    if not ok:
        raise typer.Exit(1)
