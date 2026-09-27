#!/usr/bin/env python3
"""Genere la projection JSON des taches Odoo pour le cockpit PACADEV.

Source de verite cote donnees : la base Odoo `erpenswork`, projet 1
(« Enswork - Gestion des taches »), en lecture seule via le MCP.

Ce script est execute par l'unite systemd utilisateur
`pacadev-operations-projection` toutes les 30 minutes. Il est concu pour un
environnement non surveille, donc il ne suppose rien de l'interactif :

  - aucune dependance tierce : `python3` systeme et la seule bibliotheque
    standard. Le `.venv` du depot est gitignore et pourrait etre reconstruit ;
    un job quotidien ne doit dependre de rien d'installable ;
  - ecriture atomique : le fichier temporaire est ecrit et valide dans le meme
    dossier, puis `os.replace`. Le serveur Next lit la projection en continu et
    ne doit jamais tomber sur un fichier a moitie ecrit ;
  - controle de coherence avant remplacement : mieux vaut garder une projection
    datee qu'un instantane incoherent (fait memoire : le cockpit a affiche des
    stades incoherents quand le JSON etait tronque) ;
  - instantane quotidien archive dans `history/`, purge au-dela de la retention ;
  - aucun secret dans le fichier produit ni dans les journaux.

Sorties (codes de retour) :
  0  projection ecrite
  2  Odoo injoignable, ou cle absente
  3  controle de coherence en echec : rien n'est remplace
  4  historique / purge en echec (la projection reste valide)
"""
import argparse
import html
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import odoo_mcp

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent  # core/scripts/operations -> racine du depot

# Cible par defaut : la projection consommee par le cockpit web.
CHEMIN_DEFAUT = RACINE / "web" / ".data" / "operations-tasks.json"
HISTORIQUE_DEFAUT = RACINE / "web" / ".data" / "history"
RETENTION_DEFAUT = 90
SCHEMA_VERSION = 1

PROJECT_ID = 1
PAGE = 100
FIELDS = [
    "id", "name", "stage_id", "date_deadline", "priority",
    "user_ids", "parent_id", "tag_ids", "description", "active", "project_id",
]

# Cartographie verifiee sur la base erpenswork le 2026-09-25 (projet 1).
STAGE_KEYS = {
    1: "reception",
    8: "a_faire",
    9: "en_cours",
    10: "bloque",
    11: "en_validation",
    12: "termine",
    13: "annule",
    20: "acheve",
}
# « acheve » est terminal. Le cockpit derive deja la terminalite de stage_key
# (fait memoire : is_terminal valait false sur des taches acheve), mais le
# fichier doit dire vrai.
TERMINAL_KEYS = {"termine", "annule", "acheve"}

CU_RE = re.compile(r"\[CU:([0-9A-Za-z]+)\]")
GH_RE = re.compile(r"\[GH:(\d+)\]")
RECUR_RE = re.compile(
    r"(r[eé]curr\w*|chaque\s+(mois|trimestre|an|semaine|jour)|mensuel|trimestriel|annuel)",
    re.IGNORECASE,
)
TAG_RE = re.compile(r"<[^>]+>")


# --------------------------------------------------------------------------
# Helpers de donnees
# --------------------------------------------------------------------------
def strip_html(valeur):
    if not valeur:
        return ""
    texte = TAG_RE.sub(" ", str(valeur))
    texte = html.unescape(texte)
    return re.sub(r"\s+", " ", texte).strip()


def m2o(champ):
    """Many2one renvoye par le MCP : dict {id,name}, ou false/None."""
    if not champ:
        return None
    if isinstance(champ, dict):
        return {"id": champ.get("id"), "name": champ.get("name")}
    if isinstance(champ, bool):
        return None
    if isinstance(champ, int):
        return {"id": champ, "name": None}
    if isinstance(champ, (list, tuple)) and len(champ) >= 2:
        return {"id": champ[0], "name": champ[1]}
    return None


