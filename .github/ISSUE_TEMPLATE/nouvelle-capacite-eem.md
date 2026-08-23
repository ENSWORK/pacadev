---
name: "Nouvelle Capacité EEM"
about: "Créer une nouvelle capacité PACADAI selon la méthode EEM"
title: "[EEM] "
labels: ["eem", "service:à-classifier"]
assignees: ["a-bahou"]
---

# 🎯 Titre de la capacité
<!-- Ex: Empêcher une vente non rentable -->

## 🏷️ Classification
- **Service propriétaire :** [Commercial | Finance | Supply Chain | Prospection | Direction]
- **Agent PACADAI concerné :** [ex: Agent Commercial "Le Closer"]
- **Composants transverses mobilisés :** [ex: Rule Engine, Notification Center]

---

## 👁️ ÉTAPE 1 : OBSERVER

### Problème métier
<!-- Décrire le problème en termes métier, sans parler technique -->

### Capacités attendues
<!-- Lister les capacités (pas les solutions) -->

### Périmètre
| ✅ IN | ❌ OUT |
|-------|--------|
| | |

### 🚦 Gate de validation
- [ ] Le problème est clair et quantifiable
- [ ] Le périmètre IN / OUT est défini
- [ ] **FILTRE AI-First :** ✅ OUI / ❌ NON
- [ ] Service propriétaire identifié
- [ ] **Statut : ✅ VALIDÉ pour passer à DÉCIDER**

---

## 🧠 ÉTAPE 2 : DÉCIDER

### ADR à rédiger
<!-- Lister les décisions techniques à prendre -->

### Vérification "Réalité Odoo"
- [ ] Modules OCA existants vérifiés
- [ ] Bonnes pratiques communautaires consultées
- [ ] Limitations techniques Odoo identifiées

### 🚦 Gate de validation
- [ ] Chaque décision a un ADR
- [ ] L'ADR intègre les contraintes réelles d'Odoo
- [ ] ADR UX validé (paramétrage dans Settings Odoo)
- [ ] **Statut : ✅ VALIDÉ pour passer à MODÉLISER**

---

## 📐 ÉTAPE 3 : MODÉLISER

### Diagramme de séquence
<!-- Insérer le diagramme Mermaid -->

### Acteurs et rôles
<!-- Lister les acteurs et leurs responsabilités -->

### Contrat de données (JSON)
<!-- Définir le payload échangé -->

### Règles anti-contournement
<!-- Définir les règles de transition d'état et de révocation -->

### 🚦 Gate de validation
- [ ] Le flux est dessiné
- [ ] Les acteurs et données sont définis
- [ ] Les règles anti-contournement sont intégrées
- [ ] **Statut : ✅ VALIDÉ pour passer à VALIDER**

---

## ✅ ÉTAPE 4 : VALIDER

### Scénarios de test
<!-- Lister les scénarios (Happy Path + Error Path + Contournement) -->

### 🚦 Gate de validation
- [ ] Scénarios Happy Path couverts
- [ ] Au moins 1 scénario de contournement
- [ ] Cas d'erreur avec règles de résilience
- [ ] **Statut : ✅ VALIDÉ pour passer à CONSTRUIRE**

---

## 💻 ÉTAPE 5 : CONSTRUIRE

### Résumé validé pour OpenCode
<!-- Copier-coller le résumé validé par Qwen (ADR + Modèle + Tests) -->

### 🚦 Gate de validation
- [ ] CI/CD PACADEV verte
- [ ] Code respecte les ADR
- [ ] Documentation technique à jour
- [ ] **Statut : ✅ VALIDÉ pour passer à CAPITALISER**

---

## 🚀 ÉTAPE 6 : CAPITALISER

### Retour d'expérience (REX)
<!-- Ce qui a bien/mal fonctionné -->

### Leçons apprises
<!-- Ce qui sera capitalisé dans la Base de Connaissances -->

### 🚦 Gate de validation
- [ ] REX documenté
- [ ] Leçons capitalisées
- [ ] **Statut : ✅ CAPACITÉ LIVRÉE**
