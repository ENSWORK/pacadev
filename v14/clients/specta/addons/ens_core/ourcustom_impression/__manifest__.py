# -*- coding: utf-8 -*-
{
    'name': "OurCustom Impression",

    'summary': """OurCustom Model Impression""",

    'description': """

    """,

    'author': "ENSWORK",
    'website': "http://www.enswork.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/14.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Extra Tools',
    'version': '2.0',

    # any module necessary for this one to work correctly
    'depends': ['base', 'purchase', 'sale', 'iwesabe_slno_in_sale_order_line', 'ourcustom_slno_in_line',
                'report_qweb_element_page_visibility', 'stock', 'purchase_order_line_discount', 'stock_picking_invoice_link',
                'account', 'ourcustom_settings', 'ourcustom_commun_v2', 'sale_purchase_tax_splitup', 'ourcustom_sale_details_in_delivery'],

    # always loaded
    'data': [
        'data/paper_format_db.xml',
        'data/paper_format_std.xml',
        'views/add_fields_form.xml',

        'report/ens/ourcustom_header_footer.xml',
        'report/ens/ourcustom_header_footerbl.xml',
        'report/ens/ourcustom_header_footerbc.xml',
        'report/ens/ourcustom_header_footerdp.xml',
        'report/ens/ourcustom_header_footeroc.xml',

        'report/ens/ourcustom_header_footeroc_whf.xml',
        'report/ens/ourcustom_header_footer_whf.xml',


        'report/ens/ourstock_report_delivery_has_serial_move_line.xml',
        'report/ens/ourstock_report_delivery_aggregated_move_lines.xml',
        'report/ens/ourstock_report_delivery_aggregated_move_lines_pr.xml',
        'report/ens/ourstock_report_delivery_has_serial_move_line_pr.xml',


        'report/ens/report_ourdelivery_document_inherit.xml',
        'report/ens/report_ourinvoice_document_inherit.xml',
        'report/ens/report_ourinvoice_document_inherit_whf.xml',
        'report/ens/report_ourpurchaseorder_document_inherit.xml',
        'report/ens/report_ourpurchasequotation_document_inherit.xml',
        'report/ens/report_oursaleorder_document_inherit.xml',
        'report/ens/report_oursaleorder_document_inherit_whf.xml',
        'report/ens/report_to_invoice_whf.xml',
        'report/ens/report_to_saleorder_whf.xml',

        'report/ens/report_delivery_with_price.xml',
        'report/ens/bon_de_livraison_simple.xml',


        'report/report_invoice_dollibar_headfoot.xml',
        'report/report_invoice_dollibar_headfoot_se.xml',
        'report/report_saleorder_dollibar_headfoot.xml',
        'report/report_saleorder_dollibar_headfoot_se.xml',
        'report/report_saleorder_pro_dollibar_headfoot.xml',
        'report/report_purchaseorder_dollibar_headfoot.xml',
        'report/report_purchaseorder_dollibar_headfoot_se.xml',
        'report/report_delivery_dollibar_headfoot.xml',
        'report/report_delivery_dollibar_headfoot_se.xml',
        'report/report_purchasequotation_dollibar_headfoot.xml',
        'report/report_purchasequotation_dollibar_headfoot_se.xml',
        'report/report_delivery_dollibar_has_serial_move_line.xml',
        'report/report_delivery_dollibar_aggregated_move_lines.xml',
        'report/report_invoice_dollibar.xml',
        'report/report_invoice_dolibarr_se.xml',
        'report/report_saleorder_dollibar.xml',
        'report/report_saleorder_dollibar_se.xml',
        'report/report_saleorder_pro_dollibar.xml',
        'report/report_purchaseorder_dollibar.xml',
        'report/report_purchaseorder_dollibar_se.xml',
        'report/report_purchasequotation_dollibar.xml',
        'report/report_purchasequotation_dollibar_se.xml',
        'report/report_delivery_dollibar.xml',
        'report/report_delivery_dollibar_se.xml',



        'report/report.xml',
    ],
    # only loaded in demonstration mode
#    'demo': [
#        'demo.xml',
#    ],
'installable': True,
'application': True,
'auto_install': False,
}
