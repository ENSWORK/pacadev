# Partner Statement Report — Maintenance & Upgrades

**Module:** `partner_statement_report`  
**Version actuelle:** 17.0.1.0.1  
**Client:** Afrequip  
**Dernière modif:** 2026-05-14

---

## Procédure Standard : Mise à jour du Module

Après toute modification du module (XML, Python, etc.), appliquer cette procédure :

### **Étape 1 — Incrémenter la version**

Éditer `/addons/oca/partner_statement_report/__manifest__.py` :
```python
'version': '17.0.1.0.1',  # Patch : bugfix/amélioration mineure
'version': '17.0.1.1.0',  # Minor : nouvelle feature
'version': '17.0.2.0.0',  # Major : breaking change
```

### **Étape 2 — Upgrade module + Clear cache Odoo**

```bash
cd /home/abdelali/pacadev/v17/clients/afrequip
docker exec afrequip_odoo_1 odoo -c /odoo.conf -d afr -u partner_statement_report --stop-after-init
```

**Vérifier :** Le module se charge sans erreur (`Module partner_statement_report loaded in X.XXs`)

### **Étape 3 — Redémarrer Odoo**

```bash
# Tue le processus Odoo et le relance
docker exec afrequip_odoo_1 pkill -f odoo
sleep 5
docker-compose -f docker-compose.dev.yml start odoo
sleep 8
docker logs afrequip_odoo_1 --tail 5
```

Vérifier : `HTTP service (werkzeug) running on...` ✅

---

## Historique des versions

| Version | Date | Changements |
|---------|------|------------|
| 17.0.1.0.1 | 2026-05-14 | MOD1-5 : labels FR, due_date, devise totaux, ICE field |
| 17.0.1.0.0 | 2026-05-13 | Version initiale production |

---

## Modules modifiés

- `report/partner_statement_details.py` — Ajout `due_date`, `partner_ice`
- `report/partner_statement_report_pdf.xml` — Labels français, devise, colonnes
- `__manifest__.py` — Version bumped

---

## Testing après modification

1. Login http://localhost:8070 → base `afr`
2. Menu **Comptabilité** → **Partner Statement Report**
3. Générer un rapport sur un partenaire avec factures
4. Vérifier :
   - ✅ Labels en français
   - ✅ Colonne "Date Échéance" présente
   - ✅ Devise uniquement sur totaux
   - ✅ ICE affiché (si partenaire en a un)

---

## Notes

- **Hot-reload :** Pas d'impact sur le container via bind mount — c'est l'Odoo qui doit recharger
- **Cache :** Incremented version force Odoo à tout recalculer (views, templates, bytecode)
- **DB:** Les modifications ne touchent que `afr` — autres bases non affectées
