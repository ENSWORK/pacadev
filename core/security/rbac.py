"""
RBAC (Role-Based Access Control) pour PACADEV.
Définit les rôles, permissions, et enforce l'accès.
"""

import json
from enum import Enum
from typing import Set, Dict, List, Optional
from pathlib import Path


class Role(Enum):
    """Rôles disponibles"""
    ADMIN = "admin"        # Accès total
    LEAD = "lead"          # Approbations + déploiements
    DEV = "dev"            # Développement + staging
    VIEWER = "viewer"      # Lecture seule


class Permission(Enum):
    """Actions contrôlées"""
    WORK_START = "work_start"
    TEST = "test"
    DEPLOY_STAGING = "deploy_staging"
    DEPLOY_PROD = "deploy_prod"
    ROLLBACK = "rollback"
    APPROVE_PROD = "approve_prod"
    MANAGE_CLIENTS = "manage_clients"


class RBAC:
    """Système de contrôle d'accès basé rôles"""

    # Configuration par défaut des rôles
    DEFAULT_CONFIG = {
        "roles": {
            "admin": {
                "permissions": ["*"],
                "clients": ["*"],
            },
            "lead": {
                "permissions": [
                    "work_start",
                    "test",
                    "deploy_staging",
                    "deploy_prod",
                    "approve_prod",
                    "rollback",
                ],
                "clients": ["*"],
            },
            "dev": {
                "permissions": [
                    "work_start",
                    "test",
                    "deploy_staging",
                ],
                "clients": ["*"],
            },
            "viewer": {
                "permissions": [],
                "clients": ["*"],
            },
        },
        "user_roles": {},  # Mapping user → role
    }

    def __init__(self, config_file: Optional[Path] = None):
        if config_file is None:
            config_file = Path.home() / ".pacadev" / "rbac.json"
        self.config_file = config_file
        self.config = self._load_config()

    def _load_config(self) -> Dict:
        """Charge la configuration RBAC ou utilise les defaults"""
        if self.config_file.exists():
            try:
                with open(self.config_file) as f:
                    config = json.load(f) or {}
                    # Fusionner avec defaults
                    return {**self.DEFAULT_CONFIG, **config}
            except Exception:
                return self.DEFAULT_CONFIG
        return self.DEFAULT_CONFIG

    def _save_config(self) -> None:
        """Sauvegarde la configuration RBAC"""
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_file, "w") as f:
            json.dump(self.config, f, indent=2)

    def get_user_role(self, user: str) -> Optional[str]:
        """Récupère le rôle d'un utilisateur"""
        return self.config.get("user_roles", {}).get(user)

    def set_user_role(self, user: str, role: str) -> None:
        """Attribue un rôle à un utilisateur"""
        if role not in self.config.get("roles", {}):
            raise ValueError(f"Rôle invalide: {role}")

        if "user_roles" not in self.config:
            self.config["user_roles"] = {}

        self.config["user_roles"][user] = role
        self._save_config()

    def can_access(
        self,
        user: str,
        permission: str,
        client: str,
    ) -> bool:
        """
        Vérifie si un utilisateur a accès à une action sur un client.

        Args:
            user: Utilisateur
            permission: Permission à vérifier (ex: "deploy_prod")
            client: Client concerné

        Returns:
            True si accès autorisé
        """
        role = self.get_user_role(user)
        if not role:
            return False

        role_config = self.config.get("roles", {}).get(role, {})

        # Vérifier les permissions
        permissions = role_config.get("permissions", [])
        if "*" in permissions:
            # Accès total
            pass
        elif permission not in permissions:
            return False

        # Vérifier les clients
        clients = role_config.get("clients", [])
        if "*" in clients:
            # Accès à tous les clients
            pass
        elif client not in clients:
            return False

        return True

    def get_allowed_clients(self, user: str) -> Set[str]:
        """Récupère la liste des clients accessibles pour un utilisateur"""
        role = self.get_user_role(user)
        if not role:
            return set()

        role_config = self.config.get("roles", {}).get(role, {})
        clients = role_config.get("clients", [])

        if "*" in clients:
            # Retourner tous les clients configurés
            all_clients = set()
            for v_dir in Path.home() / "pacadev" | {"v14", "v17", "v19"}:
                v_path = Path.home() / "pacadev" / v_dir
                if v_path.exists():
                    for client_dir in v_path.glob("clients/*/"):
                        all_clients.add(client_dir.name)
            return all_clients

        return set(clients)

    def get_user_permissions(self, user: str) -> Set[str]:
        """Récupère la liste des permissions pour un utilisateur"""
        role = self.get_user_role(user)
        if not role:
            return set()

        role_config = self.config.get("roles", {}).get(role, {})
        permissions = role_config.get("permissions", [])

        if "*" in permissions:
            return {perm.value for perm in Permission}

        return set(permissions)

    def list_users(self) -> Dict[str, str]:
        """Récupère la liste de tous les utilisateurs et leurs rôles"""
        return self.config.get("user_roles", {})

    def list_roles(self) -> Dict[str, Dict]:
        """Récupère la configuration de tous les rôles"""
        return self.config.get("roles", {})
