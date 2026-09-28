import type { OperationTask } from './types'

/** Minuscules sans diacritiques : « declaration » doit trouver « Déclaration ». */
function sansAccents(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Ce sur quoi une recherche porte : la designation et la reference, en priorite. */
function cible(task: OperationTask): string {
  return sansAccents(
    [task.name, task.ref, task.clickup_id ?? '', task.github_issue === null ? '' : String(task.github_issue)].join(' '),
  )
}

/**
 * Recherche de l onglet Taches.
 *
 * La designation et la reference repondent toutes les deux : l une est le texte
 * que l utilisateur a sous les yeux, l autre ce qu il recopie depuis un autre
 * outil. Les mots sont cumules (ET) plutot queollus : « visite informatique »
 * ramene les visites, pas tout ce qui contient « visite ».
 */
export function matchesTaskSearch(task: OperationTask, needle: string): boolean {
  const mots = sansAccents(needle).split(/\s+/).filter((m) => m.length > 0)
  if (mots.length === 0) return true
  const cibleTexte = cible(task)
  return mots.every((mot) => cibleTexte.includes(mot))
}
