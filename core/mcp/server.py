"""
Serveur MCP pour PACADEV - Expose les outils CLI aux agents IA
"""
from mcp.server.fastmcp import FastMCP
import subprocess
import os

PACADEV_ROOT = os.getenv("PACADEV_ROOT", "/home/pacadev/pacadev")

mcp = FastMCP("PACADEV")


@mcp.tool()
def run_pacadev_review(client: str) -> str:
    """Execute la revue de code PACADEV pour un client."""
    try:
        result = subprocess.run(
            ["pacadev", "work", "review", "--client", client],
            capture_output=True,
            text=True,
            cwd=PACADEV_ROOT,
        )
        return result.stdout if result.returncode == 0 else f"ERREUR: {result.stderr}"
    except Exception as e:
        return f"ERREUR: {str(e)}"


@mcp.tool()
def run_pacadev_test(module: str, client: str) -> str:
    """Lance les tests Odoo pour un module specifique."""
    try:
        result = subprocess.run(
            ["pacadev", "work", "test", "--module", module, "--client", client],
            capture_output=True,
            text=True,
            cwd=PACADEV_ROOT,
        )
        return result.stdout if result.returncode == 0 else f"ERREUR: {result.stderr}"
    except Exception as e:
        return f"ERREUR: {str(e)}"


@mcp.tool()
def get_odoo_rules() -> str:
    """Retourne les regles Odoo v17/v19 de PACADEV."""
    rules_path = os.path.join(PACADEV_ROOT, "core/memory/rules/odoo_v17_v19_strict.md")
    try:
        with open(rules_path, "r") as f:
            return f.read()
    except Exception as e:
        return f"ERREUR: Impossible de lire les regles: {str(e)}"


@mcp.tool()
def list_pacadev_clients() -> str:
    """Liste tous les clients PACADEV disponibles."""
    try:
        result = subprocess.run(
            ["pacadev", "list"],
            capture_output=True,
            text=True,
            cwd=PACADEV_ROOT,
        )
        return result.stdout if result.returncode == 0 else f"ERREUR: {result.stderr}"
    except Exception as e:
        return f"ERREUR: {str(e)}"


if __name__ == "__main__":
    mcp.run()