def m2m_ids(champ):
    """Many2many renvoye par le MCP : liste d'IDs bruts (et non d'objets)."""
    sortie = []
    for item in champ or []:
        if isinstance(item, bool):
            continue
        if isinstance(item, int):
            sortie.append(item)
        elif isinstance(item, dict) and item.get("id") is not None:
            sortie.append(item["id"])
        elif isinstance(item, (list, tuple)) and item:
            sortie.append(item[0])
    return sortie


def fetch_label_map(modele, champs=("id", "name")):
    """Table id -> libelle pour un modele expose en lecture par le MCP."""
    table = {}
    offset = 0
    while True:
        reponse = odoo_mcp.call("search_records", {
            "model": modele, "fields": list(champs), "limit": PAGE, "offset": offset,
        })
        lot = odoo_mcp.records(reponse)
        if not lot:
            break
        for rec in lot:
            rid = rec.get("id")
            if rid is not None:
                table[rid] = rec.get("name") or f"#{rid}"
        if len(lot) < PAGE:
            break
        offset += PAGE
    return table


def fetch_all():
    taches = []
    offset = 0
    while True:
        reponse = odoo_mcp.call("search_records", {
            "model": "project.task",
            "domain": [["project_id", "=", PROJECT_ID]],
            "fields": FIELDS,
            "limit": PAGE,
            "offset": offset,
        })
        lot = odoo_mcp.records(reponse)
        if not lot:
            if not taches and offset == 0:
                raise RuntimeError("Odoo injoignable via le connecteur MCP")
            break
        taches.extend(lot)
        if len(lot) < PAGE:
            break
        offset += PAGE
    return taches


def normaliser(brut, users, tags):
    stage = m2o(brut.get("stage_id"))
    stage_id = stage["id"] if stage else None
    stage_key = STAGE_KEYS.get(stage_id, "inconnu")
    description = strip_html(brut.get("description"))
    cu = CU_RE.search(f"{brut.get('name', '')} {description}")
    gh = GH_RE.search(f"{brut.get('name', '')} {description}")
    echeance = brut.get("date_deadline") or ""
    priorite = str(brut.get("priority") if brut.get("priority") is not None else "0")
    parent = m2o(brut.get("parent_id"))
    return {
        "id": brut["id"],
        "ref": f"odoo:{brut['id']}",
        "name": (brut.get("name") or "").strip(),
        "stage_id": stage_id,
        "stage_key": stage_key,
        "is_terminal": stage_key in TERMINAL_KEYS,
        "deadline": echeance[:10] if echeance else None,
        "priority": "0" if priorite == "0" else (
            "1" if priorite == "1" else ("2" if priorite == "2" else "3")),
        "assignees": [users[i] for i in m2m_ids(brut.get("user_ids")) if i in users],
        "tags": [tags[i] for i in m2m_ids(brut.get("tag_ids")) if i in tags],
        "parent_id": parent["id"] if parent else None,
        "clickup_ref": cu.group(1) if cu else None,
        "github_ref": int(gh.group(1)) if gh else None,
        "is_recurring": bool(RECUR_RE.search(f"{brut.get('name', '')} {description}")),
        "active": bool(brut.get("active", True)),
        "description_excerpt": description[:280],
    }


def construire_payload(taches, users, tags):
    normalisees = [normaliser(t, users, tags) for t in taches]
    normalisees.sort(key=lambda t: (t["deadline"] is None, t["deadline"] or "", t["id"]))

    par_stage = {}
    for t in normalisees:
        par_stage[t["stage_key"]] = par_stage.get(t["stage_key"], 0) + 1

    maintenant = datetime.now(timezone.utc)
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": maintenant.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "snapshot_date": datetime.now().strftime("%Y-%m-%d"),
        "generator": "core/scripts/operations/export_operations_tasks.py",
        "source": {
            "system": "odoo",
            "db": "erpenswork",
            "project_id": PROJECT_ID,
            "project_name": "Enswork - Gestion des taches",
            "transport": "mcp-readonly",
        },
        "stage_map": STAGE_KEYS,
        "counts": {
            "total": len(normalisees),
            "by_stage": par_stage,
            "with_assignee": len([t for t in normalisees if t["assignees"]]),
            "with_tag": len([t for t in normalisees if t["tags"]]),
            "with_deadline": len([t for t in normalisees if t["deadline"]]),
        },
        "labels": {"users": users, "tags": tags},
        "tasks": normalisees,
    }


