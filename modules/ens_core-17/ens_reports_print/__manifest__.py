{
    "name": "ENS Reports Print",
    "version": "17.0.1.0",
    "summary": "Impression flexible avec options configurables",
    "category": "Custom",
    "author": "ENSDEV",
    "depends": ["base", "account"],
    "data": [
        # Views
        "views/company_views.xml",
        # Reports inheritance - Phase 1 MVP : Factures uniquement
        "views/report_invoice_inherit.xml",
        # TODO Phase 2: Activer après création des autres templates
        # "views/report_saleorder_inherit.xml",
        # "views/report_delivery_inherit.xml",
        # "views/report_purchaseorder_inherit.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "ens_reports_print/static/src/css/print_custom.css",
            # TODO Phase 2: Activer après création du popup JS
            # "ens_reports_print/static/src/js/print_override.js",
            # "ens_reports_print/static/src/xml/print_popup.xml",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
