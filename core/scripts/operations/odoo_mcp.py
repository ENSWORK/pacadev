#!/usr/bin/env python3
"""Transport MCP Odoo en lecture seule - stdlib seule, sans aucun secret.

Ce module est la version serveur de Helper-Ai/odoo_mcp.py. Les deux doivent
garder le meme comportement ; en cas d'ecart, la regle appliquee est la meme
partout : une cle API ne vit jamais dans un fichier versionne.

Differences voulues avec le miroir windows :
  - `strict` vaut True par defaut. Un job automatique doit s'arreter si la
    configuration est absente : ecrire une projection vide sans le dire est
    plus grave qu'un job arrete.
  - aucun `quiet` : ici, tout doit etre journalise.

La cle vient de l'environnement, injectee par systemd via
EnvironmentFile=core/scripts/operations/.env (permissions 600, gitignore).
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

# URL par defaut : adresse de service, pas un secret.
DEFAULT_MCP_URL = "http://192.168.11.50:9017/mcp"
DEFAULT_TIMEOUT_S = 30

# Les 5 octets "undefined" de CP1252 : le decodeur Windows les restitue en
# caracteres de controle. Python leve une erreur, d'ou la traduction manuelle.
UNDEFINED_CP1252 = {
    "\u0081": b"\x81",
    "\u008d": b"\x8d",
    "\u008f": b"\x8f",
    "\u0090": b"\x90",
    "\u009d": b"\x9d",
}


class McpError(RuntimeError):
    """Erreur de configuration : aucun appel ne peut aboutir."""


def log(message):
    """Journalise sur stderr : stdout reste reserve au resume de sortie."""
    print(message, file=sys.stderr, flush=True)


def load_env_file(path):
    """Lit un .env minimal (KEY=VALUE, # pour les commentaires)."""
    valeurs = {}
    try:
        texte = Path(path).read_text(encoding="utf-8")
    except OSError:
        return valeurs
    for ligne in texte.splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, _, valeur = ligne.partition("=")
        valeurs[cle.strip()] = valeur.strip()
    return valeurs


def resolve_config(env_file=None, env=None):
    """Retourne (url, cle). L'environnement l'emporte sur le .env."""
    env = os.environ if env is None else env
    url = (env.get("ODOO_MCP_URL") or "").strip()
    cle = (env.get("ODOO_API_KEY") or "").strip()
    if not (url and cle):
        ici = Path(__file__).resolve().parent
        for candidat in (env_file, ici / ".env"):
            if not candidat:
                continue
            valeurs = load_env_file(candidat)
            url = url or valeurs.get("ODOO_MCP_URL", "").strip()
            cle = cle or valeurs.get("ODOO_API_KEY", "").strip()
            if url and cle:
                break
    return url or DEFAULT_MCP_URL, cle


def require_key(env_file=None, env=None):
    """Renvoie la cle, ou leve McpError sans jamais la divulguer."""
    _, cle = resolve_config(env_file, env)
    if not cle:
        raise McpError(
            "ODOO_API_KEY absente. Definir la variable d'environnement, ou la "
            "placer dans core/scripts/operations/.env (ODOO_MCP_URL + "
            "ODOO_API_KEY). Aucune cle n'est codee en dur dans le depot, "
            "c'est volontaire."
        )
    return cle


def call(name, arguments, env_file=None, env=None, timeout_s=DEFAULT_TIMEOUT_S, strict=True):
    """Appelle un outil MCP en lecture. Retourne la reponse JSON, ou None.

    None = Odoo n'a pas repondu (reseau, timeout, HTTP). Au-dela de strict
    passes sur l'absence de cle, une erreur de transport est signalee par None :
    c'est a l'appelant de dire si c'est fatal pour lui.
    """
    url, _ = resolve_config(env_file, env)
    try:
        cle = require_key(env_file, env)
    except McpError:
        if strict:
            raise
        log(f"AVERTISSEMENT Odoo ignore ({name}) : ODOO_API_KEY absente")
        return None

    corps = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }).encode("utf-8")
    requete = urllib.request.Request(url, data=corps, method="POST")
    requete.add_header("Authorization", f"Bearer {cle}")
    requete.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(requete, timeout=timeout_s) as reponse:
            return json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        log(f"ERREUR MCP {name} : HTTP {exc.code}")
        return None
    except Exception as exc:
        log(f"ERREUR MCP {name} : {exc}")
        return None


def records(reponse):
    """Extrait la liste d'enregistrements d'une reponse search_records.

    Forme attendue : {result:{structuredContent:{records:[...]}}}. Les autres
    formes sont tolerees pour ne pas casser si le MCP change.
    """
    if not reponse:
        return []
    contenu = reponse.get("result", {}).get("structuredContent", {})
    if isinstance(contenu, dict):
        lot = contenu.get("records")
        if isinstance(lot, list):
            return lot
        if isinstance(contenu.get("record"), dict):
            return [contenu["record"]]
    if isinstance(reponse.get("result", {}).get("records"), list):
        return reponse["result"]["records"]
    return []


def groups(reponse):
    """Extrait la liste de groupes d'une reponse `aggregate_records`.

    Meme forme que `records`, pour `structuredContent.groups`. Son total sert de
    temoin d'exhaustivite : sans temoin, une page vide vaut aussi bien fin de
    liste que panne reseau, et le job ne peut pas distinguer les deux.
    """
    if not reponse:
        return []
    contenu = reponse.get("result", {}).get("structuredContent", {})
    if isinstance(contenu, dict) and isinstance(contenu.get("groups"), list):
        return contenu["groups"]
    if isinstance(reponse.get("result", {}).get("groups"), list):
        return reponse["result"]["groups"]
    return []


def call_obligatoire(name, arguments, env_file=None, env=None,
                     timeout_s=DEFAULT_TIMEOUT_S):
    """Comme `call`, mais une panne de transport est fatale.

    `call` rend `None` quand Odoo ne repond pas : c'est utile pour un appel
    facultatif, et dangereux pour la pagination d'un job automatique, ou `None`
    se lit ensuite comme une liste vide. Ici on leve.
    """
    reponse = call(name, arguments, env_file=env_file, env=env, timeout_s=timeout_s)
    if reponse is None:
        raise McpError(f"transport MCP en echec sur {name} : Odoo n'a pas repondu")
    if reponse.get("result", {}).get("isError"):
        # Le serveur explique toujours pourquoi. Renvoyer "une erreur" sans
        # plus oblige a rejouer la sonde a la main pour comprendre l'arret.
        raise McpError(f"l'outil MCP {name} a renvoye une erreur : {texte_erreur(reponse)}")
    return reponse


def texte_erreur(reponse, maximum=300):
    """Le message d'erreur du serveur, ou 'raison inconnue'."""
    morceaux = []
    for bloc in (reponse.get("result", {}).get("content") or []):
        if isinstance(bloc, dict) and isinstance(bloc.get("text"), str):
            morceaux.append(bloc["text"].strip())
    return " / ".join(morceaux)[:maximum] or "raison inconnue"
