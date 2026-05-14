import sys
import typer
import subprocess
import json
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from cli.utils.state import get_client_config, update_client_state, list_clients, audit, load_versions, PACADEV_ROOT
from cli.utils.git import create_branch, current_branch, is_git_repo

# core/ sits 3 levels above this file: commands/ → cli/ → cli/ → core/
_CORE_DIR = str(Path(__file__).resolve().parents[3])
if _CORE_DIR not in sys.path:
    sys.path.insert(0, _CORE_DIR)

from workflow import WorkflowFSM, TransitionEvent  # noqa: E402
from security import RBAC  # noqa: E402
from audit import AuditLogger  # noqa: E402


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


def _preload_memory_context(client: str, module: str | None) -> None:
    """Pre-load Mem0 context for the client/module (non-blocking, silent on failure)."""
    try:
        from memory.mem0_local import get_memory
        m = get_memory()
        if m is None:
            return
        console_mem = Console(stderr=True)
        console_mem.print("[dim]🧠 Contexte mémoire :[/dim]")
        for uid in [client, f"history_{client}"]:
            results = m.search(module or client, user_id=uid, limit=3)
            memories = results.get("results", results) if isinstance(results, dict) else results
            for r in (memories or []):
                text = r.get("memory", str(r)) if isinstance(r, dict) else str(r)
                console_mem.print(f"[dim]  • {text[:120]}[/dim]")
    except Exception:
        pass


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
    # Phase B: RBAC permission check
    rbac = RBAC()
    user = subprocess.run(["whoami"], capture_output=True, text=True, timeout=2).stdout.strip()
    if not rbac.can_access(user, "work_start", client):
        console.print(f"[red]❌ Permission refusée pour {user}[/red]")
        console.print(f"[yellow]💡 Contact votre admin pour le rôle 'dev' ou 'lead'[/yellow]")
        raise typer.Exit(1)

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
            subprocess.run(["git", "checkout", branch], cwd=client_dir)
        console.print("[green]✅ Branche Git prête[/green]")
    else:
        console.print("[yellow]⚠️  Pas de dépôt Git — initialisez avec: git init[/yellow]")

    # Phase A: FSM transition
    fsm = WorkflowFSM(client)
    try:
        fsm.transition(TransitionEvent.WORK_START_VALID, metadata={"issue": issue, "module": module, "branch": branch})
        console.print(f"[blue]🔄 Workflow: {fsm.state.value}[/blue]")
    except Exception as e:
        console.print(f"[yellow]⚠️  FSM: {str(e)}[/yellow]")

    update_client_state(client, {
        "current_branch": branch,
        "current_issue": f"#{issue}",
        "current_repo": repo,
        "status": "dev",
        "odoo_version": odoo,
    })

    # Phase B: Audit log avec masquage secrets
    logger = AuditLogger()
    logger.log_action("work_start", client, issue=issue, branch=branch, module=module, user=user)
    audit("work_start", client, {"issue": issue, "branch": branch, "module": module})

    # Mettre l'issue en status:in-progress sur GitHub
    if repo:
        _set_issue_in_progress(repo, issue)
        console.print("[green]✅ Issue GitHub → status:in-progress[/green]")

    # Context pre-loading from Mem0 (non-blocking)
    _preload_memory_context(client, module)

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


