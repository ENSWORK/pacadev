"""
Audit log immuable avec chaînage hash pour intégrité.
Chaque entrée inclut le hash du log précédent.
"""

import json
import os
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from typing import Dict, Any, Optional
import subprocess


class AuditLogger:
    """Logger d'audit immuable avec hash chaîné"""

    def __init__(self, log_file: Optional[Path] = None):
        if log_file is None:
            log_file = Path.home() / ".pacadev" / "audit-log.jsonl"
        self.log_file = log_file
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

    def _get_last_hash(self) -> str:
        """Récupère le hash du dernier log ou '0' si premier"""
        if not self.log_file.exists():
            return "0" * 64

        try:
            last_hash = "0" * 64
            with open(self.log_file) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        data = json.loads(line)
                        last_hash = data.get("hash", "0" * 64)
            return last_hash
        except Exception:
            return "0" * 64

    def _compute_hash(self, entry: dict, prev_hash: str) -> str:
        """Calcule le hash SHA256 d'une entrée"""
        # Créer une copie sans le hash lui-même
        entry_copy = {k: v for k, v in entry.items() if k != "hash"}
        entry_copy["prev_hash"] = prev_hash

        # JSON canonique (sorted keys)
        json_str = json.dumps(entry_copy, sort_keys=True, separators=(',', ':'))
        return sha256(json_str.encode()).hexdigest()

    def _get_current_user(self) -> str:
        """Récupère l'utilisateur courant"""
        try:
            return subprocess.run(["whoami"], capture_output=True, text=True, timeout=2).stdout.strip()
        except:
            return "unknown"

    def _get_git_commit(self) -> str:
        """Récupère le commit Git courant"""
        try:
            return subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True, text=True, timeout=2, cwd=Path.home() / "pacadev"
            ).stdout.strip()[:8]
        except:
            return "unknown"

    def log_action(self, action: str, client: str, **kwargs) -> dict:
        """
        Enregistre une action avec hash chaîné.

        Args:
            action: Type d'action (work_start, deploy, rollback, etc.)
            client: Slug du client
            **kwargs: Données additionnelles

        Returns:
            L'entrée enregistrée
        """
        prev_hash = self._get_last_hash()

        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "client": client,
            "user": self._get_current_user(),
            "git_commit": self._get_git_commit(),
            "prev_hash": prev_hash,
        }
        entry.update(kwargs)

        # Calculer et ajouter le hash
        entry["hash"] = self._compute_hash(entry, prev_hash)

        # Écrire le log
        with open(self.log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
            f.flush()
            os.fsync(f.fileno())

        return entry

    def get_client_history(self, client: str) -> list[dict]:
        """Récupère l'historique des actions pour un client"""
        if not self.log_file.exists():
            return []

        history = []
        with open(self.log_file) as f:
            for line in f:
                if line.strip():
                    entry = json.loads(line)
                    if entry.get("client") == client:
                        history.append(entry)
        return history

    def get_all_logs(self) -> list[dict]:
        """Récupère tous les logs"""
        if not self.log_file.exists():
            return []

        logs = []
        with open(self.log_file) as f:
            for line in f:
                if line.strip():
                    logs.append(json.loads(line))
        return logs
