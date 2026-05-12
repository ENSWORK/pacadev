import typer
import subprocess
import json
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from cli.utils.state import update_client_state, audit

app = typer.Typer(help="Gestion des issues GitHub")
console = Console()


def _gh(args: list) -> tuple[int, str]:
    r = subprocess.run(["gh"] + args, capture_output=True, text=True)
    return r.returncode, r.stdout.strip()


def _get_repo(client: str = None) -> str:
    """Détecte le repo GitHub du contexte courant ou du client"""
    rc, out = _gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
    if rc == 0 and out:
        return out
    return None


def _fetch_issue(repo: str, number: int) -> dict:
    rc, out = _gh([
        "issue", "view", str(number),
        "--repo", repo,
        "--json", "number,title,body,labels,assignees,milestone,state,url"
    ])
    if rc != 0:
        return {}
    return json.loads(out)


@app.command()
def view(
    number: int = typer.Argument(..., help="Numéro de l'issue"),
    repo: str = typer.Option(None, "--repo", "-R", help="owner/repo (défaut: repo courant)"),
):
    """Affiche les détails d'une issue GitHub"""
    repo = repo or _get_repo()
    if not repo:
        console.print("[red]❌ Impossible de détecter le repo. Utilisez --repo owner/repo[/red]")
        raise typer.Exit(1)

    issue = _fetch_issue(repo, number)
    if not issue:
        console.print(f"[red]❌ Issue #{number} introuvable sur {repo}[/red]")
        raise typer.Exit(1)

    labels = ", ".join(l["name"] for l in issue.get("labels", []))
    milestone = issue.get("milestone", {})
    milestone_title = milestone.get("title", "-") if milestone else "-"

    console.print(Panel(
        f"[bold]#{issue['number']} — {issue['title']}[/bold]\n\n"
        f"[cyan]Labels:[/cyan]    {labels or '—'}\n"
        f"[cyan]Milestone:[/cyan] {milestone_title}\n"
        f"[cyan]État:[/cyan]      {issue['state']}\n"
        f"[cyan]URL:[/cyan]       {issue['url']}",
        title=f"[bold blue]Issue #{number}[/bold blue]"
    ))


@app.command()
def update(
    number: int = typer.Argument(..., help="Numéro de l'issue"),
    repo: str = typer.Option(None, "--repo", "-R", help="owner/repo"),
    label: str = typer.Option(None, "--label", "-l", help="Label à ajouter"),
    remove_label: str = typer.Option(None, "--remove-label", help="Label à retirer"),
    comment: str = typer.Option(None, "--comment", "-c", help="Commentaire à ajouter"),
    close: bool = typer.Option(False, "--close", help="Fermer l'issue"),
    milestone: str = typer.Option(None, "--milestone", "-m", help="Milestone à assigner"),
):
    """Met à jour une issue GitHub (labels, commentaire, fermeture)"""
    repo = repo or _get_repo()
    if not repo:
        console.print("[red]❌ Impossible de détecter le repo. Utilisez --repo owner/repo[/red]")
        raise typer.Exit(1)

    console.print(f"[blue]🔹 Mise à jour issue #{number} sur {repo}[/blue]")

    if label:
        rc, _ = _gh(["issue", "edit", str(number), "--repo", repo, "--add-label", label])
        status = "✅" if rc == 0 else "❌"
        console.print(f"  {status} Label ajouté: {label}")

    if remove_label:
        rc, _ = _gh(["issue", "edit", str(number), "--repo", repo, "--remove-label", remove_label])
        status = "✅" if rc == 0 else "❌"
        console.print(f"  {status} Label retiré: {remove_label}")

    if milestone:
        rc, _ = _gh(["issue", "edit", str(number), "--repo", repo, "--milestone", milestone])
        status = "✅" if rc == 0 else "❌"
        console.print(f"  {status} Milestone: {milestone}")

    if comment:
        rc, _ = _gh(["issue", "comment", str(number), "--repo", repo, "--body", comment])
        status = "✅" if rc == 0 else "❌"
        console.print(f"  {status} Commentaire ajouté")

    if close:
        rc, _ = _gh(["issue", "close", str(number), "--repo", repo])
        status = "✅" if rc == 0 else "❌"
        console.print(f"  {status} Issue fermée")

    audit("issue_update", "core", {
        "issue": number, "repo": repo,
        "label": label, "comment": bool(comment), "closed": close
    })


@app.command()
def create(
    repo: str = typer.Option(None, "--repo", "-R", help="owner/repo"),
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    module: str = typer.Option(..., "--module", "-m", help="Nom du module"),
    title: str = typer.Option(..., "--title", "-t", help="Titre de l'issue"),
    milestone: str = typer.Option(None, "--milestone", help="Milestone"),
):
    """Crée une nouvelle issue GitHub avec les labels PACADEV"""
    repo = repo or _get_repo()
    if not repo:
        console.print("[red]❌ Impossible de détecter le repo. Utilisez --repo owner/repo[/red]")
        raise typer.Exit(1)

    full_title = f"[{client.upper()}][{module}] {title}"
    labels = f"type:feature,status:triage,client:{client}"

    args = [
        "issue", "create",
        "--repo", repo,
        "--title", full_title,
        "--label", labels,
        "--template", "feature.md",
    ]
    if milestone:
        args += ["--milestone", milestone]

    rc, out = _gh(args)
    if rc == 0:
        console.print(f"[green]✅ Issue créée: {out}[/green]")
        issue_number = out.split("/")[-1]
        console.print(f"[dim]Démarrer: pacadev work start --client {client} --issue {issue_number} --module {module}[/dim]")
    else:
        console.print("[red]❌ Erreur création issue[/red]")
        raise typer.Exit(1)


@app.command()
def close_deploy(
    number: int = typer.Argument(..., help="Numéro de l'issue"),
    repo: str = typer.Option(None, "--repo", "-R", help="owner/repo"),
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    env: str = typer.Option("prod", "--env", help="Environnement déployé"),
    tag: str = typer.Option(None, "--tag", help="Tag de déploiement"),
):
    """Ferme une issue après déploiement réussi (appelé automatiquement par deploy)"""
    repo = repo or _get_repo()
    if not repo:
        console.print("[yellow]⚠️  Pas de repo détecté — fermeture issue ignorée[/yellow]")
        return

    comment = (
        f"🎉 **Déployé en {env}**\n\n"
        f"- Client: `{client}`\n"
        f"- Tag: `{tag or 'N/A'}`\n"
        f"- Environnement: `{env}`\n\n"
        f"✅ Validé et déployé avec succès."
    )

    _gh(["issue", "edit", str(number), "--repo", repo,
         "--remove-label", "status:staging",
         "--add-label", "status:validated"])
    _gh(["issue", "comment", str(number), "--repo", repo, "--body", comment])
    _gh(["issue", "close", str(number), "--repo", repo])

    console.print(f"[green]✅ Issue #{number} fermée (déploiement {env})[/green]")
    audit("issue_close", client, {"issue": number, "env": env, "tag": tag})