# --------------------------------------------------------------------------
# Coherence : on ne remplace jamais un fichier fiable par un fichier douteux
# --------------------------------------------------------------------------
def controler_coherence(payload, attendu_minimum=1):
    """Retourne la liste des problemes ([] = payload exploitable)."""
    problemes = []
    if not isinstance(payload, dict):
        return ["le payload n'est pas un objet"]

    version = payload.get("schema_version")
    if version != SCHEMA_VERSION:
        problemes.append(f"schema_version {version!r} != {SCHEMA_VERSION}")

    taches = payload.get("tasks")
    if not isinstance(taches, list):
        return problemes + ["'tasks' n'est pas une liste"]
    if len(taches) < attendu_minimum:
        problemes.append(f"{len(taches)} tache(s), minimum attendu {attendu_minimum}")

    comptes = payload.get("counts") or {}
    if comptes.get("total") != len(taches):
        problemes.append(
            f"counts.total={comptes.get('total')!r} != len(tasks)={len(taches)}")

    par_stage = comptes.get("by_stage") or {}
    somme = sum(par_stage.values())
    if par_stage and somme != len(taches):
        problemes.append(f"somme by_stage={somme} != len(tasks)={len(taches)}")

    for t in taches[:50]:  # on echantillonne : le but est de verifier l'integrite
        if not isinstance(t, dict):
            problemes.append("une tache n'est pas un objet")
            break
        manquants = [k for k in ("id", "ref", "name", "stage_key") if not t.get(k)]
        if manquants:
            problemes.append(f"tache {t.get('id')!r} sans champ(s) {manquants}")
            break

    for section in ("users", "tags"):
        if not isinstance((payload.get("labels") or {}).get(section), dict):
            problemes.append(f"labels.{section} n'est pas un objet")

    return problemes


def ecrire_atome(chemin, texte):
    """Ecrit puis remplace : le lecteur voit soit l'ancien, soit le nouveau."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    temporaire = chemin.with_name(chemin.name + ".tmp")
    temporaire.write_text(texte, encoding="utf-8")
    os.replace(temporaire, chemin)
    return chemin


def serialiser(payload):
    return json.dumps(payload, ensure_ascii=False, indent=2)


# --------------------------------------------------------------------------
# Historique et purge
# --------------------------------------------------------------------------
def archiver(payload, dossier, forcer=False):
    """Ecrit l'instantane du jour. Idempotent : ne reecrit pas dans la journee."""
    dossier.mkdir(parents=True, exist_ok=True)
    cible = dossier / f"{payload['snapshot_date']}.json"
    if cible.exists() and not forcer:
        return cible, False
    ecrire_atome(cible, serialiser(payload))
    return cible, True


def purger(dossier, retention_jours, aujourdhui=None):
    """Supprime les instantanes de plus de `retention_jours` et les .tmp orphelins.

    Seuls les noms `YYYY-MM-DD.json` sont considers, pour ne jamais supprimer un
    fichier etranger dans le dossier.
    """
    if not dossier.exists():
        return [], []
    aujourdhui = aujourdhui or datetime.now()
    limite = aujourdhui - timedelta(days=retention_jours)
    supprimes, erreurs = [], []
    for entree in dossier.iterdir():
        if not entree.is_file():
            continue
        if entree.suffix == ".tmp":
            try:
                entree.unlink()
                supprimes.append(entree.name)
            except OSError as exc:
                erreurs.append(f"{entree.name} : {exc}")
            continue
        if entree.suffix != ".json":
            continue
        try:
            jour = datetime.strptime(entree.stem, "%Y-%m-%d")
        except ValueError:
            continue
        if jour < limite:
            try:
                entree.unlink()
                supprimes.append(entree.name)
            except OSError as exc:
                erreurs.append(f"{entree.name} : {exc}")
    return supprimes, erreurs


