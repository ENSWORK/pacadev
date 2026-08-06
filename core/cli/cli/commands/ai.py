"""
Commande CLI : pacadev ai generate
Genere du code Odoo en utilisant l'IA avec le contexte PACADEV
"""
import typer
import os
import sys
from pathlib import Path
from rich.console import Console

PACADEV_ROOT = Path(os.getenv("PACADEV_ROOT", "/home/pacadev/pacadev"))
RULES_PATH = PACADEV_ROOT / "core" / "memory" / "rules" / "odoo_v17_v19_strict.md"

app = typer.Typer(help="Commandes IA pour PACADEV")
console = Console()


def load_rules() -> str:
    try:
        return RULES_PATH.read_text()
    except FileNotFoundError:
        return ""


def call_llm(prompt: str) -> str:
    """Appelle le LLM via LiteLLM avec fallback automatique."""
    try:
        import litellm
    except ImportError:
        console.print("[red]litellm non installe. Lancez: pip install 'litellm[proxy]'[/red]")
        raise typer.Exit(1)

    model = os.getenv("LITELLM_MODEL", "openrouter/google/gemini-2.0-flash-001")
    fallback_model = os.getenv("LITELLM_FALLBACK_MODEL", "deepseek/deepseek-chat")
    api_base = os.getenv("LITELLM_API_BASE", "http://localhost:4000")

    try:
        response = litellm.completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            api_base=api_base,
        )
        return response.choices[0].message.content
    except Exception:
        try:
            response = litellm.completion(
                model=fallback_model,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content
        except Exception as fallback_error:
            raise RuntimeError(f"LLM principal et fallback echoues: {fallback_error}")


@app.command()
def generate(
    task: str = typer.Option(..., "--task", "-t", help="Description de la tache a realiser"),
    client: str = typer.Option(..., "--client", "-c", help="Slug du client"),
    output: str = typer.Option(None, "--output", "-o", help="Fichier de sortie (optionnel)"),
):
    """
    Genere du code Odoo en utilisant l'IA.

    Exemple:
        pacadev ai generate --task "Cree un modele ticket" --client afrequip
    """
    console.print(f"[blue]IA Generation pour le client : [bold]{client}[/bold][/blue]")
    console.print(f"[dim]Tache : {task}[/dim]")

    rules = load_rules()
    prompt = f"""{rules}

# TACHE A REALISER
{task}

# INSTRUCTIONS
Genere le code complet en respectant les regles PACADEV et Odoo v17/v19.
Inclus tous les fichiers necessaires : modele Python, vues XML, __manifest__.py, security/ir.model.access.csv.
"""
    try:
        console.print("[yellow]Appel du modele IA...[/yellow]")
        result = call_llm(prompt)

        if output:
            Path(output).write_text(result)
            console.print(f"[green]Code genere et sauvegarde dans : {output}[/green]")
        else:
            console.print()
            console.print(result)
            console.print()
            console.print("[green]Code genere avec succes[/green]")
    except Exception as e:
        console.print(f"[red]ERREUR : {str(e)}[/red]")
        raise typer.Exit(1)


@app.command()
def rules():
    """Affiche les regles Odoo v17/v19 de PACADEV"""
    content = load_rules()
    if content:
        console.print(content)
    else:
        console.print("[yellow]Fichier de regles non trouve[/yellow]")
        raise typer.Exit(1)
