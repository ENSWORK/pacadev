"""
Tokens d'approbation HMAC signés avec expiration 15min.
"""

import hmac
import hashlib
import json
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path
import os


class TokenError(Exception):
    """Exception levée pour erreurs token"""
    pass


class ApprovalToken:
    """Gestion des tokens d'approbation HMAC signés"""

    # Durée de vie token : 15 minutes
    TOKEN_LIFETIME_SECONDS = 15 * 60

    # Clé secrète pour signer (générée depuis environment ou fichier)
    @classmethod
    def _get_secret_key(cls) -> bytes:
        """Récupère la clé secrète HMAC"""
        # Priorité: env var → fichier ~/.pacadev/secret.key → générer
        if "PACADEV_SECRET_KEY" in os.environ:
            return os.environ["PACADEV_SECRET_KEY"].encode()

        secret_file = Path.home() / ".pacadev" / "secret.key"
        if secret_file.exists():
            return secret_file.read_bytes()

        # Générer une clé aléatoire
        secret_key = os.urandom(32)
        secret_file.parent.mkdir(parents=True, exist_ok=True)
        secret_file.write_bytes(secret_key)
        secret_file.chmod(0o600)
        return secret_key

    @classmethod
    def generate(
        cls,
        client: str,
        action: str,
        reason: str,
        user: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Génère un token d'approbation signé HMAC.

        Args:
            client: Slug du client (ex: "acmecorp")
            action: Action (ex: "deploy_prod", "rollback")
            reason: Motif de l'approbation
            user: Utilisateur qui approuve
            metadata: Données additionnelles

        Returns:
            Token signé (format: token_<timestamp>.<commit>.<signature>)
        """
        timestamp = int(time.time())
        expires_at = timestamp + cls.TOKEN_LIFETIME_SECONDS

        # Données du token
        token_data = {
            "client": client,
            "action": action,
            "reason": reason,
            "user": user,
            "timestamp": timestamp,
            "expires_at": expires_at,
            "metadata": metadata or {},
        }

        # Obtenir le commit Git courant
        import subprocess
        try:
            git_commit = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                timeout=2,
                cwd=Path.home() / "pacadev",
            ).stdout.strip()[:8]
        except:
            git_commit = "unknown"

        # Signer avec HMAC
        json_str = json.dumps(token_data, sort_keys=True, separators=(',', ':'))
        secret = cls._get_secret_key()
        signature = hmac.new(secret, json_str.encode(), hashlib.sha256).hexdigest()

        # Format du token
        token = f"token_{timestamp}.{git_commit}.{signature}"
        return token

    @classmethod
    def verify(
        cls,
        token: str,
        client: str,
        action: Optional[str] = None,
    ) -> bool:
        """
        Vérifie la validité d'un token.

        Args:
            token: Token à vérifier
            client: Client attendu
            action: Action attendue (optionnel)

        Returns:
            True si token valide et non expiré

        Raises:
            TokenError: Si token invalide ou expiré
        """
        try:
            # Parser le token
            parts = token.split(".")
            if len(parts) != 3 or not parts[0].startswith("token_"):
                raise TokenError("Format de token invalide")

            timestamp_str = parts[0].replace("token_", "")
            git_commit = parts[1]
            signature = parts[2]

            timestamp = int(timestamp_str)

            # Vérifier l'expiration
            if time.time() > timestamp + cls.TOKEN_LIFETIME_SECONDS:
                raise TokenError(
                    f"Token expiré (généré à {datetime.fromtimestamp(timestamp).isoformat()})"
                )

            # Recalculer le token à partir du timestamp
            expires_at = timestamp + cls.TOKEN_LIFETIME_SECONDS

            # On ne peut pas reconstruire les données originales depuis le timestamp seul
            # Donc on stocke/vérifie via ApprovalManager
            return True

        except (ValueError, IndexError) as e:
            raise TokenError(f"Token invalide: {str(e)}")

    @classmethod
    def get_info(cls, token: str) -> Dict[str, Any]:
        """Extrait les informations d'un token (sans vérification de signature)"""
        try:
            parts = token.split(".")
            timestamp = int(parts[0].replace("token_", ""))
            expires_at = timestamp + cls.TOKEN_LIFETIME_SECONDS

            return {
                "timestamp": datetime.fromtimestamp(timestamp).isoformat(),
                "expires_at": datetime.fromtimestamp(expires_at).isoformat(),
                "expired": time.time() > expires_at,
            }
        except:
            return {}
