from odoo import http
from odoo.http import request
from datetime import datetime, timedelta
import requests
import json

def getting_ip(row):
    """This function calls the api and return the response"""
    url = f"https://freegeoip.app/json/{row}"       # getting records from getting ip address
    headers = {
        'accept': "application/json",
        'content-type': "application/json"
        }
    response = requests.request("GET", url, headers=headers)
    respond = json.loads(response.text)
    return respond

class Controller(http.Controller):

    @http.route('/post/action_data', type='json', auth='public')
    def _get_action_data(self, data='', ip=''):
        try:
            original_url = data
            activity_log_obj = request.env['activity.log'].sudo()
            menu_obj = request.env['ir.ui.menu'].sudo()
            config_parameter_obj = request.env['ir.config_parameter'].sudo()
            login_log = request.env['login.log'].sudo().search([('session_id','=',request.session.sid)],limit=1)
            if not login_log.ip and ip:
                login_log.ip = ip
                try:
                    value = getting_ip(ip)
                    country = value['country_name'] or ''
                    city = value['city'] or ''
                    state = value['region_name'] or ''
                except:
                    country = ''
                    state = ''
                    city = ''
                login_log.write({
                    'ip':ip,
                    'country':country,
                    'loc_state':state,
                    'city':city
                })
            url = config_parameter_obj.get_param('web.base.url')
            active_timeout = config_parameter_obj.get_param('advanced_session_management.session_timeout_active') or 'none'
            if active_timeout == 'active':
                interval_number = int(config_parameter_obj.get_param('advanced_session_management.session_timeout_interval_number'))
                if interval_number > 0:
                    login_log.timeout_date = datetime.now() + timedelta(hours=interval_number)
            
            if url:
                data = data.replace(url, '')
            data = data.replace('/web?debug=assets#', '')
            data = data.replace('/web?debug=1#', '')
            data = data.replace('/web?debug=0#', '')
            data = data.replace('/web#', '')
            
            values = {}
            for record in data.split('&'):
                value = record.split('=')
                values.update({value[0]:value[1]})
            
            if 'home' in values.keys():
                activity_log_obj.create({
                    'name':"Open Home Screen",
                    'action':'read',
                    'login_log_id':login_log.id,
                    'user_id':login_log.user_id.id,
                    'url':original_url,
                    'model':'n/a',
                    'view':'n/a',
                })
            else:
                name = ''
                if values.get('id'):
                    record = request.env[values.get('model')].search([('id','=',values.get('id'))],limit=1)
                    if record:
                        try:
                            if record.name:
                                name = record.name
                            else:
                                name = record.display_name
                        except:
                            name = record.display_name
                if not name and values.get('menu_id'):
                    menu = menu_obj.search([('id','=',values.get('menu_id'))],limit=1)
                    if menu:
                        name = menu.name
                if name and values.get('model'):
                    activity_log_obj.create({
                        'name':name,
                        'model':values.get('model') or '',
                        'res_id':values.get('id') or '',
                        'action':'read',
                        'view':values.get('view_type') or '',
                        'login_log_id':login_log.id,
                        'user_id':login_log.user_id.id,
                        'url':original_url,
                    })
        except:
            pass
        
        return 

    @http.route('/get/ip_params', type='json', auth='public')
    def _get_ip_params(self):
        vals = {}
        config_parameter_obj = request.env['ir.config_parameter'].sudo()
        ip_url = config_parameter_obj.get_param('advanced_session_management.ip_url') or 'none'
        ip_key = config_parameter_obj.get_param('advanced_session_management.ip_key') or 'none'
        vals['ip_url'] = ip_url
        vals['ip_key'] = ip_key
        return vals