# --------------------------------------------------------------------------
# Selection hors reseau : prouve la logique sans Odoo ni cle
# --------------------------------------------------------------------------
def charge_de_test():
    """Taches factices mais realistes : etats, assignes, tags, recurrence."""
    return [
        {"id": 8, "name": " preparations mensuelles [CU:123]", "stage_id": 9,
         "date_deadline": "2026-10-15T00:00:00", "priority": "1", "user_ids": [2],
         "parent_id": False, "tag_ids": [5], "active": True, "project_id": 1,
         "description": "<p>Recurring</p>"},
        {"id": 9, "name": "Attente client", "stage_id": 11, "date_deadline": False,
         "priority": "0", "user_ids": [], "parent_id": False, "tag_ids": [],
         "active": True, "project_id": 1, "description": ""},
        {"id": 10, "name": "Termine [GH:42]", "stage_id": 20, "date_deadline": False,
         "priority": "2", "user_ids": [2], "parent_id": False, "tag_ids": [],
         "active": True, "project_id": 1, "description": ""},
    ]


def selectionner():
    """Mode selftest : valide toute la chaine hors reseau."""
    brut = charge_de_test()
    users = {2: "Administrateur"}
    tags = {5: "Comptable"}
    payload = construire_payload(brut, users, tags)

    problemes = controler_coherence(payload, attendu_minimum=1)
    print(f"selftest coherence      : {'OK' if not problemes else problemes}")

    # is_terminal doit valoir vrai pour un etage acheve (fait memoire).
    achevee = next(t for t in payload["tasks"] if t["id"] == 10)
    print(f"selftest is_terminal    : {'OK' if achevee['is_terminal'] else 'ECHEC'}")

    # Terminalite explicite de l'etage inconnu.
    inconnu = normaliser({"id": 99, "name": "x", "stage_id": 999, "active": True},
                         users, tags)
    print(f"selftest etage inconnu  : {inconnu['stage_key']!r} (attendu 'inconnu')")

    # Un payload tronque doit etre rejete, sinon on ecrirait n'importe quoi.
    casse = dict(payload)
    casse["counts"] = dict(payload["counts"], total=999)
    rejet = controler_coherence(casse, attendu_minimum=1)
    print(f"selftest rejet troncature: {'OK' if rejet else 'ECHEC'}")

    vide = controler_coherence(construire_payload([], {}, {}), attendu_minimum=1)
    print(f"selftest rejet vide      : {'OK' if vide else 'ECHEC'}")

    # Atomicite et purge, sur un dossier temporaire. L'historique a son propre
    # sous-dossier : la purge ne doit considers que les instantanes dates, et le
    # test doit refleter l'emplacement reel (.data/history).
    import shutil
    import tempfile
    racine = Path(tempfile.mkdtemp(prefix="operations-selftest-"))
    try:
        dossier = racine / "history"
        dossier.mkdir()
        # Dates relatives a aujourd'hui : une date en dur finirait par tomber
        # hors fenetre de retention et ferait echouer le test pour rien.
        jour_purge = (datetime.now() - timedelta(days=RETENTION_DEFAUT + 30)).strftime("%Y-%m-%d")
        jour_recent = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        jour_du_jour = datetime.now().strftime("%Y-%m-%d")
        for jour in (jour_purge, jour_recent, jour_du_jour):
            (dossier / f"{jour}.json").write_text("{}", encoding="utf-8")
        (dossier / f"{jour_purge}.json.tmp").write_text("{}", encoding="utf-8")
        (dossier / "pas-une-date.json").write_text("{}", encoding="utf-8")

        proj = racine / "operations-tasks.json"
        ecrire_atome(proj, serialiser(payload))
        relu = json.loads(proj.read_text(encoding="utf-8"))
        # On compare a la reference relue elle aussi du JSON : cela teste que
        # l'ecriture atomique ne perd rien, sans se belliguer avec le fait que
        # JSON transforme les cles d'entiers en chaines (stage_map).
        attendu_json = json.loads(serialiser(payload))
        reste_tmp = proj.with_name(proj.name + ".tmp").exists()
        print(f"selftest ecriture atomique: "
              f"{'OK' if relu == attendu_json and not reste_tmp else 'ECHEC'}")

        supprimes, erreurs = purger(dossier, RETENTION_DEFAUT)
        reste = sorted(p.name for p in dossier.iterdir())
        attendu_fichiers = sorted([f"{jour_recent}.json", "pas-une-date.json",
                                   f"{jour_du_jour}.json"])
        print(f"selftest purge 90j       : "
              f"{'OK' if reste == attendu_fichiers else 'ECHEC ' + str(reste)}")
        print(f"selftest .tmp orphelin   : "
              f"{'OK' if f'{jour_purge}.json.tmp' not in reste else 'ECHEC'}")
        print(f"selftest fichier etranger preserve: "
              f"{'OK' if 'pas-une-date.json' in reste else 'ECHEC'}")
        # Idempotence de l'archive : dans un dossier vide, le premier appel
        # ecrit, le second ne doit rien faire.
        isole = racine / "archive-idem"
        isole.mkdir()
        _, ecrit = archiver(payload, isole)
        _, ecrit2 = archiver(payload, isole)
        print(f"selftest historique du jour ecrit une seule fois: "
              f"{'OK' if ecrit and not ecrit2 else 'ECHEC'}")
        if erreurs:
            print(f"selftest erreurs purge   : {erreurs}")
    finally:
        shutil.rmtree(racine, ignore_errors=True)

    print("selftest termine")
    return 0


