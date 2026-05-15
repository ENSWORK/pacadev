# Inventaire OpenEnsdev — 2026-05-14_0139

## Synthèse
- Clients avec docker-compose : **16**
- Filestore total : **139.7MB**
- Secrets en clair détectés : **14**
- Conteneurs running : **4** / total : **35**

## Conteneurs running

- `afrequip_odoo_1` (odoo:17) — Up About an hour (healthy)
- `afrequip_postgres_1` (postgres:15) — Up 5 hours (healthy)
- `afrequip_redis_1` (redis:7-alpine) — Up 5 hours (healthy)
- `traefik` (traefik:v2.11) — Up 5 hours

## Clients par version

### 14.0 (6 clients)

- **fime** | filestore: 0.0B | containers: — | secrets clair: 0
- **enzo_industrie** | filestore: 0.0B | containers: — | secrets clair: 0
- **ex_connect** | filestore: 0.0B | containers: — | secrets clair: 0
- **innovation_electrique** | filestore: 0.0B | containers: — | secrets clair: 2
- **specta** | filestore: 7.5MB | containers: — | secrets clair: 2
- **sofilair** | filestore: 0.0B | containers: — | secrets clair: 2

### 17.0 (9 clients)

- **elecap** | filestore: 0.0B | containers: — | secrets clair: 0
- **ibtech** | filestore: 0.0B | containers: — | secrets clair: 0
- **enswork** | filestore: 11.4MB | containers: — | secrets clair: 0
- **aquaplanet** | filestore: 0.0B | containers: — | secrets clair: 0
- **powerone** | filestore: 0.0B | containers: — | secrets clair: 2
- **mecafric** | filestore: 72.5MB | containers: — | secrets clair: 0
- **mecafric_water** | filestore: 0.0B | containers: — | secrets clair: 0
- **maxelec** | filestore: 0.0B | containers: — | secrets clair: 2
- **afrequip** | filestore: 48.3MB | containers: afrequip_odoo_1, afrequip_postgres_1, afrequip_redis_1 | secrets clair: 2

### 19.0 (1 clients)

- **pacadai** | filestore: 0.0B | containers: — | secrets clair: 2

## Modules ENS

### v14 (0 modules)


### v17 (6 modules)

- `custom_reports` v17.0.1.44 — deps: 7
- `custom_sale_invoice` v17.0.1.0.0 — deps: 2
- `ens_crm_task` v17.0.1.1.0 — deps: 3
- `ens_extra` v17.0.1.0.0 — deps: 3
- `ens_reports_print` v17.0.1.0 — deps: 2
- `enswork_config_center` v1.0 — deps: 6

### v19 (0 modules)
