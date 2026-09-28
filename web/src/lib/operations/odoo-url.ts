// URL d ouverture d une tache dans l interface web d Odoo.
//
// La base et la forme de l URL sont verifiees, pas devinees : sur l instance
// `erpenswork`, un sondage HTTP a repondu 200 sur /web/login et 303 vers
// /web/login sur /odoo/... . Le client web est donc monte sur /web, ce qui
// identifie un Odoo 16 ou anterieur (a partir de 17 le client est sur /odoo).
// L action retenue est `base.action_open_form`, l action generique d ouverture
// d un formulaire : elle evite de dependre du xml_id d une action metier qui
// change d une version a l autre.
//
// Ce module n importe rien du serveur : il est appele depuis des composants
// client, ou embarquer la source Odoo (qui lit process.env) casserait le bundle.

export const ODOO_TASK_ACTION = 'base.action_open_form'
// Meme valeur que ODOO_TASK_MODEL dans odoo-source.ts. Elle est repetee ici
// volontairement : ce module doit rester sans import serveur.
export const ODOO_TASK_MODEL = 'project.task'

const BASE_PAR_DEFAUT = 'http://192.168.11.50'

function baseWeb(): string {
  const configuree = (process.env.NEXT_PUBLIC_ODOO_WEB_URL ?? '').trim()
  const choisie = configuree.length > 0 ? configuree : BASE_PAR_DEFAUT
  return choisie.replace(/\/+$/, '')
}

/**
 * URL de la forme de la tache. Renvoie null si l identifiant n est pas un
 * entier positif : un rendu ne doit pas lever sur une donnee atypique.
 */
export function odooTaskUrl(id: number): string | null {
  if (!Number.isInteger(id) || id <= 0) return null
  const params = new URLSearchParams({
    action: ODOO_TASK_ACTION,
    model: ODOO_TASK_MODEL,
    view_type: 'form',
    id: String(id),
  })
  return `${baseWeb()}/web#${params.toString()}`
}
