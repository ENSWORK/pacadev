import subprocess
import yaml
from pathlib import Path

SECRETS_DIR = Path("/data/Pacadev/core/secrets")
SOPS_AGE_KEY = Path.home() / ".config" / "sops" / "age" / "keys.txt"


def _sops_env() -> dict:
    import os
    env = os.environ.copy()
    env["SOPS_AGE_KEY_FILE"] = str(SOPS_AGE_KEY)
    return env


def load_secrets(client: str) -> dict:
    secret_file = SECRETS_DIR / f"{client}.enc.yaml"
    if not secret_file.exists():
        return {}
    result = subprocess.run(
        ["sops", "-d", str(secret_file)],
        capture_output=True, text=True, env=_sops_env()
    )
    if result.returncode != 0:
        raise RuntimeError(f"SOPS déchiffrement échoué: {result.stderr}")
    return yaml.safe_load(result.stdout) or {}


def get_secret(client: str, key: str, default: str = None) -> str:
    secrets = load_secrets(client)
    return secrets.get(key, default)


def init_client_secrets(client: str):
    """Crée un fichier secrets chiffré vide pour un nouveau client"""
    template = SECRETS_DIR / ".env.template.yaml"
    dest = SECRETS_DIR / f"{client}.enc.yaml"
    if dest.exists():
        return
    dest.write_text(template.read_text())
    subprocess.run(
        ["sops", "-e", "-i", str(dest)],
        env=_sops_env(), check=True
    )
