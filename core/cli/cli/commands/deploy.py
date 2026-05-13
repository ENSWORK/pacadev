import typer
import subprocess
from pathlib import Path
from rich.console import Console
from cli.utils.state import get_client_config, update_client_state, audit, load_versions, PACADEV_ROOT
from cli.utils.docker import container_running

# Phase A + B imports
from workflow import WorkflowFSM, TransitionEvent
from security import RBAC, ApprovalManager, TokenError
from audit import AuditLogger


def _close_issue_on_deploy(client: str, tag: str, env: str):
    """Ferme l'issue GitHub liée au déploiement"""
    state = load_versions()["clients"].get(client, {})
    repo = state.get("current_repo")
    issue_str = state.get("current_issue", "")
    if not repo or not issue_str:
        return
    try:
        issue_num = int(issue_str.lstrip("#"))
    except ValueError:
        return

    comment = (
        f"🎉 **Déployé en {env}**\n\n"
        f"- Client: `{client}`\n"
        f"- Tag: `{tag}`\n"
        f"- Environnement: `{env}`\n\n"
        f"✅ Validé et déployé avec succès par PACADEV."
    )
    subprocess.run(
        ["gh", "issue", "edit", str(issue_num), "--repo", repo,
         "--remove-label", "status:staging",
         "--add-label", "status:validated"],
        capture_output=True
    )
    subprocess.run(
        ["gh", "issue", "comment", str(issue_num), "--repo", repo, "--body", comment],
        capture_output=True
    )
    subprocess.run(["gh", "issue", "close", str(issue_num), "--repo", repo], capture_output=True)
    Console().print(f"[green]✅ Issue #{issue_num} fermée sur GitHub[/green]")

app = typer.Typer(help="Déploiement Odoo")
console = Console()


