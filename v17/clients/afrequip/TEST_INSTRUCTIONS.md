# Afrequip - Test Instructions

## 🚀 Lancer l'environnement de test Odoo 17

### Prérequis
- Docker et Docker Compose installés
- Port 8070 disponible (Odoo)
- Port 5433 disponible (PostgreSQL)
- Port 6380 disponible (Redis)

### Étapes de lancement

```bash
# 1. Aller dans le répertoire Afrequip
cd /home/pacadev/pacadev/v17/clients/afrequip

# 2. Lancer les services
docker-compose -f docker-compose.dev.yml up -d

# 3. Attendre que les services soient prêts (30-60 secondes)
docker-compose -f docker-compose.dev.yml ps

# 4. Vérifier les logs
docker-compose -f docker-compose.dev.yml logs -f odoo
```

### Accès Odoo

**URL**: http://localhost:8070/web/

**Credentials**:
- Admin: admin
- Password: (laissé vide à la première connexion)

---

## 🧪 Tester le Module Partner Statement Report

### 1. Accéder à Odoo

```
http://localhost:8070/web/
```

### 2. Activer le mode développeur

Menu → Settings → Activate Developer Mode

### 3. Installer le module

Apps → Search "Partner Statement Report" → Install

**Ou via ligne de commande**:
```bash
docker exec afrequip_odoo odoo -c /odoo.conf -u partner_statement_report --stop-after-init
```

### 4. Tester MOD 1: Traduction FR

**Expected**: Tous les labels en français
- Menu: "Déclaration de compte" ✅
- Rapports: "Déclaration d'Activité" ✅
- Colonnes: "Montant", "Solde", "Date Échéance" ✅

### 5. Tester MOD 2: Custom Header/Footer

**Expected**: En-tête personnalisé Afrequip
- Si custom_reports module existe: header appliqué ✅
- Sinon: fallback à web.external_layout ✅

### 6. Tester MOD 3: Devise supprimée sur lignes

**Steps**:
1. Aller dans Accounting → Partner Statement Report
2. Générer un rapport pour un client
3. Vérifier le PDF

**Expected**:
- Lignes: pas de devise affichée ❌ USD
- Totaux: devise affichée ✅ USD

### 7. Tester MOD 4: Colonne Date Échéance

**Steps**:
1. Générer un rapport "Outstanding" ou "Activity"
2. Vérifier le tableau

**Expected**:
- Nouvelle colonne: "Date Échéance" ✅
- Valeurs: dates des factures ✅
- Si NULL: affiche "-" ✅

### 8. Tester MOD 5: Champ ICE

**Steps**:
1. Ajouter un partenaire avec champ ICE
2. Générer un rapport pour ce partenaire
3. Vérifier l'en-tête du rapport

**Expected**:
- Si partenaire a ICE: "ICE: MA123456789" ✅
- Si partenaire sans ICE: pas affiché ✅

---

## 📝 Test Checklist

### Module Installation
- [ ] Module installé sans erreur
- [ ] Aucune dépendance manquante

### MOD 1: French Translation
- [ ] Menu et labels en français
- [ ] Rapports générés en français
- [ ] Colonnes traduites

### MOD 2: Custom Layout
- [ ] Template custom_reports utilisé
- [ ] En-tête personnalisé appliqué

### MOD 3: Currency
- [ ] Devise supprimée des lignes
- [ ] Devise conservée sur totaux

### MOD 4: Due Date
- [ ] Colonne "Date Échéance" présente
- [ ] Dates affichées correctement
- [ ] Fallback "-" si NULL

### MOD 5: ICE Field
- [ ] ICE affiché si présent
- [ ] ICE pas affiché si absent
- [ ] Format correct "ICE: {value}"

### PDF Rendering
- [ ] PDF généré sans erreur
- [ ] Formatage correct
- [ ] Toutes modifications visibles

---

## 🔧 Dépannage

### Module non trouvé
```bash
# Vérifier que le module est dans le bon chemin
docker exec afrequip_odoo ls -la /mnt/extra-addons/ens_core_shared/partner_statement_report/

# Mettre à jour la liste des modules
curl http://localhost:8070/web/environment/
```

### Erreur dans le rapport
```bash
# Vérifier les logs Odoo
docker-compose -f docker-compose.dev.yml logs odoo | tail -100
```

### Erreur Python
```bash
# Vérifier la syntaxe
docker exec afrequip_odoo python3 -m py_compile /mnt/extra-addons/custom/partner_statement_report/report/partner_statement_details.py
```

### Erreur XML
```bash
# Vérifier le XML
docker exec afrequip_odoo python3 << 'EOF'
import xml.etree.ElementTree as ET
ET.parse('/mnt/extra-addons/custom/partner_statement_report/report/partner_statement_report_pdf.xml')
print("✅ XML OK")
EOF
```

---

## 🛑 Arrêter l'environnement

```bash
docker-compose -f docker-compose.dev.yml down

# Supprimer les volumes (données)
docker-compose -f docker-compose.dev.yml down -v
```

---

## 📊 Accès aux données

### Base de données PostgreSQL
```bash
# Connexion directe
psql -h localhost -p 5433 -U odoo -d afrequip_dev

# Ou via Docker
docker exec -it afrequip_postgres psql -U odoo -d afrequip_dev
```

### Données Odoo
```bash
# Volume odoo_data
docker volume inspect afrequip_odoo_data
```

---

## ✅ Test Report

Créer un rapport final:

```
Module: partner_statement_report
Date: [YYYY-MM-DD]
Tested by: [name]

MOD 1 - French Translation: [ ] PASS [ ] FAIL
MOD 2 - Custom Layout: [ ] PASS [ ] FAIL
MOD 3 - Currency: [ ] PASS [ ] FAIL
MOD 4 - Due Date: [ ] PASS [ ] FAIL
MOD 5 - ICE Field: [ ] PASS [ ] FAIL
PDF Rendering: [ ] PASS [ ] FAIL

Overall: [ ] SUCCESS [ ] FAILED

Notes:
```

---

**Besoin d'aide?**

Si tu as des erreurs, partage:
1. Les logs Odoo: `docker-compose logs odoo`
2. La version Odoo: `http://localhost:8070/web/about`
3. Le module installé: Apps → Partner Statement Report
