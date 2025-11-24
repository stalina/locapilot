# 🏘️ Locapilot

**Application de gestion locative complète et moderne**

[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Tests](https://img.shields.io/badge/Tests-125%20passing-success)](./package.json)

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

```
src/
├── core/           # Router, stores globaux
├── db/             # IndexedDB (Dexie)
├── features/       # Modules (properties, tenants, leases...)
└── shared/         # Composants UI réutilisables
```

---

## ✅ Tests

**125 tests** : 103 unitaires (Vitest) + 22 E2E (Playwright)

- **Stores** : 58% couverture
- **Composants** : 92% couverture
- **appStore** : 92% couverture

---

## 🛠️ Stack

Vue 3 • TypeScript • Vite • Pinia • Vue Router • Dexie.js • Vitest • Playwright

---

## 📝 License

MIT