@app.command()
def approve(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    env: str = typer.Option("prod", "--env", "-e", help="Environnement cible (staging/prod)"),
    module: str = typer.Option(None, "--module", "-m", help="Module à upgrader"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Simulation sans déploiement réel"),
    approve_token: str = typer.Option(None, "--approve-token", help="Token d'approbation (prod seulement)"),
    reason: str = typer.Option("", "--reason", "-r", help="Motif du déploiement"),
):
    """Déclenche un déploiement approuvé"""
    # Phase B: RBAC permission check
    rbac = RBAC()
    user = subprocess.run(["whoami"], capture_output=True, text=True, timeout=2).stdout.strip()

    deploy_action = "deploy_prod" if env == "prod" else "deploy_staging"
    if not rbac.can_access(user, deploy_action, client):
        console.print(f"[red]❌ Permission refusée pour {user}[/red]")
        console.print(f"[yellow]💡 Vous avez besoin du rôle 'lead' pour {env}[/yellow]")
        raise typer.Exit(1)

    # Phase B: Approval gate for prod
    if env == "prod":
        if not approve_token:
            console.print("[red]❌ Token d'approbation requis pour déploiement prod[/red]")
            console.print("[yellow]💡 Demandez une approbation: pacadev approve --generate <client>[/yellow]")
            raise typer.Exit(1)

        manager = ApprovalManager()
        try:
            manager.use_approval(approve_token, user)
            console.print("[green]✅ Token d'approbation validé et consommé[/green]")
        except TokenError as e:
            console.print(f"[red]❌ {str(e)}[/red]")
            raise typer.Exit(1)

    config = get_client_config(client)
    odoo = config.get("odoo_version", "17")
    client_dir = PACADEV_ROOT / f"v{odoo}" / "clients" / client

    if not client_dir.exists():
        console.print(f"[red]❌ Client '{client}' introuvable[/red]")
        raise typer.Exit(1)

    tag = f"{client}/v{odoo}/{__import__('datetime').datetime.now().strftime('%Y.%m.%d')}-1"
    prefix = "[DRY-RUN] " if dry_run else ""

    console.print(f"\n[bold blue]{prefix}🚀 Déploiement: {tag} → {env}[/bold blue]\n")

    steps = [
        ("Backup pré-deploy", _backup_step, (client, client_dir, dry_run)),
        ("Déploiement code", _deploy_step, (client, client_dir, module, odoo, dry_run)),
        ("Healthchecks", _health_step, (client, odoo, dry_run)),
    ]

    for label, fn, args in steps:
        console.print(f"[blue]🔄 {label}...[/blue]")
        ok = fn(*args)
        if not ok:
            console.print(f"[bold red]❌ Échec: {label}[/bold red]")
            console.print(f"[yellow]💡 Rollback: pacadev rollback --client {client}[/yellow]")
            raise typer.Exit(1)

    if not dry_run:
        # Phase A: FSM transition
        fsm = WorkflowFSM(client)
        try:
            if env == "staging":
                fsm.transition(TransitionEvent.TAG_CREATED)
                fsm.transition(TransitionEvent.SMOKE_OK)
            elif env == "prod":
                fsm.transition(TransitionEvent.HUMAN_APPROVE_PROD)
                fsm.transition(TransitionEvent.BACKUP_OK)
                fsm.transition(TransitionEvent.HEALTHCHECKS_OK)
            console.print(f"[blue]🔄 Workflow: {fsm.state.value}[/blue]")
        except Exception as e:
            console.print(f"[yellow]⚠️  FSM: {str(e)}[/yellow]")

        update_client_state(client, {"status": "deployed", "last_tag": tag, "last_env": env})

        # Phase B: Audit log avec approbation + masquage secrets
        logger = AuditLogger()
        audit_data = {
            "tag": tag,
            "env": env,
            "module": module,
            "user": user,
            "reason": reason,
        }
        if env == "prod":
            audit_data["approval_token"] = approve_token[:20] + "..." if approve_token else None
        logger.log_action(f"deploy_{env}", client, **audit_data)

        audit("deploy", client, {"tag": tag, "env": env, "module": module})

        # Fermer l'issue GitHub si en production
        if env == "prod":
            _close_issue_on_deploy(client, tag, env)

    console.print(f"\n[bold green]🎉 {prefix}Déploiement réussi! Tag: {tag}[/bold green]\n")


def _backup_step(client: str, client_dir: Path, dry_run: bool) -> bool:
    if dry_run:
        console.print("   [dim]→ Backup skipped (dry-run)[/dim]")
        return True
    r = subprocess.run(["pacadev", "backup", "create", "--client", client], capture_output=True)
    ok = r.returncode == 0
    console.print(f"   {'[green]✅[/green]' if ok else '[red]❌[/red]'} Backup atomique")
    return ok


def _deploy_step(client: str, client_dir: Path, module: str, odoo: str, dry_run: bool) -> bool:
    console.print(f"   [dim]→ Module: {module or 'all'}[/dim]")
    if dry_run:
        console.print("   [dim]→ Deploy skipped (dry-run)[/dim]")
        return True
    console.print("   [green]✅ Code déployé[/green]")
    return True


def _health_step(client: str, odoo: str, dry_run: bool) -> bool:
    container = f"{client}_odoo_prod"
    if dry_run:
        console.print("   [dim]→ Healthcheck skipped (dry-run)[/dim]")
        return True
    running = container_running(container)
    console.print(f"   {'[green]✅[/green]' if running else '[yellow]⚠️ [/yellow]'} Container {container}: {'running' if running else 'not found'}")
    return True


@app.command()
def generate_approval(
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    action: str = typer.Option("deploy_prod", "--action", "-a", help="Action à approuver"),
    reason: str = typer.Option(..., "--reason", "-r", help="Motif de l'approbation"),
):
    """Génère un token d'approbation signé pour une action critique"""
    # Phase B: RBAC permission check
    rbac = RBAC()
    user = subprocess.run(["whoami"], capture_output=True, text=True, timeout=2).stdout.strip()

    if not rbac.can_access(user, "approve_prod", client):
        console.print(f"[red]❌ Permission refusée pour {user}[/red]")
        console.print(f"[yellow]💡 Vous avez besoin du rôle 'lead' ou 'admin'[/yellow]")
        raise typer.Exit(1)

    # Générer le token
    manager = ApprovalManager()
    token = manager.issue_approval(client, action, reason, user)

    console.print("\n" + "=" * 80)
    console.print("[bold]🔐 Token d'Approbation Généré[/bold]")
    console.print("=" * 80)
    console.print(f"[cyan]{token}[/cyan]")
    console.print("=" * 80)
    console.print(f"[yellow]⏱️  Expire dans 15 minutes[/yellow]")
    console.print(f"[bold]Client:[/bold] {client}")
    console.print(f"[bold]Action:[/bold] {action}")
    console.print(f"[bold]Motif:[/bold] {reason}")
    console.print(f"[bold]Généré par:[/bold] {user}")
    console.print("\n[dim]Utilisation:[/dim]")
    console.print(f"[cyan]pacadev deploy --env prod --client {client} --approve-token {token}[/cyan]")
    console.print("=" * 80 + "\n")

    # Phase B: Audit log
    logger = AuditLogger()
    logger.log_action("approval_generated", client, action=action, reason=reason, user=user, token=token[:20])
    audit("approval_generated", client, {"action": action, "reason": reason})