@app.command()
def review(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    odoo: str = typer.Option("17", "--odoo", "-o", help="Version Odoo"),
    passed: bool = typer.Option(None, "--passed/--failed", help="Résultat de la review"),
):
    """Lance (ou clôture) la phase de self-review avant push."""
    config = get_client_config(client)
    odoo = odoo or config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    fsm = WorkflowFSM(client)

    if passed is None:
        # Démarrer la review
        try:
            fsm.transition(TransitionEvent.SELF_REVIEW_STARTED)
            console.print(f"[blue]🔍 Self-review démarrée — client: [bold]{client}[/bold][/blue]")
            console.print(f"  État FSM: [cyan]{fsm.state.value}[/cyan]")
            console.print("\nChecklist:")
            console.print("  □ Vérifier diff (git diff --cached)")
            console.print("  □ Pas de print/debug oublié")
            console.print("  □ Version __manifest__.py incrémentée")
            console.print("  □ Pas de secret en clair")
            console.print("\n[dim]Terminer: pacadev work review --passed (ou --failed)[/dim]")
        except Exception as e:
            console.print(f"[yellow]⚠️  FSM: {e}[/yellow]")
        audit("work_review_start", client)
    elif passed:
        try:
            fsm.transition(TransitionEvent.SELF_REVIEW_PASSED)
            console.print(f"[green]✅ Self-review validée — passage à TEST_MANUAL[/green]")
            console.print(f"  État FSM: [cyan]{fsm.state.value}[/cyan]")
            console.print("[dim]Suite: pacadev work test-manual --client " + client + "[/dim]")
        except Exception as e:
            console.print(f"[yellow]⚠️  FSM: {e}[/yellow]")
        audit("work_review_passed", client)
    else:
        try:
            fsm.transition(TransitionEvent.SELF_REVIEW_FAILED)
            console.print(f"[red]❌ Self-review échouée — retour en DEV[/red]")
            console.print(f"  État FSM: [cyan]{fsm.state.value}[/cyan]")
        except Exception as e:
            console.print(f"[yellow]⚠️  FSM: {e}[/yellow]")
        audit("work_review_failed", client)


@app.command("test-manual")
def test_manual(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    odoo: str = typer.Option("17", "--odoo", "-o", help="Version Odoo"),
    passed: bool = typer.Option(None, "--passed/--failed", help="Résultat du test"),
):
    """Lance (ou clôture) la phase de test manuel avant push."""
    config = get_client_config(client)
    odoo = odoo or config.get("odoo_version", "17")

    fsm = WorkflowFSM(client)

    if passed is None:
        console.print(f"[blue]🧪 Test manuel — client: [bold]{client}[/bold][/blue]")
        console.print(f"  État FSM actuel: [cyan]{fsm.state.value}[/cyan]")
        console.print("\nProcédure:")
        console.print("  1. Démarrer le conteneur Odoo (pacadev work start si nécessaire)")
        console.print("  2. Tester le golden path du module modifié")
        console.print("  3. Vérifier la régression des features existantes")
        console.print("  4. Consulter les logs Docker (pacadev infra logs postgres)")
        console.print("\n[dim]Terminer: pacadev work test-manual --passed (ou --failed)[/dim]")
    elif passed:
        try:
            fsm.transition(TransitionEvent.TEST_MANUAL_PASSED)
            console.print(f"[green]✅ Tests manuels OK — retour en DEV (prêt pour push)[/green]")
            console.print(f"  État FSM: [cyan]{fsm.state.value}[/cyan]")
            console.print("[dim]Suite: pacadev work commit --client " + client + " --module <m> --type fix --desc 'description'[/dim]")
        except Exception as e:
            console.print(f"[yellow]⚠️  FSM: {e}[/yellow]")
        audit("work_test_manual_passed", client)
    else:
        try:
            fsm.transition(TransitionEvent.TEST_MANUAL_FAILED)
            console.print(f"[red]❌ Tests manuels échoués — retour en DEV[/red]")
            console.print(f"  État FSM: [cyan]{fsm.state.value}[/cyan]")
        except Exception as e:
            console.print(f"[yellow]⚠️  FSM: {e}[/yellow]")
        audit("work_test_manual_failed", client)


