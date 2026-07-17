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

    TOKEN_LIFETIME_SECONDS = 15 * 60

    @classmethod
    def _get_secret_key(cls) -> bytes:
        if "PACADEV_SECRET_KEY" in os.environ:
            return os.environ["PACADEV_SECRET_KEY"].encode()

        secret_file = Path.home() / ".pacadev" / "secret.key"
        if secret_file.exists():
            return secret_file.read_bytes()

        secret_key = os.urandom(32)
        secret_file.parent.mkdir(parents=True, exist_ok=True)
        secret_file.write_bytes(secret_key)
        secret_file.chmod(0o600)
        return secret_key

    @classmethod
    def _tokens_file(cls) -> Path:
        return Path.home() / ".pacadev" / "tokens.jsonl"

    @classmethod
    def _store_token_data(cls, token: str, token_data: dict, signature: str) -> None:
        """Store token data for later verification."""
        f = cls._tokens_file()
        f.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "token": token,
            "data": token_data,
            "signature": signature,
        }
        with open(f, "a") as fh:
            fh.write(json.dumps(entry) + "\n")

    @classmethod
    def _load_token_data(cls, token: str) -> Optional[dict]:
        """Load stored token data by token string."""
        f = cls._tokens_file()
        if not f.exists():
            return None
        with open(f) as fh:
            for line in fh:
                if not line.strip():
                    continue
                entry = json.loads(line)
                if entry.get("token") == token:
                    return entry
        return None

    @classmethod
    def generate(
        cls,
        client: str,
        action: str,
        reason: str,
        user: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        timestamp = int(time.time())
        expires_at = timestamp + cls.TOKEN_LIFETIME_SECONDS

        token_data = {
            "client": client,
            "action": action,
            "reason": reason,
            "user": user,
            "timestamp": timestamp,
            "expires_at": expires_at,
            "metadata": metadata or {},
        }

        import subprocess
        try:
            git_commit = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                timeout=2,
                cwd=Path.home() / "pacadev",
            ).stdout.strip()[:8]
        except Exception:
            git_commit = "unknown"

        json_str = json.dumps(token_data, sort_keys=True, separators=(',', ':'))
        secret = cls._get_secret_key()
        signature = hmac.new(secret, json_str.encode(), hashlib.sha256).hexdigest()

        token = f"token_{timestamp}.{git_commit}.{signature}"
        cls._store_token_data(token, token_data, signature)
        return token

    @classmethod
    def verify(
        cls,
        token: str,
        client: str,
        action: Optional[str] = None,
    ) -> bool:
        try:
            parts = token.split(".")
            if len(parts) != 3 or not parts[0].startswith("token_"):
                raise TokenError("Format de token invalide")

            timestamp_str = parts[0].replace("token_", "")
            signature = parts[2]
            timestamp = int(timestamp_str)

            if time.time() > timestamp + cls.TOKEN_LIFETIME_SECONDS:
                raise TokenError(
                    f"Token expiré (généré à {datetime.fromtimestamp(timestamp).isoformat()})"
                )

            stored = cls._load_token_data(token)
            if stored is None:
                raise TokenError("Token inconnu (jamais émis par cette instance)")

            stored_data = stored["data"]
            if stored_data.get("client") != client:
                raise TokenError(
                    f"Client mismatch: attendu '{client}', obtenu '{stored_data.get('client')}'"
                )
            if action and stored_data.get("action") != action:
                raise TokenError(
                    f"Action mismatch: attendu '{action}', obtenu '{stored_data.get('action')}'"
                )

            json_str = json.dumps(stored_data, sort_keys=True, separators=(',', ':'))
            secret = cls._get_secret_key()
            expected_sig = hmac.new(secret, json_str.encode(), hashlib.sha256).hexdigest()

            if not hmac.compare_digest(signature, expected_sig):
                raise TokenError("Signature HMAC invalide (token falsifié)")

            return True

        except (ValueError, IndexError) as e:
            raise TokenError(f"Token invalide: {str(e)}")

    @classmethod
    def get_info(cls, token: str) -> Dict[str, Any]:
        try:
            parts = token.split(".")
            timestamp = int(parts[0].replace("token_", ""))
            expires_at = timestamp + cls.TOKEN_LIFETIME_SECONDS

            stored = cls._load_token_data(token)
            data = stored["data"] if stored else {}

            return {
                "timestamp": datetime.fromtimestamp(timestamp).isoformat(),
                "expires_at": datetime.fromtimestamp(expires_at).isoformat(),
                "expired": time.time() > expires_at,
                "client": data.get("client"),
                "action": data.get("action"),
                "user": data.get("user"),
                "reason": data.get("reason"),
            }
        except Exception:
            return {}
