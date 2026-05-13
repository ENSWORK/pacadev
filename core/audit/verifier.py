"""
Vérification d'intégrité des logs d'audit avec chaînage hash.
"""

import json
from hashlib import sha256
from pathlib import Path
from typing import Optional, Tuple, List
from dataclasses import dataclass


@dataclass
class VerificationResult:
    """Résultat de la vérification d'intégrité"""
    valid: bool
    total_entries: int
    corrupted_entries: List[int]
    details: str

    def __str__(self) -> str:
        if self.valid:
            return f"✅ Audit log valide ({self.total_entries} entrées)"
        else:
            return f"❌ Audit log corrompu! Entrées invalides: {self.corrupted_entries}"


class AuditVerifier:
    """Vérification d'intégrité des logs d'audit"""

    @staticmethod
    def _compute_hash(entry: dict, prev_hash: str) -> str:
        """Recalcule le hash d'une entrée"""
        entry_copy = {k: v for k, v in entry.items() if k != "hash"}
        entry_copy["prev_hash"] = prev_hash
        json_str = json.dumps(entry_copy, sort_keys=True, separators=(',', ':'))
        return sha256(json_str.encode()).hexdigest()

    @staticmethod
    def verify_log_integrity(log_file: Optional[Path] = None) -> VerificationResult:
        """
        Vérifie l'intégrité complète du log d'audit.

        Returns:
            VerificationResult avec détails de la vérification
        """
        if log_file is None:
            log_file = Path.home() / ".pacadev" / "audit-log.jsonl"

        if not log_file.exists():
            return VerificationResult(True, 0, [], "Pas de log d'audit")

        corrupted = []
        prev_hash = "0" * 64

        try:
            with open(log_file) as f:
                for idx, line in enumerate(f, 1):
                    if not line.strip():
                        continue

                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        corrupted.append(idx)
                        continue

                    stored_hash = entry.get("hash")
                    stored_prev_hash = entry.get("prev_hash", "0" * 64)

                    # Vérifier la chaîne
                    if stored_prev_hash != prev_hash:
                        corrupted.append(idx)

                    # Vérifier le hash
                    computed_hash = AuditVerifier._compute_hash(entry, stored_prev_hash)
                    if computed_hash != stored_hash:
                        corrupted.append(idx)

                    prev_hash = stored_hash

        except Exception as e:
            return VerificationResult(False, 0, [], f"Erreur lecture: {str(e)}")

        total = max(idx for idx, _ in enumerate((log_file.read_text() or "").split('\n'), 1) if _)
        valid = len(corrupted) == 0

        return VerificationResult(
            valid=valid,
            total_entries=total,
            corrupted_entries=corrupted,
            details="OK" if valid else f"Entrées corrompues: {corrupted}"
        )

    @staticmethod
    def verify_action_chain(log_file: Optional[Path], client: str) -> Tuple[bool, str]:
        """
        Vérifie la chaîne d'actions pour un client.

        Returns:
            (valid, message)
        """
        if log_file is None:
            log_file = Path.home() / ".pacadev" / "audit-log.jsonl"

        if not log_file.exists():
            return True, "Pas de log"

        logs = []
        with open(log_file) as f:
            for line in f:
                if line.strip():
                    entry = json.loads(line)
                    if entry.get("client") == client:
                        logs.append(entry)

        if not logs:
            return True, f"Aucune action pour {client}"

        # Vérifier l'ordre chronologique
        prev_ts = None
        for entry in logs:
            ts = entry.get("timestamp")
            if prev_ts and ts < prev_ts:
                return False, f"Ordre chronologique invalide à {ts}"
            prev_ts = ts

        return True, f"Chaîne valide ({len(logs)} actions)"
