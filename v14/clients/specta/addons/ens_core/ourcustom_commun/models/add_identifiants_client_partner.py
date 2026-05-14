from odoo import models, fields, api, _


class ResPartner(models.Model):
    _inherit = "res.partner"

    identifiant_rc = fields.Char("RC")
    identifiant_if = fields.Char("IF")
    identifiant_patente = fields.Char("PATENTE")

    # Override Partner Reference and Make it AUTO INCREMENT Just for SOCITIES
    ref = fields.Char(string='Reference', index=True, default=lambda self: _('000000'))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('ref', _('000000')) == _('000000'):
                if vals.get('is_company'):
                    vals['ref'] = self.env['ir.sequence'].next_by_code('ourcustomcommun.ref.auto.incr') or _('000000')
        result = super(ResPartner, self).create(vals_list) #super(nom de classe)
        return result

    #Chmaps Siège Quand la societe est un siege l'ICE est obligatoire
    siege = fields.Boolean(string="Siège", default=True)