# --------------------------------------------------------------------------
def main():
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--out", default=str(CHEMIN_DEFAUT))
    analyseur.add_argument("--history-dir", default=str(HISTORIQUE_DEFAUT))
    analyseur.add_argument("--retention-days", type=int, default=RETENTION_DEFAUT)
    analyseur.add_argument("--env-file", default=str(ICI / ".env"))
    analyseur.add_argument("--force-history", action="store_true",
                           help="reecrit l'instantane du jour meme s'il existe")
    analyseur.add_argument("--dry-run", action="store_true",
                           help="interroge Odoo et controle, sans ecrire")
    analyseur.add_argument("--selftest", action="store_true",
                           help="valide la logique hors reseau, sans Odoo ni cle")
    args = analyseur.parse_args()

    if args.selftest:
        return selectionner()

    try:
        brut = fetch_all()
    except odoo_mcp.McpError as exc:
        odoo_mcp.log(f"ABANDON : {exc}")
        return 2
    except RuntimeError as exc:
        odoo_mcp.log(f"ABANDON : {exc}")
        return 2

    if not brut:
        odoo_mcp.log("ABANDON : Odoo a repondu sans aucune tache")
        return 2

    users = fetch_label_map("res.users")
    tags = fetch_label_map("project.tags")
    payload = construire_payload(brut, users, tags)

    problemes = controler_coherence(payload, attendu_minimum=1)
    if problemes:
        odoo_mcp.log("ABANDON : controle de coherence en echec, projection conservee")
        for probleme in problemes:
            odoo_mcp.log(f"  - {probleme}")
        return 3

    if args.dry_run:
        print(f"dry-run OK : {payload['counts']['total']} taches, "
              f"generee_at {payload['generated_at']}")
        return 0

    ecrire_atome(Path(args.out), serialiser(payload))

    dossier = Path(args.history_dir)
    try:
        _, ecrit = archiver(payload, dossier, forcer=args.force_history)
        supprimes, erreurs = purger(dossier, args.retention_days)
    except OSError as exc:
        odoo_mcp.log(f"AVERTISSEMENT historique indisponible : {exc}")
        return 4

    if erreurs:
        odoo_mcp.log(f"AVERTISSEMENT purge partielle : {erreurs}")

    par_stage = payload["counts"]["by_stage"]
    print(f"OK {payload['counts']['total']} taches -> {args.out}")
    print(f"generee_at {payload['generated_at']} | par etage : "
          f"{json.dumps(par_stage, ensure_ascii=False)}")
    print(f"historique {'ecrit' if ecrit else 'deja a jour'} ({payload['snapshot_date']})"
          f" | purges : {len(supprimes)} | retention : {args.retention_days} j")
    return 0


if __name__ == "__main__":
    sys.exit(main())
