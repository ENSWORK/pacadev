from io import BytesIO
import base64
import zipfile
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import xlwt
from odoo import fields, models
from odoo.exceptions import UserError


class CustomerStatementWizard(models.TransientModel):
    """
    A wizard for generating customer statement reports, including details such as invoices,
    payments, and balances for a specified date range.
    """
    _name = 'customer.statement.wizard'
    _description = "Relevé de compte partenaire"
    _rec_name = 'start_date'

    statement_type = fields.Selection(
        [('activity', "Relevé d'activité"),
         ('detailed_activity', "Relevé d'activité détaillé"),
         ('outstanding', 'Relevé des impayés')],
        string="Type de relevé",
        required=True,
        default='outstanding',
    )
    start_date = fields.Date(string="Date de début")
    end_date = fields.Date(string="Date de fin")
    as_of_date = fields.Date(
        string="Au",
        required=True,
        default=fields.Date.context_today,
    )
    partner_type = fields.Selection(
        [('customer', 'Client'), ('vendor', 'Fournisseur')],
        string="Type de partenaire",
        required=True,
        default='customer',
    )
    partner_ids = fields.Many2many(
        "res.partner",
        string="Partenaires",
        required=True,
    )
    exclude_zero_balance = fields.Boolean(string="Exclure les clients à solde nul", default=False)
    show_aging_buckets = fields.Boolean(string="Afficher l'analyse des échéances", default=True)
    aging_type = fields.Selection(
        [('days', 'Par jours'), ('months', 'Par mois')],
        string="Méthode d'analyse",
        default='days',
        required=True,
    )

    def _get_aging_buckets(self, partner, aging_type='days', as_of_date=None):
        """Compute ageing buckets from all open (unpaid) invoices as of the given date."""
        as_of = as_of_date or date.today()
        move_type = 'out_invoice' if self.partner_type == 'customer' else 'in_invoice'
        buckets = {'current': 0.0, 'b_1_30': 0.0, 'b_30_60': 0.0,
                   'b_60_90': 0.0, 'b_90_120': 0.0, 'b_over_120': 0.0}
        open_invoices = self.env['account.move'].search([
            ('partner_id', '=', partner.id),
            ('move_type', '=', move_type),
            ('state', '=', 'posted'),
            ('payment_state', 'not in', ['paid', 'reversed']),
            ('invoice_date', '<=', as_of),
        ])
        if aging_type == 'months':
            m0 = as_of.replace(day=1)
            m1 = m0 - relativedelta(months=1)
            m2 = m0 - relativedelta(months=2)
            m3 = m0 - relativedelta(months=3)
            m4 = m0 - relativedelta(months=4)
            for inv in open_invoices:
                balance = abs(inv.amount_residual_signed)
                if balance <= 0:
                    continue
                due = inv.invoice_date_due or inv.invoice_date or as_of
                if due >= m0:
                    buckets['current'] += balance
                elif due >= m1:
                    buckets['b_1_30'] += balance
                elif due >= m2:
                    buckets['b_30_60'] += balance
                elif due >= m3:
                    buckets['b_60_90'] += balance
                elif due >= m4:
                    buckets['b_90_120'] += balance
                else:
                    buckets['b_over_120'] += balance
        else:
            for inv in open_invoices:
                balance = abs(inv.amount_residual_signed)
                if balance <= 0:
                    continue
                due = inv.invoice_date_due or inv.invoice_date or as_of
                days_overdue = (as_of - due).days
                if days_overdue <= 0:
                    buckets['current'] += balance
                elif days_overdue <= 30:
                    buckets['b_1_30'] += balance
                elif days_overdue <= 60:
                    buckets['b_30_60'] += balance
                elif days_overdue <= 90:
                    buckets['b_60_90'] += balance
                elif days_overdue <= 120:
                    buckets['b_90_120'] += balance
                else:
                    buckets['b_over_120'] += balance
        buckets['total'] = sum(buckets.values())
        return {k: round(v, 2) for k, v in buckets.items()}

    def _get_invoice_data(self, partner):
        move_type = 'out_invoice' if self.partner_type == 'customer' else 'in_invoice'
        domain = [
            ('partner_id', '=', partner.id),
            ('move_type', '=', move_type),
        ]
        if self.start_date:
            domain.append(('invoice_date', '>=', self.start_date))
        if self.end_date:
            domain.append(('invoice_date', '<=', self.end_date))
        invoices = self.env['account.move'].search(domain)
        invoice_data = []
        total_amount = total_payment = total_balance = 0
        for invoice in invoices:
            paid_amount = abs(invoice.amount_total_signed) - abs(invoice.amount_residual_signed)
            invoice_data.append({
                'invoice_date': invoice.invoice_date,
                'invoice_date_due': invoice.invoice_date_due,
                'invoice_id': invoice.name,
                'amount': round(abs(invoice.amount_total_signed), 2),
                'payment_amount': round(paid_amount, 2),
                'balance_due': round(abs(invoice.amount_residual_signed), 2),
            })
            total_amount += abs(invoice.amount_total_signed)
            total_payment += paid_amount
            total_balance += abs(invoice.amount_residual_signed)
        return invoice_data, round(total_amount, 2), round(total_payment, 2), round(total_balance, 2)

    def _get_open_invoices(self, partner, as_of_date):
        """Return open invoices as of a given date with running balance."""
        move_type = 'out_invoice' if self.partner_type == 'customer' else 'in_invoice'
        invoices = self.env['account.move'].search([
            ('partner_id', '=', partner.id),
            ('move_type', '=', move_type),
            ('state', '=', 'posted'),
            ('payment_state', 'not in', ['paid', 'reversed']),
            ('invoice_date', '<=', as_of_date),
        ], order='invoice_date asc')
        lines = []
        running = 0.0
        for inv in invoices:
            running += round(abs(inv.amount_residual_signed), 2)
            lines.append({
                'date': inv.invoice_date,
                'due_date': inv.invoice_date_due,
                'reference': inv.name,
                'original_amount': round(abs(inv.amount_total_signed), 2),
                'open_amount': round(abs(inv.amount_residual_signed), 2),
                'balance': round(running, 2),
            })
        return lines, round(running, 2)

    def _get_activity_data(self, partner):
        """Return invoices with their reconciled payment sub-lines."""
        move_type = 'out_invoice' if self.partner_type == 'customer' else 'in_invoice'
        refund_type = 'out_refund' if self.partner_type == 'customer' else 'in_refund'
        account_type = 'asset_receivable' if self.partner_type == 'customer' else 'liability_payable'
        domain = [
            ('partner_id', '=', partner.id),
            ('move_type', 'in', [move_type, refund_type]),
            ('state', '=', 'posted'),
        ]
        if self.start_date:
            domain.append(('invoice_date', '>=', self.start_date))
        if self.end_date:
            domain.append(('invoice_date', '<=', self.end_date))
        invoices = self.env['account.move'].search(domain, order='invoice_date asc')

        opening_balance = 0.0
        if self.start_date:
            prior_date = self.start_date - timedelta(days=1)
            _, opening_balance = self._get_open_invoices(partner, prior_date)
        running = 0.0

        lines = []
        for inv in invoices:
            is_refund = inv.move_type == 'out_refund'
            original = round(abs(inv.amount_total_signed), 2)
            applied = round(abs(inv.amount_total_signed) - abs(inv.amount_residual_signed), 2)
            open_amount = round(abs(inv.amount_residual_signed), 2)
            running += original if not is_refund else -original

            inv_line = {
                'date': inv.invoice_date,
                'due_date': inv.invoice_date_due,
                'reference': inv.name,
                'original_amount': -original if is_refund else original,
                'applied_amount': applied,
                'open_amount': -open_amount if is_refund else open_amount,
                'balance': round(running, 2),
                'is_reconciled': False,
                'sub_lines': [],
            }

            for line in inv.line_ids.filtered(lambda ln: ln.account_id.account_type == account_type):
                for partial in (line.matched_credit_ids if self.partner_type == 'customer' else line.matched_debit_ids):
                    pmt_move = partial.credit_move_id.move_id if self.partner_type == 'customer' else partial.debit_move_id.move_id
                    pmt_line_date = partial.credit_move_id.date if self.partner_type == 'customer' else partial.debit_move_id.date
                    memo = pmt_move.ref or ''
                    ref = f'Règlement de {inv.name}'
                    if memo:
                        ref += f', Réf : {memo}'
                    running -= round(partial.amount, 2)
                    inv_line['sub_lines'].append({
                        'date': pmt_line_date,
                        'reference': ref,
                        'applied_amount': round(partial.amount, 2),
                    })

            lines.append(inv_line)

        closing_balance = round(opening_balance + running, 2)
        return lines, closing_balance, round(opening_balance, 2)

    def _build_report_data(self, partner_ids):
        """Build the form_data dict used by the PDF report action."""
        return {
            'form_data': {
                'statement_type': self.statement_type,
                'start_date': str(self.start_date) if self.start_date else None,
                'end_date': str(self.end_date) if self.end_date else None,
                'as_of_date': str(self.as_of_date),
                'partner_ids': partner_ids,
                'partner_type': self.partner_type,
                'exclude_zero_balance': self.exclude_zero_balance,
                'show_aging_buckets': self.show_aging_buckets,
                'aging_type': self.aging_type,
            }
        }

    def customer_statements_pdf_report(self):
        """
        Generates individual PDF statements per customer and bundles them into a zip.
        If only one customer is selected, downloads the PDF directly.
        """
        self.ensure_one()
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise UserError("La date de début ne peut pas être postérieure à la date de fin.")

        report = self.env.ref('partner_statement_report.customer_report_template_action')
        partners_to_print = []
        for p in self.partner_ids:
            if self.exclude_zero_balance:
                if self.statement_type in ('activity', 'detailed_activity'):
                    _, balance, _ = self._get_activity_data(p)
                    if balance == 0:
                        continue
                else:
                    if self._get_invoice_data(p)[3] == 0:
                        continue
            partners_to_print.append(p)
        if not partners_to_print:
            raise UserError("Aucun client à imprimer après application des filtres.")

        if len(partners_to_print) == 1:
            partner = partners_to_print[0]
            pdf_content, _ = report._render_qweb_pdf(
                report.id, res_ids=self.ids,
                data=self._build_report_data([partner.id])
            )
            attachment = self.env['ir.attachment'].sudo().create({
                'name': f'Statement_{partner.name}_{self.as_of_date}.pdf',
                'type': 'binary',
                'datas': base64.encodebytes(pdf_content),
                'mimetype': 'application/pdf',
            })
            return {
                'type': 'ir.actions.act_url',
                'url': '/web/content/%s?download=true' % attachment.id,
                'target': 'self',
            }

        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for partner in partners_to_print:
                pdf_content, _ = report._render_qweb_pdf(
                    report.id, res_ids=self.ids,
                    data=self._build_report_data([partner.id])
                )
                filename = f'Statement_{partner.name}_{self.as_of_date}.pdf'
                zf.writestr(filename, pdf_content)

        attachment = self.env['ir.attachment'].sudo().create({
            'name': f'Customer_Statements_{self.as_of_date}.zip',
            'type': 'binary',
            'datas': base64.encodebytes(zip_buffer.getvalue()),
            'mimetype': 'application/zip',
        })
        return {
            'type': 'ir.actions.act_url',
            'url': '/web/content/%s?download=true' % attachment.id,
            'target': 'self',
        }

    def customer_statements_send_email(self):
        """Generate a per-customer PDF statement and send it to each customer's email."""
        self.ensure_one()
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise UserError("La date de début ne peut pas être postérieure à la date de fin.")

        report = self.env.ref('partner_statement_report.customer_report_template_action')
        no_email = []
        sent_count = 0

        for partner in self.partner_ids:
            if self.exclude_zero_balance:
                if self.statement_type in ('activity', 'detailed_activity'):
                    _, balance, _ = self._get_activity_data(partner)
                    if balance == 0:
                        continue
                else:
                    if self._get_invoice_data(partner)[3] == 0:
                        continue
            if not partner.email:
                no_email.append(partner.name)
                continue

            pdf_content, _ = report._render_qweb_pdf(
                report.id, res_ids=self.ids,
                data=self._build_report_data([partner.id])
            )
            attachment = self.env['ir.attachment'].sudo().create({
                'name': f'Releve_{partner.name}_{self.as_of_date}.pdf',
                'type': 'binary',
                'datas': base64.encodebytes(pdf_content),
                'mimetype': 'application/pdf',
            })
            template = self.env.ref('partner_statement_report.email_template_partner_statement')
            partner.message_post(
                body=template._render_field('body_html', [partner.id])[partner.id],
                subject=f'Relevé de compte au {self.as_of_date}',
                message_type='email',
                subtype_xmlid='mail.mt_comment',
                partner_ids=[partner.id],
                attachment_ids=[attachment.id],
            )
            sent_count += 1

        if no_email:
            raise UserError(
                f"Relevés envoyés à {sent_count} client(s).\n"
                f"Les clients suivants n'ont pas d'adresse e-mail et ont été ignorés :\n"
                + "\n".join(f"• {name}" for name in no_email)
            )
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Relevés envoyés',
                'message': f'Relevés de compte envoyés avec succès à {sent_count} client(s).',
                'type': 'success',
                'sticky': False,
            },
        }

    def customer_statements_excel_report(self):
        """
        Generates an Excel report for the customer statement, including invoice details,
        payments, and balances for a specified date range.
        """
        workbook = xlwt.Workbook(encoding="UTF-8")
        sheet1 = workbook.add_sheet('Relevé client', cell_overwrite_ok=True)
        main_head = xlwt.easyxf(
            'align: horiz center, vert center;'
            'pattern: pattern solid, fore_colour gray25;'
        )
        normal_heading = xlwt.easyxf(
            'font: bold on;'
            'align: horiz center,vert center;'
            'pattern: pattern solid, fore_colour gray25;'
        )
        normal_partner_data = xlwt.easyxf(
            'align: horiz center, vert center;'
        )
        normal_partner_data_italic = xlwt.easyxf(
            'align: horiz center, vert center;'
            'font: italic on;'
        )
        normal_data_italic = xlwt.easyxf(
            'align: horiz right, vert center;'
            'font: italic on;'
        )
        normal_data = xlwt.easyxf(
            'align: horiz right, vert center;'
        )
        total_format = xlwt.easyxf(
            'align: horiz right, vert center;'
            'font: bold on;'
        )
        mege_cell_format = xlwt.easyxf(
            'font: height 170;'
            'align: horiz left, vert top, wrap on;'
            'borders: left thin, right thin, bottom thin, top thin;'
        )
        date_currency_format = xlwt.easyxf(
            'align: horiz left, vert center;'
            'borders: left thin, right thin, bottom thin, top thin;'
        )
        amount_format = xlwt.easyxf(
            'font: bold on;'
            'align: horiz right,vert center;'
            'pattern: pattern solid, fore_colour gray25;'
        )
        font = xlwt.Font()
        font.bold = True
        font.height = 310
        main_head.font = font

        date_head = xlwt.XFStyle()
        date_head.num_format_str = 'dd-mm-yyyy'
        alignment = xlwt.Alignment()
        alignment.horz = xlwt.Alignment.HORZ_LEFT
        alignment.vert = xlwt.Alignment.VERT_CENTER
        date_head.alignment = alignment
        borders = xlwt.Borders()
        borders.left = xlwt.Borders.THIN
        borders.right = xlwt.Borders.THIN
        borders.bottom = xlwt.Borders.THIN
        borders.top = xlwt.Borders.THIN
        date_head.borders = borders

        date_format = xlwt.XFStyle()
        date_format.num_format_str = 'dd-mm-yyyy'
        alignment = xlwt.Alignment()
        alignment.horz = xlwt.Alignment.HORZ_CENTER
        date_format.alignment = alignment

        sheet1.col(0).width = 5000
        sheet1.col(1).width = 5000
        sheet1.col(2).width = 5000
        sheet1.col(3).width = 5000
        sheet1.col(4).width = 5000
        sheet1.col(5).width = 5000
        sheet1.row(3).height = 400
        sheet1.row(4).height = 400
        sheet1.row(5).height = 400
        sheet1.row(7).height = 350

        company = self.env.company
        currency = company.currency_id.symbol

        sheet1.write_merge(0, 1, 0, 5, 'Relevé de compte', main_head)

        statement_labels = {
            'activity': "Relevé d'activité",
            'detailed_activity': "Relevé d'activité détaillé",
            'outstanding': 'Relevé des impayés',
        }
        partner_type_label = 'Client' if self.partner_type == 'customer' else 'Fournisseur'
        statement_label = f"{statement_labels.get(self.statement_type, '')} — {partner_type_label}"
        sheet1.write_merge(2, 2, 0, 5, statement_label, normal_heading)

        row_start = 4
        for partner in self.partner_ids:
            invoice_data, total_amount, total_payment, total_balance = self._get_invoice_data(partner)
            partner_data = ""
            if partner.name:
                partner_data += f"{partner.name}\n"
            if partner.street:
                partner_data += f"{partner.street}\n"
            if partner.street2:
                partner_data += f"{partner.street2}\n"
            if partner.city and partner.zip:
                partner_data += f"{partner.city}, {partner.zip}\n"
            elif partner.city:
                partner_data += f"{partner.city}\n"
            elif partner.zip:
                partner_data += f"{partner.zip}\n"
            if partner.state_id:
                partner_data += f"{partner.state_id.name}\n"
            if partner.country_id:
                partner_data += f"{partner.country_id.name}\n"

            sheet1.write_merge(row_start, row_start + 2, 0, 1, partner_data, mege_cell_format)
            sheet1.write(row_start, 4, "AU", date_currency_format)
            sheet1.write(row_start, 5, self.as_of_date, date_head)
            sheet1.write(row_start + 1, 4, "Devise", date_currency_format)
            sheet1.write(row_start + 1, 5, currency, date_currency_format)
            if self.start_date:
                sheet1.write(row_start + 2, 4, "Période", date_currency_format)
                period = str(self.start_date)
                if self.end_date:
                    period += f' — {self.end_date}'
                sheet1.write(row_start + 2, 5, period, date_currency_format)
            sheet1.row(row_start).height = 400
            sheet1.row(row_start + 1).height = 400
            sheet1.row(row_start + 2).height = 400
            row_start += 4

            if self.statement_type in ('activity', 'detailed_activity'):
                activity_lines, closing_balance, opening_bal = self._get_activity_data(partner)
                if self.exclude_zero_balance and closing_balance == 0:
                    continue

                if self.statement_type == 'detailed_activity' and self.start_date:
                    from datetime import timedelta
                    prior_date = self.start_date - timedelta(days=1)
                    end_date = self.end_date or self.as_of_date
                    prior_lines, prior_bal = self._get_open_invoices(partner, prior_date)
                    ending_lines, ending_bal = self._get_open_invoices(partner, end_date)

                    # Solde antérieur
                    sheet1.write_merge(row_start, row_start, 0, 5, 'Solde antérieur', normal_heading)
                    sheet1.row(row_start).height = 350
                    row_start += 1
                    sheet1.write(row_start, 0, "Date", normal_heading)
                    sheet1.write(row_start, 1, "Échéance", normal_heading)
                    sheet1.write(row_start, 2, "Référence", normal_heading)
                    sheet1.write(row_start, 3, "Montant initial", amount_format)
                    sheet1.write(row_start, 4, "Montant ouvert", amount_format)
                    sheet1.write(row_start, 5, "Solde", amount_format)
                    sheet1.row(row_start).height = 350
                    row_start += 1
                    for line in prior_lines:
                        sheet1.write(row_start, 0, line['date'], date_format)
                        sheet1.write(row_start, 1, line.get('due_date') or '', date_format)
                        sheet1.write(row_start, 2, line['reference'], normal_partner_data)
                        sheet1.write(row_start, 3, line['original_amount'], normal_data)
                        sheet1.write(row_start, 4, line['open_amount'], normal_data)
                        sheet1.write(row_start, 5, line['balance'], normal_data)
                        sheet1.row(row_start).height = 300
                        row_start += 1
                    sheet1.write_merge(row_start, row_start, 0, 4, 'Total solde antérieur', amount_format)
                    sheet1.write(row_start, 5, prior_bal, total_format)
                    row_start += 2

                # Activité
                sheet1.write_merge(row_start, row_start, 0, 5, 'Activité', normal_heading)
                sheet1.row(row_start).height = 350
                row_start += 1
                sheet1.write(row_start, 0, "Date", normal_heading)
                sheet1.write(row_start, 1, "Échéance", normal_heading)
                sheet1.write(row_start, 2, "Référence", normal_heading)
                sheet1.write(row_start, 3, "Montant", amount_format)
                sheet1.write(row_start, 4, "Montant réglé", amount_format)
                sheet1.write(row_start, 5, "Solde", amount_format)
                sheet1.row(row_start).height = 350
                row_start += 1
                if self.statement_type == 'activity' and self.start_date:
                    sheet1.write_merge(row_start, row_start, 0, 4, "Solde d'ouverture", amount_format)
                    sheet1.write(row_start, 5, opening_bal, total_format)
                    sheet1.row(row_start).height = 300
                    row_start += 1
                for line in activity_lines:
                    sheet1.write(row_start, 0, line['date'], date_format)
                    sheet1.write(row_start, 1, line.get('due_date') or '', date_format)
                    sheet1.write(row_start, 2, line['reference'], normal_partner_data)
                    sheet1.write(row_start, 3, line['original_amount'], normal_data)
                    sheet1.write(row_start, 4, line['applied_amount'], normal_data)
                    sheet1.write(row_start, 5, line['balance'], normal_data)
                    sheet1.row(row_start).height = 300
                    row_start += 1
                    for sub in line['sub_lines']:
                        sheet1.write(row_start, 0, sub['date'], date_format)
                        sheet1.write(row_start, 1, '', normal_data_italic)
                        sheet1.write(row_start, 2, sub['reference'], normal_partner_data_italic)
                        sheet1.write(row_start, 3, '', normal_data_italic)
                        sheet1.write(row_start, 4, sub['applied_amount'], normal_data_italic)
                        sheet1.write(row_start, 5, '', normal_data_italic)
                        sheet1.row(row_start).height = 300
                        row_start += 1
                sheet1.write_merge(row_start, row_start, 0, 4, 'Solde de clôture', amount_format)
                sheet1.write(row_start, 5, closing_balance, total_format)
                row_start += 2

                if self.statement_type == 'detailed_activity' and self.start_date:
                    # Solde final
                    sheet1.write_merge(row_start, row_start, 0, 5, 'Solde final', normal_heading)
                    sheet1.row(row_start).height = 350
                    row_start += 1
                    sheet1.write(row_start, 0, "Date", normal_heading)
                    sheet1.write(row_start, 1, "Échéance", normal_heading)
                    sheet1.write(row_start, 2, "Référence", normal_heading)
                    sheet1.write(row_start, 3, "Montant initial", amount_format)
                    sheet1.write(row_start, 4, "Montant ouvert", amount_format)
                    sheet1.write(row_start, 5, "Solde", amount_format)
                    sheet1.row(row_start).height = 350
                    row_start += 1
                    for line in ending_lines:
                        sheet1.write(row_start, 0, line['date'], date_format)
                        sheet1.write(row_start, 1, line.get('due_date') or '', date_format)
                        sheet1.write(row_start, 2, line['reference'], normal_partner_data)
                        sheet1.write(row_start, 3, line['original_amount'], normal_data)
                        sheet1.write(row_start, 4, line['open_amount'], normal_data)
                        sheet1.write(row_start, 5, line['balance'], normal_data)
                        sheet1.row(row_start).height = 300
                        row_start += 1
                    sheet1.write_merge(row_start, row_start, 0, 4, 'Total solde final', amount_format)
                    sheet1.write(row_start, 5, ending_bal, total_format)
                    row_start += 2

                    # Analyse des échéances
                    buckets = self._get_aging_buckets(partner, self.aging_type, end_date)
                    if buckets.get('total', 0) != 0:
                        if self.aging_type == 'months':
                            aging_labels = ['Courant', '1 mois', '2 mois', '3 mois', '4 mois', 'Plus ancien', 'Total']
                        else:
                            aging_labels = ['Courant', '1-30 jours', '31-60 jours', '61-90 jours', '91-120 jours', '121+ jours', 'Total']
                        aging_keys = ['current', 'b_1_30', 'b_30_60', 'b_60_90', 'b_90_120', 'b_over_120', 'total']
                        sheet1.write_merge(row_start, row_start, 0, 6, "Analyse des échéances", normal_heading)
                        sheet1.row(row_start).height = 350
                        row_start += 1
                        for col, label in enumerate(aging_labels):
                            sheet1.write(row_start, col, label, normal_heading)
                        row_start += 1
                        for col, key in enumerate(aging_keys):
                            sheet1.write(row_start, col, buckets.get(key, 0.0), total_format)
                        sheet1.row(row_start).height = 300
                        row_start += 2
                continue

            sheet1.write(row_start, 0, "Date facture", normal_heading)
            sheet1.write(row_start, 1, "Date d'échéance", normal_heading)
            sheet1.write(row_start, 2, "Facture", normal_heading)
            sheet1.write(row_start, 3, "Montant facture", amount_format)
            sheet1.write(row_start, 4, "Montant réglé", amount_format)
            sheet1.write(row_start, 5, "Solde dû", amount_format)
            sheet1.row(row_start).height = 350
            row_start += 1

            for invoice in invoice_data:
                sheet1.write(row_start, 0, invoice['invoice_date'], date_format)
                sheet1.write(row_start, 1, invoice.get('invoice_date_due') or '', date_format)
                sheet1.write(row_start, 2, invoice['invoice_id'], normal_partner_data)
                sheet1.write(row_start, 3, invoice['amount'], normal_data)
                sheet1.write(row_start, 4, invoice['payment_amount'], normal_data)
                sheet1.write(row_start, 5, invoice['balance_due'], normal_data)
                sheet1.row(row_start).height = 300
                row_start += 1

            sheet1.row(row_start).height = 300
            sheet1.write_merge(row_start, row_start, 0, 2, 'Total', amount_format)
            sheet1.write(row_start, 3, total_amount, total_format)
            sheet1.write(row_start, 4, total_payment, total_format)
            sheet1.write(row_start, 5, total_balance, total_format)
            row_start += 2

            # Aging buckets
            buckets = self._get_aging_buckets(partner, self.aging_type, self.as_of_date)
            if buckets.get('total', 0) != 0:
                if self.aging_type == 'months':
                    aging_labels = ['Courant', '1 mois', '2 mois', '3 mois', '4 mois', 'Plus ancien', 'Total']
                else:
                    aging_labels = ['Courant', '1-30 jours', '31-60 jours', '61-90 jours', '91-120 jours', '121+ jours', 'Total']
                aging_keys = ['current', 'b_1_30', 'b_30_60', 'b_60_90', 'b_90_120', 'b_over_120', 'total']
                sheet1.write_merge(row_start, row_start, 0, 5, "Analyse des échéances", normal_heading)
                sheet1.row(row_start).height = 350
                row_start += 1
                for col, label in enumerate(aging_labels):
                    sheet1.write(row_start, col, label, normal_heading)
                row_start += 1
                for col, key in enumerate(aging_keys):
                    sheet1.write(row_start, col, buckets.get(key, 0.0), total_format)
                sheet1.row(row_start).height = 300
                row_start += 2

        with BytesIO() as stream:
            workbook.save(stream)
            output = base64.encodebytes(stream.getvalue())
        attachment_id = self.env['ir.attachment'].sudo().create({
            'name': 'Releve_client.xls',
            'type': 'binary',
            'public': False,
            'datas': output,
        })
        return {
            'type': 'ir.actions.act_url',
            'url': '/web/content/%s?download=true' % attachment_id.id,
            'target': 'self',
        }
