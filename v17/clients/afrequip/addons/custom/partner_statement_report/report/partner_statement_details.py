# Copyright 2019 Eficent
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

from odoo import models
from datetime import datetime


class ReportPartnerStatement(models.AbstractModel):
    _name = "report.partner_statement_report.partner_statement_report"
    _description = "Partner Statement Report"

    def _get_partner_lines(self, partner, date_from, date_to):
        """Get activity lines for partner - MOD 4: Ajouter date_due"""
        lines = []
        
        # Récupérer les lignes de factures/notes
        invoices = partner.invoice_ids.filtered(
            lambda x: x.state in ['open', 'posted'] and x.date <= date_to
        )
        
        for invoice in invoices:
            # MOD 4: Ajouter champ date_due
            line = {
                'ref': invoice.name,
                'date': invoice.date,
                'date_due': invoice.invoice_date_due,  # NEW: date d'échéance
                'debit': invoice.amount_untaxed if invoice.type in ['out_invoice', 'in_refund'] else 0,
                'credit': invoice.amount_untaxed if invoice.type in ['out_refund', 'in_invoice'] else 0,
                'currency': invoice.currency_id,  # Gardé pour totaux (MOD 3)
                'balance': invoice.amount_residual,
            }
            lines.append(line)
        
        return lines

    def _get_outstanding(self, partner, date_to):
        """Get outstanding lines - MOD 4: Ajouter date_due, MOD 3: Garder devise"""
        outstanding = []
        
        invoices = partner.invoice_ids.filtered(
            lambda x: x.state == 'posted' and x.date <= date_to and x.amount_residual > 0
        )
        
        for invoice in invoices:
            outstanding.append({
                'ref': invoice.name,
                'date': invoice.date,
                'date_due': invoice.invoice_date_due,  # NEW: date d'échéance
                'amount': invoice.amount_residual,
                'currency': invoice.currency_id,  # Gardé (MOD 3)
            })
        
        return outstanding

    def _get_aging_buckets(self, partner, date_to):
        """Aging analysis by date buckets - Devise gardée (MOD 3)"""
        buckets = {
            'current': 0,
            '30': 0,
            '60': 0,
            '90': 0,
            'older': 0,
        }
        currency = partner.company_id.currency_id
        
        invoices = partner.invoice_ids.filtered(
            lambda x: x.state == 'posted' and x.amount_residual > 0
        )
        
        for invoice in invoices:
            due_date = invoice.invoice_date_due or invoice.date
            days_overdue = (date_to - due_date).days
            
            if days_overdue <= 0:
                buckets['current'] += invoice.amount_residual
            elif days_overdue <= 30:
                buckets['30'] += invoice.amount_residual
            elif days_overdue <= 60:
                buckets['60'] += invoice.amount_residual
            elif days_overdue <= 90:
                buckets['90'] += invoice.amount_residual
            else:
                buckets['older'] += invoice.amount_residual
        
        buckets['currency'] = currency  # Gardé (MOD 3)
        return buckets

