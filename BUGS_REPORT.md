# Rapport de Bugs - Locapilot

**Date**: 25 novembre 2025  
**Méthode**: Test manuel via Playwright MCP sur http://localhost:5173/  
**Testeur**: Assistant IA avec validation utilisateur

---

## 🚨 Bugs Critiques (Bloquants)

### 1. TenantsView - Erreur Runtime Fatale

**Priorité**: P0 - CRITIQUE  
**Statut**: 🔴 Page inaccessible

**Description**:  
La page `/tenants` crash complètement avec une erreur JavaScript.

**Erreur Console**:
```
[Vue warn]: Unhandled error during execution of render function 
TypeError: Cannot read properties of undefined (reading 'length')
    at Proxy._sfc_render (http://localhost:5173/...)
```

**Impact**:
- Impossible d'accéder à la liste des locataires
- Impossible de créer/modifier/voir les locataires
- Bloque toute la fonctionnalité "Tenants"

**À Investiguer**:
- Vérifier l'accès aux données du store `tenantsStore`
- Vérifier si `tenants` est bien initialisé comme tableau
- Vérifier le template de `TenantsView.vue`

---

### 2. PropertyFormModal - Édition Non Fonctionnelle

**Priorité**: P1 - HAUTE  
**Statut**: 🟠 Partiellement fonctionnel

**Description**:  
Le bouton "Modifier" sur PropertyDetailView log en console mais ne déclenche pas l'ouverture du modal.

**Étapes pour reproduire**:
1. Aller sur `/properties`
2. Cliquer sur une propriété (ex: "12 Rue Victor Hugo")
3. Cliquer sur "Modifier"
4. Observer: console.log visible mais modal ne s'ouvre pas

**Console Log**:
```
Edit property 4
```

**Impact**:
- Création de propriété fonctionne ✅
- Édition de propriété ne fonctionne pas ❌
- Impossible de modifier une propriété existante

**À Investiguer**:
- Vérifier le binding v-model du modal
- Vérifier la gestion de l'état `showEditModal`
- Vérifier le passage de l'ID de propriété au modal

---

## 🟡 Bugs Importants (Non Bloquants)

### 3. Prix des Propriétés - Affichage "NaN €/mois"

**Priorité**: P2 - MOYENNE  
**Statut**: 🟡 Dégradation visuelle

**Description**:  
Toutes les cartes de propriétés affichent "NaN €/mois" au lieu du prix réel.

**Où**: 
- `/properties` - Toutes les PropertyCard

**Données Réelles** (exemple):
- 12 Rue Victor Hugo: Loyer mensuel 2 800 € (visible dans le détail)
- Mais affiché: "NaN €/mois" sur la carte

**Impact**:
- Informations visuelles incorrectes
- UX dégradée mais fonctionnalité principale OK

**À Investiguer**:
- Vérifier le mapping `property.rent` vs `property.rentAmount` ou similaire
- Vérifier le type des données (string vs number)
- Vérifier le calcul dans `PropertyCard.vue`

---

### 4. Loyers des Baux - Tous à "0 €"

**Priorité**: P2 - MOYENNE  
**Statut**: 🟡 Données incorrectes

**Description**:  
Tous les baux affichent "Loyer: 0 €" alors que les propriétés associées ont des loyers définis.

**Où**: 
- `/leases` - Tous les LeaseCard

**Exemple**:
- Bail "123 Rue de la Paix": Loyer 0 €, Charges 150 €, Total 150 €/mois
- Propriété associée a un loyer de 1 250 €

**Impact**:
- Informations financières incorrectes
- Calculs de revenus faussés

**À Investiguer**:
- Vérifier la relation entre `leases` et `properties`
- Vérifier si le loyer est copié du bail ou de la propriété
- Vérifier le schéma de la table `leases` dans Dexie

---

## ⚪ Fonctionnalités Incomplètes

### 5. RentsCalendarView - Stub "En construction"

**Priorité**: P2 - MOYENNE  
**Statut**: ⚪ Non implémenté

**Description**:  
La page `/rents` affiche uniquement "Page rents - En construction".

**Impact**:
- Fonctionnalité calendrier des loyers absente
- Modal paiement loyer non implémenté
- Pas de suivi des paiements

**Action**:
- Implémenter le calendrier
- Implémenter le modal de paiement
- Implémenter le suivi des paiements

---

## ✅ Tests Réussis (Pour référence)

### Fonctionnalités Validées
1. **Dashboard** (`/`) - ✅ Affichage KPIs, activité récente, navigation
2. **Liste Propriétés** (`/properties`) - ✅ Affichage, filtres, recherche
3. **Détail Propriété** (`/properties/:id`) - ✅ Navigation, affichage infos
4. **Modal Création Propriété** - ✅ Ouverture, formulaire complet
5. **Liste Baux** (`/leases`) - ✅ Affichage 3 baux, statuts, infos
6. **Documents** (`/documents`) - ✅ Page vide, zone drop, compteurs
7. **Settings** (`/settings`) - ✅ Export/Import, PWA, effacer données

### Limitations de Validation
- Fonctionnalités de détail/édition non testées pour Tenants (page cassée)
- Fonctionnalités de détail/édition non testées pour Leases (bloqué par temps)
- Upload/Download réels de documents non testés
- Relations entre entités non visibles (données seed potentiellement incomplètes)

---

## 📋 Plan d'Action Recommandé

### Phase 1 - Bugs Critiques (Immédiat)
1. [ ] Corriger TenantsView (erreur `.length`)
2. [ ] Corriger modal d'édition PropertyFormModal
3. [ ] Corriger affichage prix des propriétés (NaN)

### Phase 2 - Bugs Importants (Court terme)
4. [ ] Corriger loyers des baux (0 €)
5. [ ] Implémenter RentsCalendarView

### Phase 3 - Validation Complète (Moyen terme)
6. [ ] Tester toutes les fonctionnalités CRUD Tenants
7. [ ] Tester toutes les fonctionnalités CRUD Leases
8. [ ] Tester upload/download documents
9. [ ] Valider relations entre entités
10. [ ] Tester export/import données

### Phase 4 - Tests E2E Automatisés
11. [ ] Créer tests E2E Playwright pour tous les CRUD
12. [ ] Créer tests E2E pour les relations
13. [ ] Créer tests E2E pour les documents

---

## 🔍 Méthodologie de Test Utilisée

**Outil**: MCP Playwright  
**Approche**: Navigation manuelle guidée par IA  
**Couverture**:
- ✅ Navigation principale
- ✅ Affichage des pages
- ✅ Ouverture des modals de création
- ⚠️ Édition limitée (bloqué par bugs)
- ⚠️ Actions CRUD partielles

**Prochaines Étapes de Test**:
- Ajouter tests E2E automatisés
- Tester en mode offline (PWA)
- Tester sur différents navigateurs
- Tester sur mobile (responsive)
