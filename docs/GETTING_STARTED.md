# Guide de Démarrage - Locapilot

Bienvenue dans Locapilot ! Ce guide vous accompagne pour vos premiers pas dans l'application.

---

## Table des matières

1. [Installation](#1-installation)
2. [Premier lancement](#2-premier-lancement)
3. [Ajouter votre première propriété](#3-ajouter-votre-première-propriété)
4. [Ajouter un locataire](#4-ajouter-un-locataire)
5. [Créer un bail](#5-créer-un-bail)
6. [Gérer les loyers](#6-gérer-les-loyers)
7. [Uploader des documents](#7-uploader-des-documents)
8. [Exporter vos données](#8-exporter-vos-données)
9. [Conseils d'utilisation](#9-conseils-dutilisation)

---

## 1. Installation

Si vous n'avez pas encore installé Locapilot, consultez le [Guide d'Installation](./INSTALLATION.md).

**Résumé rapide** :

- **Ordinateur** : Ouvrez l'app dans Chrome/Edge → Cliquez sur l'icône d'installation ⊕
- **Android** : Ouvrez dans Chrome → "Ajouter à l'écran d'accueil"
- **iOS** : Ouvrez dans Safari → Bouton Partager → "Sur l'écran d'accueil"

---

## 2. Premier lancement

### Écran d'accueil (Dashboard)

Au premier lancement, l'application affiche le **tableau de bord** avec des données de démonstration :

```
┌─────────────────────────────────────────────┐
│  Dashboard                                  │
│                                             │
│  📊 Vue d'ensemble                          │
│  ┌────────────┬────────────┬────────────┐  │
│  │ Propriétés │ Locataires │   Loyers   │  │
│  │     4      │     6      │  3 200 €   │  │
│  └────────────┴────────────┴────────────┘  │
│                                             │
│  💰 Loyers ce mois : 3 200 €                │
│  ⏳ En attente : 1 200 €                    │
│  ✅ Payés : 2 000 €                         │
│                                             │
│  📋 Dernières activités                     │
│  • Loyer payé - Appartement Paris (...)    │
│  • Nouveau bail - Maison Lyon (...)         │
└─────────────────────────────────────────────┘
```

### Navigation

La **barre latérale gauche** permet de naviguer :

- 🏠 **Dashboard** - Vue d'ensemble
- 🏢 **Propriétés** - Gestion de vos biens
- 👤 **Locataires** - Gestion locataires et candidats
- 📄 **Baux** - Gestion des contrats de location
- 💰 **Loyers** - Suivi des paiements
- 📁 **Documents** - Fichiers uploadés
- ⚙️ **Paramètres** - Configuration

---

## 3. Ajouter votre première propriété

### Étapes

1. **Cliquez sur "Propriétés"** dans la barre latérale

2. **Cliquez sur "+ Nouvelle propriété"** (bouton en haut à droite)

3. **Remplissez le formulaire** :

   **Informations générales** :
   - **Nom** : Nom descriptif (ex: "Appartement 3 pièces Paris 15")
   - **Adresse** : Adresse complète
   - **Type** : Appartement, Maison, Commercial, Parking, Autre

   **Caractéristiques** :
   - **Surface** : Surface en m² (ex: 65)
   - **Nombre de pièces** : Total de pièces (ex: 3)
   - **Chambres** (optionnel) : Nombre de chambres (ex: 2)
   - **Salles de bain** (optionnel) : Nombre de SDB (ex: 1)

   **Loyer** :
   - **Loyer mensuel** : Montant en € (ex: 1200)
   - **Charges** (optionnel) : Charges en € (ex: 100)
   - **Dépôt de garantie** (optionnel) : Caution en € (ex: 2400)

   **Statut** :
   - **Vacant** : Disponible à la location
   - **Occupé** : Actuellement loué
   - **Maintenance** : En travaux

   **Description** (optionnel) :
   - Description libre, équipements, etc.

   **Équipements** (optionnel) :
   - Parking, Balcon, Cave, Ascenseur, etc.

4. **Cliquez sur "Enregistrer"**

✅ Votre première propriété est créée !

### Aperçu de la propriété

Vous êtes redirigé vers la **page de détail** de la propriété :

```
┌─────────────────────────────────────────────┐
│  Appartement 3 pièces Paris 15              │
│  15 rue de Vaugirard, 75015 Paris           │
│                                             │
│  📊 Informations                            │
│  • Type : Appartement                       │
│  • Surface : 65 m²                          │
│  • Pièces : 3 | Chambres : 2 | SDB : 1     │
│  • Loyer : 1 200 € + 100 € charges          │
│  • Statut : Vacant 🟢                       │
│                                             │
│  📄 Bail actuel : Aucun                     │
│  👤 Locataire : -                           │
│                                             │
│  [Modifier] [Créer un bail] [Supprimer]    │
└─────────────────────────────────────────────┘
```

---

## 4. Ajouter un locataire

### Étapes

1. **Cliquez sur "Locataires"** dans la barre latérale

2. **Cliquez sur "+ Nouveau locataire"**

3. **Remplissez le formulaire** :

   **Informations personnelles** :
   - **Prénom** : (ex: Jean)
   - **Nom** : (ex: Dupont)
   - **Email** : (ex: jean.dupont@email.com)
   - **Téléphone** : (ex: 06 12 34 56 78)

   **Statut** :
   - **Candidat** : En recherche de logement
   - **Actif** : Locataire sous bail
   - **Ancien** : Ancien locataire

   **Informations complémentaires** (optionnels) :
   - **Date de naissance** : (ex: 1990-05-15)
   - **Profession** : (ex: Ingénieur)
   - **Revenus mensuels** : En € (ex: 3000)
   - **Notes** : Notes libres

4. **Cliquez sur "Enregistrer"**

✅ Le locataire est créé avec le statut **"Candidat"**

### Conversion Candidat → Locataire actif

Lorsque vous créez un **bail** pour ce candidat, il sera automatiquement converti en **"Locataire actif"**.

---

## 5. Créer un bail

### Prérequis

- ✅ Au moins **1 propriété** créée
- ✅ Au moins **1 locataire** (statut Candidat ou Actif)

### Étapes

1. **Option A** : Depuis la **page de la propriété** → Bouton "Créer un bail"

   **Option B** : Cliquez sur "Baux" dans la barre latérale → "+ Nouveau bail"

2. **Remplissez le formulaire** :

   **Propriété et locataires** :
   - **Propriété** : Sélectionnez la propriété (ex: Appartement Paris 15)
   - **Locataire(s)** : Sélectionnez un ou plusieurs locataires (co-location possible)

   **Période** :
   - **Date de début** : Date d'entrée (ex: 2025-12-01)
   - **Date de fin** (optionnel) : Laissez vide pour bail indéterminé

   **Loyer** :
   - **Loyer mensuel** : En € (ex: 1200)
   - **Charges** (optionnel) : En € (ex: 100)
   - **Dépôt de garantie** : Caution en € (ex: 2400)
   - **Jour de paiement** : Jour du mois (1-31, ex: 5)

   **Type de bail** :
   - **Résidentiel** : Logement principal (3 ans minimum)
   - **Meublé** : Logement meublé (1 an minimum)
   - **Commercial** : Local commercial
   - **Saisonnier** : Location courte durée

   **Notes** (optionnel) :
   - Clauses particulières, informations complémentaires

3. **Cliquez sur "Enregistrer"**

✅ Le bail est créé !

### Effets automatiques

Lors de la création du bail :

1. **Propriété** → Statut passe à **"Occupé"** 🔴
2. **Candidat(s)** → Statut passe à **"Locataire actif"** ✅
3. **Loyers** → Proposition de générer les loyers mensuels

---

## 6. Gérer les loyers

### Générer les loyers

Après création d'un bail :

1. **Cliquez sur "Loyers"** dans la barre latérale

2. **Cliquez sur "Générer les loyers"** pour le bail concerné

3. **Paramètres** :
   - **Mois de début** : (ex: 2025-12)
   - **Nombre de mois** : (ex: 12 pour 1 an)

4. **Cliquez sur "Générer"**

✅ Les loyers mensuels sont créés avec le statut **"En attente"**

### Marquer un loyer comme payé

1. **Cliquez sur "Loyers"** dans la barre latérale

2. **Trouvez le loyer** à marquer comme payé

3. **Cliquez sur "Marquer payé"** (icône ✓)

4. **Remplissez** :
   - **Date de paiement** : (ex: 2025-12-05)
   - **Méthode** : Virement, Chèque, Espèces, Carte

5. **Cliquez sur "Valider"**

✅ Le loyer passe au statut **"Payé"** 💚

### Calendrier des loyers

La page **Loyers** affiche un calendrier mensuel :

```
┌─────────────────────────────────────────────┐
│  Loyers - Décembre 2025                     │
│                                             │
│  📊 Résumé du mois                          │
│  • Total : 3 200 €                          │
│  • Payés : 2 000 € (62%)                    │
│  • En attente : 1 200 € (38%)               │
│                                             │
│  📋 Liste des loyers                        │
│  ┌──────────────────────────────────────┐  │
│  │ Appartement Paris 15                 │  │
│  │ Jean Dupont                          │  │
│  │ 1 200 € + 100 € charges = 1 300 €   │  │
│  │ ⏳ En attente  [Marquer payé ✓]     │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ Maison Lyon                          │  │
│  │ Marie Martin                         │  │
│  │ 900 € charges incluses               │  │
│  │ ✅ Payé le 03/12/2025 (Virement)    │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Loyers en retard

Les loyers **en attente** dont le mois est dépassé apparaissent en **rouge** 🔴.

**Filtres disponibles** :

- Tous les loyers
- En attente
- Payés
- En retard

---

## 7. Uploader des documents

### Ajouter un document

1. **Cliquez sur "Documents"** dans la barre latérale

2. **Cliquez sur "+ Nouveau document"**

3. **Remplissez** :
   - **Nom** : Nom du document (ex: "Bail Dupont 2025")
   - **Catégorie** :
     - Bail
     - Facture
     - Reçu
     - Pièce d'identité
     - Fiche de paie
     - État des lieux
     - Autre
   - **Lié à** (optionnel) : Sélectionnez l'entité liée
     - Propriété
     - Locataire
     - Bail
     - Loyer

4. **Sélectionnez le fichier** : Cliquez sur "Parcourir" ou glissez-déposez

   **Formats acceptés** : PDF, JPG, PNG, DOCX, etc.

5. **Cliquez sur "Uploader"**

✅ Le document est uploadé et stocké **localement** sur votre appareil

### Consulter un document

1. **Cliquez sur "Documents"**

2. **Filtrez** par catégorie ou entité si besoin

3. **Cliquez sur le document** pour le visualiser ou télécharger

### Documents liés

Sur la page d'une propriété, locataire, ou bail, vous pouvez voir les **documents liés** et en ajouter directement.

---

## 8. Exporter vos données

### Pourquoi exporter ?

✅ **Sauvegarde de sécurité** : Protégez vos données  
✅ **Transfert** : Utiliser sur un autre appareil  
✅ **Archivage** : Conserver un historique

### Étapes

1. **Cliquez sur "Paramètres"** (⚙️) dans la barre latérale

2. **Section "Données"** → **"Exporter les données"**

3. **Un fichier JSON est téléchargé** : `locapilot-backup-YYYY-MM-DD.json`

4. **Conservez ce fichier** en lieu sûr :
   - Cloud (Google Drive, Dropbox, iCloud)
   - Clé USB
   - Disque dur externe
   - Email à vous-même

### Importer des données

Pour restaurer une sauvegarde :

1. **Paramètres** → **"Importer les données"**

2. **Sélectionnez** le fichier `.json`

3. **Confirmez** l'import

⚠️ **Attention** : L'import **remplace toutes les données actuelles**

---

## 9. Conseils d'utilisation

### ✅ Bonnes pratiques

1. **Exportez régulièrement vos données** (1x/semaine recommandé)
   - Paramètres → Exporter les données
   - Stockez dans le cloud et local

2. **Utilisez des noms descriptifs**
   - Propriétés : "Appartement 3P Paris 15 - 15 rue Vaugirard"
   - Baux : Nom par défaut (Propriété + Locataire)

3. **Remplissez les champs optionnels utiles**
   - Numéros de téléphone
   - Emails
   - Caractéristiques des propriétés (chambres, SDB)

4. **Générez les loyers en avance**
   - Créez 12 mois de loyers d'un coup
   - Marquez-les payés au fur et à mesure

5. **Uploadez les documents importants**
   - Baux signés
   - Inventaires
   - Pièces d'identité (stockage local sécurisé)

### ⚠️ Limitations à connaître

1. **Pas de synchronisation automatique**
   - Les données ne sont pas synchronisées entre appareils
   - Utilisez Export/Import pour transférer

2. **Stockage local uniquement**
   - Toutes les données restent sur votre appareil
   - Pas de backup cloud automatique

3. **iOS : Données peuvent être supprimées**
   - Si l'app n'est pas ouverte pendant 7+ jours
   - **Solution** : Ouvrez régulièrement ou exportez fréquemment

4. **Quota navigateur**
   - Limité à ~50% de l'espace disque disponible
   - Rarement un problème sauf milliers de documents lourds

### 🚀 Workflow recommandé

**Configuration initiale** :

1. ✅ Installer l'app sur votre appareil principal
2. ✅ Ajouter toutes vos propriétés
3. ✅ Ajouter tous vos locataires (actifs et candidats)
4. ✅ Créer les baux actifs
5. ✅ Générer les loyers pour 12 mois
6. ✅ Uploader les baux signés
7. ✅ **Exporter les données** (première sauvegarde)

**Utilisation quotidienne** :

1. ✅ Ouvrir l'app
2. ✅ Marquer les loyers payés quand reçus
3. ✅ Ajouter nouveaux candidats si besoin
4. ✅ Créer nouveaux baux si signature

**Maintenance hebdomadaire** :

1. ✅ Vérifier les loyers en retard
2. ✅ Contacter locataires si impayés
3. ✅ **Exporter les données** (sauvegarde)

**Maintenance mensuelle** :

1. ✅ Consulter le dashboard (vue d'ensemble)
2. ✅ Vérifier les baux arrivant à échéance
3. ✅ Archiver les documents du mois précédent

---

## Workflow complet : Exemple

### Scénario : Nouvelle location

**Contexte** : Vous avez un appartement vacant et un nouveau candidat.

**Étapes** :

1. **Ajouter le candidat** (Locataires → + Nouveau)
   - Prénom : Marie
   - Nom : Martin
   - Email : marie.martin@email.com
   - Téléphone : 06 98 76 54 32
   - Statut : **Candidat**
   - Revenus : 2500 €

2. **Créer le bail** (Baux → + Nouveau bail)
   - Propriété : Appartement Paris 15
   - Locataire : Marie Martin
   - Date de début : 2026-01-01
   - Loyer : 1200 €
   - Charges : 100 €
   - Dépôt : 2400 €
   - Jour de paiement : 5
   - Type : Résidentiel

   → **Enregistrer**

3. **Effets automatiques** :
   - ✅ Marie Martin → Statut **"Actif"**
   - ✅ Appartement Paris 15 → Statut **"Occupé"**

4. **Générer les loyers** (Loyers → Générer)
   - Bail : Marie Martin - Appartement Paris 15
   - Mois de début : 2026-01
   - Nombre de mois : 12

   → **Générer**

5. **Uploader le bail signé** (Documents → + Nouveau)
   - Nom : Bail Martin 2026
   - Catégorie : Bail
   - Lié à : Bail (Marie Martin - Appartement Paris 15)
   - Fichier : bail-martin-signe.pdf

   → **Uploader**

6. **Premier paiement reçu** (Loyers → Janvier 2026)
   - Cliquer sur **"Marquer payé"**
   - Date : 2026-01-05
   - Méthode : Virement

   → **Valider**

7. **Exporter les données** (Paramètres → Exporter)
   - Fichier téléchargé : `locapilot-backup-2026-01-05.json`
   - Sauvegarder dans Google Drive

✅ **Nouvelle location complète !**

---

## Raccourcis clavier (Desktop)

| Raccourci  | Action                  |
| ---------- | ----------------------- |
| `Ctrl + N` | Nouveau (selon la page) |
| `Ctrl + S` | Enregistrer formulaire  |
| `Ctrl + E` | Exporter données        |
| `Esc`      | Fermer modal            |
| `/`        | Focus recherche         |

---

## Prochaines étapes

Maintenant que vous maîtrisez les bases :

1. **Explorez le Dashboard** 📊
   - Vue d'ensemble des loyers
   - Statistiques propriétés
   - Activités récentes

2. **Consultez la FAQ** ❓
   - [FAQ.md](./FAQ.md) (questions fréquentes)

3. **Personnalisez les paramètres** ⚙️
   - Thème (clair/sombre)
   - Format de date
   - Langue

4. **Contribuez au projet** 🚀
   - [CONTRIBUTING.md](../CONTRIBUTING.md) (open-source)
   - Suggérez des fonctionnalités
   - Signalez des bugs

---

## Support

### Besoin d'aide ?

- 📧 **Email** : support@locapilot.app
- 🐛 **Bug** : [GitHub Issues](https://github.com/stalina/locapilot/issues)
- 💬 **Discussion** : [GitHub Discussions](https://github.com/stalina/locapilot/discussions)

---

**Bon usage de Locapilot !** 🎉

---

**Dernière mise à jour** : 27 novembre 2025