@app.command()
def commit(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    module: str = typer.Option(..., "--module", "-m", help="Nom du module"),
    type_: str = typer.Option(..., "--type", "-t", help="Type: add|fix|ref|rem"),
    desc: str = typer.Option(..., "--desc", "-d", help="Description courte"),
    issue: int = typer.Option(None, "--issue", "-i", help="Numéro du ticket GitHub"),
    odoo: str = typer.Option("17", "--odoo", "-o", help="Version Odoo"),
    push: bool = typer.Option(False, "--push", help="Push après commit"),
):
    """Crée un commit formaté [module] type: desc\\n\\nRefs: #issue."""
    config = get_client_config(client)
    odoo = odoo or config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    if not client_dir.exists():
        console.print(f"[red]❌ Client '{client}' introuvable[/red]")
        raise typer.Exit(1)

    type_map = {"add": "ADD", "fix": "FIX", "ref": "REF", "rem": "REM"}
    commit_type = type_map.get(type_.lower(), type_.upper())
    subject = f"[{module}] {commit_type}: {desc}"

    msg_parts = [subject]
    if issue:
        msg_parts.append(f"\nRefs: #{issue}")
    commit_msg = "\n".join(msg_parts)

    console.print(f"[blue]📝 Commit: [bold]{subject}[/bold][/blue]")

    r = subprocess.run(
        ["git", "commit", "-m", commit_msg],
        cwd=client_dir,
    )
    if r.returncode != 0:
        console.print("[red]❌ Échec du commit (rien à commiter ou erreur git)[/red]")
        raise typer.Exit(1)

    console.print("[green]✅ Commit créé[/green]")
    audit("work_commit", client, {"module": module, "type": type_, "desc": desc, "issue": issue})

    if push:
        branch_r = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=client_dir, capture_output=True, text=True
        )
        branch = branch_r.stdout.strip()
        p = subprocess.run(["git", "push", "--set-upstream", "origin", branch], cwd=client_dir)
        if p.returncode == 0:
            console.print(f"[green]✅ Pushé sur origin/{branch}[/green]")
            fsm = WorkflowFSM(client)
            try:
                fsm.transition(TransitionEvent.PUSH_DETECTED, metadata={"branch": branch})
                console.print(f"  État FSM: [cyan]{fsm.state.value}[/cyan]")
            except Exception:
                pass
        else:
            console.print("[yellow]⚠️  Push échoué (vérifier remote)[/yellow]")


@app.command()
def done(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    issue: int = typer.Option(..., "--issue", "-i", help="Numéro du ticket GitHub"),
    odoo: str = typer.Option("17", "--odoo", "-o", help="Version Odoo"),
    comment: str = typer.Option(None, "--comment", help="Commentaire de clôture"),
):
    """Marque le ticket comme terminé et ferme l'issue GitHub."""
    config = get_client_config(client)
    odoo = odoo or config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    repo = _get_repo(client_dir) if client_dir.exists() else None

    if repo:
        close_args = ["gh", "issue", "close", str(issue), "--repo", repo]
        if comment:
            close_args += ["--comment", comment]
        r = subprocess.run(close_args, capture_output=True, text=True)
        if r.returncode == 0:
            console.print(f"[green]✅ Issue #{issue} fermée sur {repo}[/green]")
        else:
            console.print(f"[yellow]⚠️  Impossible de fermer l'issue: {r.stderr.strip()}[/yellow]")

        subprocess.run(
            ["gh", "issue", "edit", str(issue), "--repo", repo,
             "--remove-label", "status:in-progress",
             "--add-label", "status:done"],
            capture_output=True
        )
    else:
        console.print("[yellow]⚠️  Repo GitHub non détecté — issue non fermée[/yellow]")

    update_client_state(client, {"status": "done", "current_issue": None})
    logger = AuditLogger()
    user = subprocess.run(["whoami"], capture_output=True, text=True).stdout.strip()
    logger.log_action("work_done", client, issue=issue, user=user)
    audit("work_done", client, {"issue": issue})
    console.print(f"[bold green]✅ Ticket #{issue} — travail terminé pour {client}[/bold green]")
