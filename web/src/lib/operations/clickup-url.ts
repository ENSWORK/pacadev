// URL d'ouverture d'une tâche dans l'application web de ClickUp.
//
// La forme de l'URL n'est pas devinée : elle est celle que renvoie l'API
// ClickUp elle-même dans le champ `url` de la réponse « Get Task »
// (exemple documenté : https://app.clickup.com/t/86d2m1awy). Le format est
// stable, il ne dépend ni de l'espace ni de la liste, donc un seul suffixe
// suffit et aucune donnée de projection n'est nécessaire.
//
// Attention à la longueur des identifiants : les identifiants ClickUp
// documentés vont de 3 caractères (9hz, 9hx, 9hv) à 9 (86d2m1awy). La
// longueur n'est donc PAS un critère de validité, et la projection en contient
// deux formes (`86cb247dd` et `12472jzck7y`). Filtrer sur la longueur
// supprimerait des liens valides : on ne filtre que sur l'alphabetique, qui est
// la seule contrainte connue, en s'appuyant sur la même classe de caractères
// que celle utilisée à l'extraction de `[CU:<id>]`.
//
// La base est une constante et non une variable d'environnement : ClickUp est
// un service public unique, là où Odoo est auto-hébergé. Il n'y a rien à
// surcharger.

export const CLICKUP_BASE = 'https://app.clickup.com'

/** Même classe de caractères que le motif d'extraction `\[CU:([0-9A-Za-z]+)\]`. */
const ID_ALPHABETIQUE = /^[0-9A-Za-z]+$/

/**
 * URL de la tâche ClickUp. Renvoie null si aucun identifiant n'est connu ou
 * s'il contient autre chose que de l'alphabétique : un rendu ne doit pas
 * fabriquer un lien vers une adresse inattendue à partir d'une donnée sale.
 */
export function clickupTaskUrl(id: string | null | undefined): string | null {
  const identifiant = (id ?? '').trim()
  if (identifiant.length === 0) return null
  if (!ID_ALPHABETIQUE.test(identifiant)) return null
  return `${CLICKUP_BASE}/t/${identifiant}`
}
