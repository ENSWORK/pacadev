"""
Décorateurs CLI pour appliquer les validations et contrôles workflow.
"""

from functools import wraps
from typing import Optional, Callable
import typer
from rich.console import Console
from workflow import WorkflowFSM, PreFlightChecker, ValidationResult
from workflow.validators import (
    validate_work_start, validate_deploy_staging, validate_deploy_prod
)
from audit import AuditLogger

console = Console()


def require_github_issue(func: Callable) -> Callable:
    """Décorateur: exige --issue valide via GitHub API"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        issue = kwargs.get('issue')
        repo = kwargs.get('repo')

        if not issue:
            console.print("[red]❌ --issue requis pour cette commande[/red]")
            raise typer.Exit(1)

        if not repo:
            console.print("[red]❌ --repo requis pour validation GitHub[/red]")
            raise typer.Exit(1)

        check = PreFlightChecker.check_github_issue(repo, issue)
        if not check.passed:
            console.print(f"[red]❌ {check.message}[/red]")
            raise typer.Exit(1)

        console.print(f"[green]✅ {check.message}[/green]")
        return func(*args, **kwargs)
    return wrapper


def require_valid_branch_name(func: Callable) -> Callable:
    """Décorateur: exige format de branche valide"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        branch = kwargs.get('branch')

        if not branch:
            console.print("[red]❌ --branch requis[/red]")
            raise typer.Exit(1)

        check = PreFlightChecker.check_branch_name(branch)
        if not check.passed:
            console.print(f"[red]❌ {check.message}[/red]")
            raise typer.Exit(1)

        return func(*args, **kwargs)
    return wrapper


def require_git_repo(func: Callable) -> Callable:
    """Décorateur: exige d'être dans un dépôt Git"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        from pathlib import Path
        path = Path.cwd()

        check = PreFlightChecker.check_git_repo(path)
        if not check.passed:
            console.print(f"[red]❌ {check.message}[/red]")
            raise typer.Exit(1)

        return func(*args, **kwargs)
    return wrapper


def require_backup(func: Callable) -> Callable:
    """Décorateur: exige un backup récent pour actions prod"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        client = kwargs.get('client')

        if not client:
            console.print("[red]❌ --client requis[/red]")
            raise typer.Exit(1)

        check = PreFlightChecker.check_backup_exists(client)
        if not check.passed:
            console.print(f"[red]❌ {check.message}[/red]")
            raise typer.Exit(1)

        console.print(f"[green]✅ {check.message}[/green]")
        return func(*args, **kwargs)
    return wrapper


def validate_and_log(action: str) -> Callable:
    """Décorateur: valide pré-conditions et enregistre dans audit log"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            client = kwargs.get('client')
            logger = AuditLogger()

            try:
                result = func(*args, **kwargs)
                # Log succès
                logger.log_action(action, client, status="success")
                return result
            except Exception as e:
                # Log erreur
                logger.log_action(action, client, status="error", error=str(e))
                raise
        return wrapper
    return decorator


def fsm_transition(event) -> Callable:
    """Décorateur: gère la transition FSM avant/après l'action"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            client = kwargs.get('client')

            if not client:
                console.print("[red]❌ --client requis[/red]")
                raise typer.Exit(1)

            fsm = WorkflowFSM(client)

            # Vérifier que la transition est autorisée
            if not fsm.can_transition(event):
                allowed = fsm.get_allowed_transitions()
                allowed_str = ", ".join([evt.value for evt, _ in allowed])
                console.print(
                    f"[red]❌ Transition invalide depuis {fsm.state.value}[/red]\n"
                    f"[yellow]💡 Transitions autorisées: {allowed_str}[/yellow]"
                )
                raise typer.Exit(1)

            # Exécuter la fonction
            try:
                result = func(*args, **kwargs)
                # Effectuer la transition
                new_state = fsm.transition(event, metadata={"action": func.__name__})
                console.print(f"[blue]🔄 État: {fsm.state.value}[/blue]")
                return result
            except Exception as e:
                console.print(f"[red]❌ Erreur: {str(e)}[/red]")
                raise
        return wrapper
    return decorator


def require_permission(permission: str) -> Callable:
    """Décorateur: exige une permission RBAC"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            from security import RBAC
            import subprocess

            client = kwargs.get('client')
            if not client:
                console.print("[red]❌ --client requis[/red]")
                raise typer.Exit(1)

            # Récupérer l'utilisateur courant
            try:
                user = subprocess.run(["whoami"], capture_output=True, text=True, timeout=2).stdout.strip()
            except:
                user = "unknown"

            # Vérifier la permission
            rbac = RBAC()
            if not rbac.can_access(user, permission, client):
                console.print(
                    f"[red]❌ Permission refusée pour {user}[/red]\n"
                    f"[yellow]Required: {permission} on {client}[/yellow]"
                )
                raise typer.Exit(1)

            console.print(f"[green]✅ Permission OK: {permission}[/green]")
            return func(*args, **kwargs)
        return wrapper
    return decorator


def require_approval(action: str) -> Callable:
    """Décorateur: exige une approbation signée pour actions critiques"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            from security import ApprovalManager, TokenError

            client = kwargs.get('client')
            token = kwargs.get('approve_token')

            if not client:
                console.print("[red]❌ --client requis[/red]")
                raise typer.Exit(1)

            if not token:
                console.print(
                    f"[red]❌ Token d'approbation requis pour {action}[/red]\n"
                    f"[yellow]💡 Utilisez: --approve-token <token>[/yellow]"
                )
                raise typer.Exit(1)

            # Vérifier et utiliser l'approbation
            manager = ApprovalManager()
            try:
                import subprocess
                user = subprocess.run(["whoami"], capture_output=True, text=True, timeout=2).stdout.strip()
                manager.use_approval(token, user)
                console.print(f"[green]✅ Approbation validée[/green]")
            except TokenError as e:
                console.print(f"[red]❌ {str(e)}[/red]")
                raise typer.Exit(1)

            return func(*args, **kwargs)
        return wrapper
    return decorator


def mask_secrets_in_log(func: Callable) -> Callable:
    """Décorateur: masque les secrets avant logging"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        from security import SecretsMasker
        from audit import AuditLogger

        try:
            result = func(*args, **kwargs)
            # Les secrets sont masqués automatiquement dans audit log
            return result
        except Exception as e:
            # Masquer les secrets dans les erreurs aussi
            masker = SecretsMasker()
            error_msg = masker.mask_text(str(e))
            console.print(f"[red]❌ Erreur: {error_msg}[/red]")
            raise
    return wrapper
