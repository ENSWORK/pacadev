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
# core/scripts/operations -> on remonte de 3 crans pour arriver a la racine du
# depot. Avec 2 crans on atterrissait sur core/, et la projection partait dans
# core/web/.data : invisible, et le cockpit continuait de lire l'ancien
# fichier. D'ou le garde-fou `resoudre_racine()` plus bas.
RACINE = ICI.parent.parent.parent

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
# Plafond de l'outil aggregate_records : au-dela, il tronque les groupes.
PLAFOND_GROUPES = 100

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


def compter(modele, domaine, groupby):
    """Nombre d'enregistrements, par aggregate_records.

    Temoin d'exhaustivite, independant de la pagination : c'est la seule facon
    de distinguer « la liste est finie » de « la reponse s'est interrompue ».
    Le `groupby` doit etre un champ de TRI, pas un champ de FILTRE : `active`
    n'existe pas sur project.tags, alors que `id` existe partout.
    """
    reponse = odoo_mcp.call_obligatoire("aggregate_records", {
        "model": modele,
        "domain": list(domaine),
        "groupby": [groupby],
        "aggregates": ["__count"],
        "limit": PLAFOND_GROUPES,
    })
    groupes = odoo_mcp.groups(reponse)
    if len(groupes) >= PLAFOND_GROUPES:
        # Au plafond, l'outil a tronque : le total devient une borne basse, et
        # un temoin qui ne tire que vers le bas ne prouve plus rien.
        raise RuntimeError(
            f"{modele} : plus de {PLAFOND_GROUPES} groupes pour {groupby}, "
            "temoin d'exhaustivite inutilisable - choisir un groupby plus court")
    total = 0
    for groupe in groupes:
        valeur = groupe.get("__count")
        if isinstance(valeur, int):
            total += valeur
    return total


def controler_doublons(lignes):
    """Identifiants vues deux fois. Causés par un offset qui derive parce que
    la liste a bouge pendant la lecture. Renvoie les premiers trouves."""
    vus, doublons = set(), []
    for ligne in lignes:
        rid = ligne.get("id") if isinstance(ligne, dict) else None
        if rid is None:
            continue
        if rid in vus and rid not in doublons:
            doublons.append(rid)
        vus.add(rid)
    return doublons


def lire_page(modele, domaine, champs, offset, page):
    """Une page. Un transport en echec leve au lieu de rendre une liste vide."""
    reponse = odoo_mcp.call_obligatoire("search_records", {
        "model": modele,
        "domain": list(domaine),
        "fields": list(champs),
        "limit": page,
        "offset": offset,
    })
    return odoo_mcp.records(reponse)


def paginer(lire, modele, domaine, champs, temoin=None, tolere_court=False,
            page=PAGE):
    """Parcourt par offset et refuse de rendre une liste possiblement tronquee.

    `temoin` est le total attendu, obtenu par aggregate_records. Si la lecture
    s'arrete avant lui, c'est une panne : on leve plutot que d'ecrire une
    projection partielle - qui passerait les controles de coherence, puisque
    ceux-la verifient la coherence interne, pas l'exhaustivite.

    `tolere_court` reserve ce traitement aux tables de libelles, ou un droit
    d'acces legitime peut legitimement limiter la lecture. On y prefere alors
    une degradation **visible** (journal + compteurs) a une degradation
    silencieuse, qui ferait passer des taches assignees pour non assignees.
    """
    lignes = []
    offset = 0
    while True:
        lot = lire(modele, domaine, champs, offset, page)
        if not lot:
            if offset == 0:
                raise RuntimeError(f"{modele} : Odoo n'a renvoye aucun enregistrement")
            # Un total multiple de la page se termine par une page vide : c'est
            # la fin, pas une panne. Le temoin est ce qui permet de trancher -
            # sans lui, les deux cas sont indiscernables.
            if temoin is not None and offset >= temoin:
                break
            raise RuntimeError(
                f"{modele} : page vide a l'offset {offset} apres {len(lignes)} ligne(s) "
                f"pour {temoin} attendues - reponse interrompue, ecriture refusee")
        lignes.extend(lot)
        if len(lot) < page:
            break
        offset += page

    if temoin is not None and len(lignes) < temoin:
        message = (f"{modele} : {len(lignes)} ligne(s) lues pour {temoin} attendues "
                   "- reponse partielle")
        if not tolere_court:
            raise RuntimeError(message + ", ecriture refusee")
        odoo_mcp.log(f"AVERTISSEMENT {message} (degradation signalee, non bloquante)")

    doublons = controler_doublons(lignes)
    if doublons:
        raise RuntimeError(
            f"{modele} : identifiants en double {doublons[:5]} - la liste a bouge "
            "pendant la lecture, ecriture refusee")
    return lignes


def fetch_label_map(modele, champs=("id", "name")):
    """Table id -> libelle pour un modele expose en lecture par le MCP.

    Le temoin est demande mais jamais rendu bloquant : un droit d'acces
    legitime peut limiter la lecture, et perdre le job pour ca serait pire que
    la degradation. L'ecart est annonce, et c'est `unresolved_assignee` qui dit
    reellement combien de taches en ont subi les consequences.
    """
    return {rec["id"]: (rec.get("name") or f"#{rec['id']}")
            for rec in paginer(lire_page, modele, [], champs,
                               temoin=compter(modele, [], "id"),
                               tolere_court=True)}


def compter_inconnus(brut_liste, table, champ):
    """Identifiants references par une tache mais absents de la table.

    Un utilisateur archive reste referencable par `user_ids` alors qu'il
    n'apparait plus dans `res.users` : la tache paraissait alors non assignee.
    Ce n'est pas bloquant - archiver quelqu'un est normal - mais ca doit se voir.
    """
    inconnus = set()
    for tache in brut_liste:
        for rid in m2m_ids(tache.get(champ)):
            if rid not in table:
                inconnus.add(rid)
    return sorted(inconnus)


