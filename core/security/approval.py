"""
Gestion des approbations avec stockage, vérification de signature, et usage unique.
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from .tokens import ApprovalToken, TokenError


class ApprovalManager:
    """Gère les approbations et leur usage unique"""

    def __init__(self, approvals_file: Optional[Path] = None):
        if approvals_file is None:
            approvals_file = Path.home() / ".pacadev" / "approvals.jsonl"
        self.approvals_file = approvals_file
        self.approvals_file.parent.mkdir(parents=True, exist_ok=True)

    def issue_approval(
        self,
        client: str,
        action: str,
        reason: str,
        user: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Émet une nouvelle approbation et retourne le token.

        Args:
            client: Client concerné
            action: Action à approuver (ex: "deploy_prod")
            reason: Motif de l'approbation
            user: Utilisateur qui approuve
            metadata: Données additionnelles

        Returns:
            Token d'approbation
        """
        token = ApprovalToken.generate(client, action, reason, user, metadata)

        # Enregistrer l'approbation
        approval = {
            "timestamp": datetime.utcnow().isoformat(),
            "token": token,
            "client": client,
            "action": action,
            "reason": reason,
            "user": user,
            "used": False,
            "used_at": None,
            "used_by": None,
        }

        with open(self.approvals_file, "a") as f:
            f.write(json.dumps(approval) + "\n")

        return token

    def use_approval(self, token: str, user: str) -> bool:
        """
        Utilise une approbation (mark as used pour éviter doublons).

        Args:
            token: Token à utiliser
            user: Utilisateur qui utilise le token

        Returns:
            True si approuvé et utilisé avec succès

        Raises:
            TokenError: Si token invalide, expiré ou déjà utilisé
        """
        if not self.approvals_file.exists():
            raise TokenError("Aucune approbation trouvée")

        approvals = []
        found = False
        used_approval = None

        with open(self.approvals_file) as f:
            for line in f:
                if not line.strip():
                    continue
                approval = json.loads(line)
                if approval["token"] == token:
                    found = True
                    if approval["used"]:
                        raise TokenError("Approbation déjà utilisée")

                    # Vérifier l'expiration
                    token_info = ApprovalToken.get_info(token)
                    if token_info.get("expired"):
                        raise TokenError("Approbation expirée")

                    # Marquer comme utilisé
                    approval["used"] = True
                    approval["used_at"] = datetime.utcnow().isoformat()
                    approval["used_by"] = user
                    used_approval = approval

                approvals.append(approval)

        if not found:
            raise TokenError("Approbation non trouvée")

        # Réécrire le fichier
        with open(self.approvals_file, "w") as f:
            for approval in approvals:
                f.write(json.dumps(approval) + "\n")

        return True

    def get_approval(self, token: str) -> Optional[Dict[str, Any]]:
        """Récupère les informations d'une approbation"""
        if not self.approvals_file.exists():
            return None

        with open(self.approvals_file) as f:
            for line in f:
                if line.strip():
                    approval = json.loads(line)
                    if approval["token"] == token:
                        return approval

        return None

    def get_pending_approvals(self, client: str, action: str) -> list[Dict[str, Any]]:
        """Récupère les approbations en attente pour un client/action"""
        if not self.approvals_file.exists():
            return []

        pending = []
        with open(self.approvals_file) as f:
            for line in f:
                if line.strip():
                    approval = json.loads(line)
                    if (
                        approval["client"] == client
                        and approval["action"] == action
                        and not approval["used"]
                    ):
                        # Vérifier que non expiré
                        token_info = ApprovalToken.get_info(approval["token"])
                        if not token_info.get("expired"):
                            pending.append(approval)

        return pending

    def get_approval_history(self, client: str) -> list[Dict[str, Any]]:
        """Récupère l'historique des approbations pour un client"""
        if not self.approvals_file.exists():
            return []

        history = []
        with open(self.approvals_file) as f:
            for line in f:
                if line.strip():
                    approval = json.loads(line)
                    if approval["client"] == client:
                        history.append(approval)

        return history
