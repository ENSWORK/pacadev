# -*- coding: utf-8 -*-
# from odoo import http


# class EnsworkConfigCenter(http.Controller):
#     @http.route('/enswork_config_center/enswork_config_center/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/enswork_config_center/enswork_config_center/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('enswork_config_center.listing', {
#             'root': '/enswork_config_center/enswork_config_center',
#             'objects': http.request.env['enswork_config_center.enswork_config_center'].search([]),
#         })

#     @http.route('/enswork_config_center/enswork_config_center/objects/<model("enswork_config_center.enswork_config_center"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('enswork_config_center.object', {
#             'object': obj
#         })
