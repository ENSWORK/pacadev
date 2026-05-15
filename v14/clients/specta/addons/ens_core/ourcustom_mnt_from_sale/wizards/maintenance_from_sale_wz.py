from odoo import models, fields, api, _


class MaintenanceFromSale(models.TransientModel):
	_name = 'maintenance.fromsale'
	_description = "Create Maintenance Request From Sale"

	test = fields.Char('Test')
	name = fields.Char(string="Titre", required=True)
	maintenance_team_id = fields.Many2one('maintenance.team', string="Équipe", required=True)
	user_id = fields.Many2one('res.users', string="Responsable")
	equipment_id = fields.Many2one('maintenance.equipment', string="Équipement")
	schedule_date = fields.Datetime('Date prévue',
									help="Date prévue par l'équipe de maintenance pour effectuer la maintenance. Celle-ci ne doit pas être trop éloignée de la date de demande. ")

	priority = fields.Selection([('0', 'Very Low'), ('1', 'Low'), ('2', 'Normal'), ('3', 'High')], string='Priorité')

	def action_create_maintenance_from_sale(self):
		self.ensure_one()
		res = self.env['maintenance.request'].browse(self._context.get('id', []))
		value = []
		so = self.env['sale.order'].browse(self._context.get('active_id'))
		sale_order_name = so.name

		res.create({
			'name': self.name,
			'maintenance_team_id': self.maintenance_team_id.id,
			'user_id': self.user_id.id,
			'equipment_id': self.equipment_id.id,
			'schedule_date': self.schedule_date,
			'priority': self.priority,
			'origin_sale': so.id,
		})


		# ---------------------------To Open the created Maintenance Request-----------------------
		#
		mnt_obj = self.env['maintenance.request'].search([('origin_sale', '=', so.id)])
		mnt_ids = []
		for mnt in mnt_obj:
			mnt_ids.append(mnt.id)
		view_id = self.env.ref('maintenance.hr_equipment_request_view_form').id
		ctx = dict(
			create=False,
		)
		if mnt_ids:
			if len(mnt_ids) <= 1:
				value = {
					'view_mode': 'form',
					'res_model': 'maintenance.request',
					'view_id': view_id,
					'type': 'ir.actions.act_window',
					'name': 'Demande de maintenance',
					'context': ctx,
					'res_id': mnt_ids and mnt_ids[0]
				}
			else:
				value = {
					'domain': str([('id', 'in', mnt_ids)]),
					'view_mode': 'tree,form',
					'res_model': 'maintenance.request',
					'view_id': False,
					'type': 'ir.actions.act_window',
					'context': ctx,
					'name': 'emande de maintenance',
					'res_id': mnt_ids
				}
			return value


		return res
