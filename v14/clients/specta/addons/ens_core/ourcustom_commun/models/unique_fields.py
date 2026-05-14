from odoo import api, fields, models, _
from odoo.exceptions import ValidationError, RedirectWarning, UserError


        ######################## CONTACT: Convert ICE/VAT to Unique Field #############################################

class Partner(models.Model):
    _inherit = "res.partner"

    @api.constrains('vat')
    def _check_if_vat_exist(self):
        for record in self:
            if (record.vat):
                new_value = record.vat
                if (self.is_company == True):
                    existing_records = self.env['res.partner'].sudo().search([['vat', '=', new_value],['is_company', '=', 'True']])
                    if len(existing_records) > 1:
                        raise ValidationError(
                            _('L\'ICE Doit Etre Unique !. Une Société avec l\'ICE " %s " Existe Déja.')
                            % (
                                record.vat,
                            )
                        )

        return True



        ######################## ARTICLE : Convert Internal Reference AND Reference  Fournisseur to Unique Field #################################

class ProductTemplate(models.Model):
    _inherit = "product.template"
                        #------------------------ Same Internal Reference Diff Category------------------

    same_ref_diff_categ = fields.Boolean('Same Ref Interne', compute='_compute_set_bool',
                                         help="Champs = True quand il existe un aticle avec le meme Reference Interne mais Categorie Differente")

    @api.depends('default_code', 'categ_id')
    def _compute_set_bool(self):
        for record in self:
            same_ref_diff_categ = False;
            if (record.default_code):
                new_value = record.default_code
                new_category = record.categ_id.name
                existing_records_diff_categ = self.env['product.template'].search([('default_code', '=', new_value), ('categ_id.name', '!=', new_category)])
                if len(existing_records_diff_categ) >= 1:
                    same_ref_diff_categ = True;
        record.update({
            'same_ref_diff_categ': same_ref_diff_categ
        })

                        # ------------------------ Same Internal Reference Same Category------------------
    @api.constrains('default_code','reference_fournisseur')
    def _check_default_code(self):
        for record in self:
            if (record.default_code):
                new_value = record.default_code
                new_category = record.categ_id.name

                existing_records_same_categ = self.env['product.template'].search([['default_code', '=', new_value], ['categ_id.name', '=', new_category]])
                if len(existing_records_same_categ) > 1:
                    if (record.reference_fournisseur):
                        new_ref_frs = record.reference_fournisseur

                        existing_records_same_categ_same_frs = self.env['product.template'].search([('default_code', '=', new_value), ('categ_id.name', '=', new_category),('reference_fournisseur', '=', new_ref_frs)])
                        if len(existing_records_same_categ_same_frs) > 1:
                            raise ValidationError(
                                _('LA Référence Interne Doit Etre Unique !. La Référence " %s " Existe Déja dans la même Catégorie, avec le même Référence Fournisseur %s.')
                                % (
                                    new_value,
                                    new_ref_frs,
                                )
                            )

                        else:
                            raise ValidationError(
                                _('LA Référence Interne Doit Etre Unique !. La Référence " %s " Existe Déja dans la même Catégorie.')
                                % (
                                    new_value,
                                )
                            )
                    else:
                        raise ValidationError(
                            _('LA Référence Interne Doit Etre Unique !. La Référence " %s " Existe Déja dans la même Catégorie.')
                            % (
                                new_value,
                            )
                        )
        return True
