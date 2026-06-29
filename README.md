# 🏘️ Locapilot

**Application de gestion locative complète et moderne**

[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Tests](https://img.shields.io/badge/Tests-173%20passing-success)](./package.json)

---

## 🚀 Aperçu

Locapilot est une **Progressive Web App** moderne pour la gestion complète de biens locatifs. Conçue avec Vue 3, TypeScript et IndexedDB, elle fonctionne **100% hors ligne** et s'installe comme une application native.

### ✨ Fonctionnalités principales

- 🏢 **Gestion de propriétés** - Appartements, maisons, commerces
- 👥 **Gestion de locataires** - Profils, historique, documents
- 📋 **Gestion de baux** - Création, renouvellement, résiliation
- 💰 **Suivi des loyers** - Paiements, retards, quittances
- 📄 **Documents** - Stockage sécurisé (baux, états des lieux)
- 📊 **Tableau de bord** - KPI en temps réel
- 📱 **PWA** - Fonctionne hors ligne, installable

---

## 🔧 Installation

### Prérequis

- Node.js ≥ 18.0
- npm ≥ 9.0

### Étapes

```bash
# Cloner et installer
git clone https://github.com/votre-username/locapilot.git
cd locapilot
npm install

# Lancer en dev
npm run dev  # http://localhost:5173
```

---

## 🎯 Commandes

```bash
# Développement
npm run dev              # Serveur dev (port 5173)
npm run build            # Build production
npm run preview          # Prévisualiser build

# Tests
npm test                 # Tests unitaires
npm run test:coverage    # Couverture
npm run test:e2e         # Tests E2E Playwright

# Qualité
npm run lint             # ESLint
npm run format           # Prettier
npm run type-check       # TypeScript
```

---

## 🏗️ Architecture

> 📖 **Documentation technique détaillée** dans [`docs/`](./docs/README.md) :
> [architecture en couches](./docs/architecture.md), [décisions d'architecture (ADR)](./docs/adr/README.md)
> et [système de migrations Dexie](./docs/migrations-dexie.md).

```
src/
├── core/              # Infrastructure globale
│   ├── components/    # Composants layout (AppLayout, Sidebar)
│   ├── layouts/       # Layouts de pages
│   ├── router/        # Configuration Vue Router
│   ├── store/         # Store Pinia principal (appStore)
│   └── views/         # Vues globales (Dashboard, NotFound)
├── db/                # Couche données IndexedDB
│   ├── database.ts    # Instance Dexie.js
│   ├── schema.ts      # Schéma des tables
│   ├── seed.ts        # Données de démo
│   └── types.ts       # Types TypeScript
├── features/          # Modules métier
│   ├── properties/    # Gestion des propriétés
│   ├── tenants/       # Gestion des locataires
│   ├── leases/        # Gestion des baux
│   ├── rents/         # Suivi des loyers
│   ├── documents/     # Gestion documentaire
│   ├── inventories/   # États des lieux
│   └── settings/      # Paramètres
└── shared/            # Code partagé
    ├── components/    # Composants UI réutilisables
    ├── composables/   # Composables Vue (useNotification, useValidation...)
    ├── styles/        # Styles globaux et variables CSS
    ├── types/         # Types TypeScript partagés
    └── utils/         # Utilitaires (formatters, dateUtils...)
```

### Principes architecturaux

- **Offline-first** : Toutes les données dans IndexedDB, synchronisation future possible
- **Feature-based** : Organisation par fonctionnalité métier (properties, tenants, etc.)
- **Type-safe** : TypeScript strict mode avec zéro `any`
- **Composable-first** : Logique réutilisable via composables Vue
- **Progressive Web App** : Service Worker avec Workbox pour cache offline

### Base de données (IndexedDB via Dexie.js)

Tables principales :

- `properties` - Biens immobiliers avec caractéristiques
- `tenants` - Locataires (actifs et candidats)
- `leases` - Baux avec relations property ↔ tenant
- `rents` - Loyers mensuels avec statuts de paiement
- `documents` - Fichiers avec métadonnées

Relations :

- Un bien peut avoir plusieurs baux successifs
- Un locataire peut avoir plusieurs baux successifs
- Un bail génère automatiquement des loyers mensuels

---

## 🚀 Développement

### Configuration environnement

Le projet utilise les technologies suivantes :

- **Vue 3.5** avec Composition API
- **TypeScript 5.9** en mode strict
- **Vite 7.2** pour le build et HMR
- **Pinia** pour la gestion d'état
- **Vue Router** pour la navigation
- **Dexie.js** pour IndexedDB
- **Vitest** pour les tests unitaires
- **Playwright** pour les tests E2E

### Structure d'un feature module

Chaque feature (properties, tenants, etc.) suit cette structure :

```
features/properties/
├── views/              # Vues (liste, détail)
├── components/         # Composants spécifiques
├── stores/             # Store Pinia du module
└── types/              # Types TypeScript du module
```

### Composables disponibles

- `useNotification` - Système de notifications toast
- `useConfirm` - Dialogues de confirmation
- `useValidation` - Validation de formulaires
- `useFormatter` - Formatage dates, nombres, devises
- `useExport` - Export JSON/CSV
- `useImport` - Import JSON/CSV

---

## 📱 Installation PWA

L'application peut être installée sur desktop et mobile :

1. **Desktop** : Ouvrir dans Chrome/Edge, cliquer sur l'icône d'installation dans la barre d'adresse
2. **iOS** : Safari > Partager > Ajouter à l'écran d'accueil
3. **Android** : Chrome > Menu > Installer l'application

Une fois installée, Locapilot fonctionne **100% hors ligne** avec toutes les données locales.

---

## ✅ Tests

**173 tests** : 151 unitaires (Vitest) + 22 E2E (Playwright)

- **Couverture globale** : 84% statements
- **Stores** : 70-100% couverture
- **Composants** : 92% couverture
- **appStore** : 92% couverture

---

## 🛠️ Stack

Vue 3 • TypeScript • Vite • Pinia • Vue Router • Dexie.js • Vitest • Playwright

---

## 📝 License

MIT
