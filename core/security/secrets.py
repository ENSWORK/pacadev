"""
Masquage et filtrage de secrets dans les logs et prompts IA.
"""

import re
from typing import Dict, List, Any
from pathlib import Path


class SecretsMasker:
    """Masque les secrets sensibles dans les logs et données"""

    # Patterns de secrets communs
    DEFAULT_PATTERNS = {
        "api_key": r"[Aa][Pp][Ii][-_]?[Kk][Ee][Yy]\s*[:=]\s*['\"]?([a-zA-Z0-9_-]+)['\"]?",
        "token": r"[Tt]oken\s*[:=]\s*['\"]?([a-zA-Z0-9_-]+)['\"]?",
        "password": r"[Pp]ass(?:word|wd)\s*[:=]\s*['\"]?([^\s'\"\n]+)['\"]?",
        "secret": r"[Ss]ecret\s*[:=]\s*['\"]?([a-zA-Z0-9_-]+)['\"]?",
        "private_key": r"-----BEGIN [A-Z]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z]+ PRIVATE KEY-----",
        "aws_key": r"AKIA[0-9A-Z]{16}",
        "github_token": r"ghp_[a-zA-Z0-9_]{36,255}",
        "slack_token": r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*",
        "url_with_credentials": r"(https?|ftp)://[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+@",
    }

    def __init__(self, custom_patterns: Dict[str, str] = None):
        self.patterns = {**self.DEFAULT_PATTERNS}
        if custom_patterns:
            self.patterns.update(custom_patterns)

    def mask_value(self, value: str, mask_char: str = "*") -> str:
        """Masque une valeur sensible"""
        if not value:
            return value
        if len(value) <= 4:
            return mask_char * len(value)
        # Garder les premiers et derniers caractères
        return value[:2] + mask_char * (len(value) - 4) + value[-2:]

    def mask_dict(self, data: Dict[str, Any], sensitive_keys: List[str] = None) -> Dict[str, Any]:
        """Masque les valeurs sensibles dans un dictionnaire"""
        if sensitive_keys is None:
            sensitive_keys = [
                "password", "token", "secret", "api_key", "private_key",
                "aws_access_key_id", "aws_secret_access_key",
            ]

        masked = {}
        for key, value in data.items():
            if any(sk.lower() in key.lower() for sk in sensitive_keys):
                if isinstance(value, str):
                    masked[key] = self.mask_value(value)
                else:
                    masked[key] = "***MASKED***"
            elif isinstance(value, dict):
                masked[key] = self.mask_dict(value, sensitive_keys)
            elif isinstance(value, list):
                masked[key] = [
                    self.mask_dict(item, sensitive_keys) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                masked[key] = value

        return masked

    def mask_text(self, text: str) -> str:
        """Masque tous les secrets détectés dans un texte"""
        masked = text

        for pattern_name, pattern in self.patterns.items():
            matches = re.finditer(pattern, masked)
            for match in matches:
                # Remplacer le contenu du groupe capturé
                if match.groups():
                    masked = masked.replace(match.group(1), self.mask_value(match.group(1)))
                else:
                    masked = masked.replace(match.group(0), "***MASKED***")

        return masked

    def contains_secret(self, text: str) -> bool:
        """Vérifie si un texte contient des secrets"""
        for pattern in self.patterns.values():
            if re.search(pattern, text):
                return True
        return False

    def extract_secrets(self, text: str) -> List[Dict[str, str]]:
        """Extrait les secrets détectés"""
        secrets = []

        for pattern_name, pattern in self.patterns.items():
            for match in re.finditer(pattern, text):
                secrets.append({
                    "type": pattern_name,
                    "found": match.group(0),
                    "position": (match.start(), match.end()),
                })

        return secrets

    @staticmethod
    def load_from_env_file(env_file: Path) -> Dict[str, str]:
        """Charge les secrets depuis un fichier .env (pour comparaison)"""
        secrets_dict = {}
        if env_file.exists():
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        secrets_dict[key.strip()] = value.strip()
        return secrets_dict
