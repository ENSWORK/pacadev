#!/usr/bin/env python3
"""
Script d'initialisation RBAC pour PACADEV.
Configure les rôles et utilisateurs.
"""

import sys
import os
from pathlib import Path

# Ajouter core au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from security import RBAC

class Console:
    def print(self, msg):
        print(msg)

console = Console()

def main():
    """Initialise la configuration RBAC"""
    rbac = RBAC()

    console.print("\n[bold blue]🔐 Initialisation RBAC PACADEV[/bold blue]\n")

    # Utilisateurs par défaut
    default_users = {
        "abdelali": "admin",       # Fondateur
        "alice": "lead",           # Lead technique (approuve prod)
        "bob": "dev",              # Développeur
        "charlie": "dev",          # Développeur
        "viewer": "viewer",        # Lecture seule
    }

    console.print("[cyan]Utilisateurs et rôles à configurer:[/cyan]\n")
    for user, role in default_users.items():
        perms = {
            "admin": "Accès total ✅",
            "lead": "Dev + Staging + Prod + Approvals ✅",
            "dev": "Dev + Staging uniquement ✅",
            "viewer": "Lecture seule ❌",
        }
        console.print(f"  {user:15} → {role:10} [{perms.get(role, '?')}]")

    # Configurer les utilisateurs
    console.print("\n[yellow]Configuration des utilisateurs...[/yellow]")
    for user, role in default_users.items():
        rbac.set_user_role(user, role)
        console.print(f"  ✅ {user:15} = {role}")

    # Afficher la configuration
    console.print("\n[cyan]Matrice d'accès RBAC:[/cyan]\n")
    console.print("[bold]Rôle[/bold]    | work | test | staging | prod | approve | rollback")
    console.print("-" * 70)
    for role_name, role_config in rbac.list_roles().items():
        perms = role_config.get("permissions", [])
        row = f"{role_name:8} |"
        for action in ["work_start", "test", "deploy_staging", "deploy_prod", "approve_prod", "rollback"]:
            mark = "✅" if "*" in perms or action in perms else "❌"
            row += f" {mark:4} |"
        console.print(row)

    console.print("\n[green]✅ RBAC configuré avec succès![/green]\n")
    console.print("[dim]Configuration sauvegardée dans: ~/.pacadev/rbac.json[/dim]\n")

    # Afficher le fichier de config
    config_file = Path.home() / ".pacadev" / "rbac.json"
    if config_file.exists():
        console.print(f"[dim]Fichier: {config_file}[/dim]\n")

if __name__ == "__main__":
    main()