def fetch_all():
    domaine = [["project_id", "=", PROJECT_ID]]
    return paginer(lire_page, "project.task", domaine, FIELDS,
                   temoin=compter("project.task", domaine, "project_id"))



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

    inconnus_users = compter_inconnus(taches, users, "user_ids")
    inconnus_tags = compter_inconnus(taches, tags, "tag_ids")

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
            "unresolved_assignee": len(inconnus_users),
            "unresolved_tag": len(inconnus_tags),
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


def resoudre_racine(racine=None):
    """Verifie que la racine est bien celle du depot, et la retourne.

    Ecrit dans un mauvais repertoire le pire qui puisse arriver a un job
    automatique : la projection part dans un coin que personne ne lit, et
    l'ancien fichier reste servi sans que rien ne le signale. On refuse donc de
    demarrer si `web/` n'est pas a cet endroit-la.
    """
    racine = Path(racine) if racine else RACINE
    if not (racine / "web").is_dir():
        raise RuntimeError(
            f"racine de depot incorrecte : {racine} ne contient pas de repertoire "
            "'web'. Le job refuse d'ecrire plutot que d'ecrire au mauvais endroit."
        )
    return racine


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

    # Pagination : le cas qui ecrivait 100 taches sur 232 sans rien dire.
    def faux_complet(modele, domaine, champs, offset, page):
        # 20 lignes par pages de 10 : la derniere page est vide, et c'est legal.
        if offset >= 20:
            return []
        return [{"id": offset + i, "name": f"t{offset + i}"} for i in range(page)]

    def faux_tronque(modele, domaine, champs, offset, page):
        # page pleine, puis silence : c'est la panne reseau, pas la fin.
        if offset == 0:
            return faux_complet(modele, domaine, champs, offset, page)
        return []

    def faux_doublon(modele, domaine, champs, offset, page):
        # Toute page pleine porte le meme id : derive d'offset. Borne comme les
        # autres, sinon la pagination ne s'arrete jamais.
        if offset >= 20:
            return []
        return [{"id": 1, "name": "t1"} for _ in range(page)]

    def faux_court(modele, domaine, champs, offset, page):
        return [{"id": offset + i, "name": f"t{offset + i}"} for i in range(7)]

    def tente(lire, **kwargs):
        try:
            paginer(lire, "project.task", [], ["id"], page=10, **kwargs)
            return "AUCUNE ERREUR"
        except RuntimeError as exc:
            return str(exc)

    cas = [
        ("pagination complete", tente(faux_complet, temoin=20), None),
        ("pagination rompue   ", tente(faux_tronque, temoin=20), "reponse interrompue"),
        ("pagination courte   ", tente(faux_court, temoin=20), "reponse partielle"),
        ("identifiants double ", tente(faux_doublon, temoin=20), "en double"),
        ("total multiple page ", tente(faux_complet, temoin=20), None),
        ("libelles tolerants ", tente(faux_court, temoin=20, tolere_court=True), None),
    ]
    for nom, resultat, attendu in cas:
        if attendu is None:
            print(f"selftest {nom}: {'OK' if 'reponse' not in resultat else 'ECHEC ' + resultat}")
        else:
            print(f"selftest {nom}: {'OK' if attendu in resultat else 'ECHEC ' + resultat}")

    # Le temoin d'exhaustivite se lit dans la forme reelle de la reponse MCP.
    reponse_agregat = {"result": {"structuredContent": {"groups": [
        {"project_id": [1, "Enswork"], "__count": 232}]}}}
    total = 0
    for groupe in odoo_mcp.groups(reponse_agregat):
        total += groupe.get("__count", 0)
    print(f"selftest temoin agregat: {'OK' if total == 232 else 'ECHEC ' + str(total)}")
    print(f"selftest groupes vide  : "
          f"{'OK' if odoo_mcp.groups(None) == [] and odoo_mcp.groups({}) == [] else 'ECHEC'}")

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

    # Garde-fou de destination : mieux vaut un echec franc qu'une projection
    # ecrite dans un repertoire que le cockpit ne lit pas.
    try:
        resoudre_racine()
    except RuntimeError as exc:
        odoo_mcp.log(f"ABANDON : {exc}")
        return 2

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

    try:
        users = fetch_label_map("res.users")
        tags = fetch_label_map("project.tags")
    except (odoo_mcp.McpError, RuntimeError) as exc:
        odoo_mcp.log(f"ABANDON : table de libelles illisible ({exc})")
        return 2
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

    for champ, cle in (("unresolved_assignee", "utilisateurs"),
                       ("unresolved_tag", "etiquettes")):
        nombre = payload["counts"][champ]
        if nombre:
            odoo_mcp.log(
                f"AVERTISSEMENT {nombre} identifiant(s) {cle} non resolu(s) : des "
                "taches peuvent paraitre non assignees ou sans etiquette. Cause "
                "probable : un utilisateur archive encore reference par user_ids.")

    par_stage = payload["counts"]["by_stage"]
    print(f"OK {payload['counts']['total']} taches -> {args.out}")
    print(f"generee_at {payload['generated_at']} | par etage : "
          f"{json.dumps(par_stage, ensure_ascii=False)}")
    print(f"historique {'ecrit' if ecrit else 'deja a jour'} ({payload['snapshot_date']})"
          f" | purges : {len(supprimes)} | retention : {args.retention_days} j")
    return 0


if __name__ == "__main__":
    sys.exit(main())
