from odoo import models, fields, api, _

class ProductProductInherit(models.Model):
    _inherit = "product.product"

    #Override the _name_search methode to allow searching on Many2one field by Name, Code d'article, rEFERENCE iNTERNE
    @api.model
    def _name_search(self, name='', args=None, operator='ilike', limit=100, name_get_uid=None):
        if args is None:
            args = []
        domain = args + ['|', '|', ('name', operator, name), ('default_code', operator, name), ('ref_article', operator, name)]
        return self._search(domain, limit=limit, access_rights_uid=name_get_uid)


