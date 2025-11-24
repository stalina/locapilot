# Locapilot 🏠

**Application de gestion locative offline-first moderne et créative**

Vue.js 3 + TypeScript + Dexie.js + Design System moderne

---

## 🎨 Design System

L'application utilise un design system cohérent avec :
- **Gradient Primary** : #4f46e5 → #4338ca (bleu/violet)
- **Accent Teal** : #14b8a6
- **Typographie** : Inter (weights 300-800)
- **130+ CSS Variables** pour theming
- **Composants réutilisables** : Button, Badge, Card, StatCard...

📖 **Voir les maquettes** : [/mockups/index.html](./mockups/index.html)

---

## ✨ Fonctionnalités Actuelles

### ✅ Tableau de bord moderne
- 4 KPI cards dynamiques (propriétés, occupation, revenus, loyers en attente)
- Timeline d'activité récente
- Événements à venir
- Sidebar navigation avec gradient

### ✅ Base de données IndexedDB
- Dexie.js pour stockage offline
- 8 tables (properties, tenants, leases, rents, documents, inventories, payments, activities)
- Seed automatique avec données de test (5 propriétés, 3 locataires, 9 loyers)

### ✅ Design System complet
- Variables CSS centralisées
- Composants Vue réutilisables
- Typographie cohérente
- Système d'espacement (4px scale)
- 5 niveaux d'ombres

---

## 🚀 Démarrage Rapide

```bash
# Installation
npm install

# Développement
npm run dev

# Build production
npm run build

# Preview build
npm run preview

# Tests
npm run test

# Lint
npm run lint
```

L'application sera disponible sur `http://localhost:5173/`

---

## 📁 Structure du Projet

```
src/
├── assets/
│   └── styles/           # Variables CSS + styles globaux
├── core/
│   ├── layouts/          # AppLayout (sidebar)
│   ├── router/           # Vue Router config
│   └── store/            # Pinia stores (app, ...)
├── db/
│   ├── schema.ts         # Dexie database schema (8 tables)
│   └── seed.ts           # Données de test
├── features/
│   ├── dashboard/        # ✅ Vue tableau de bord (KPI + activité)
│   ├── properties/       # 🚧 Gestion propriétés
│   ├── tenants/          # 🚧 Gestion locataires
│   ├── leases/           # 🚧 Gestion baux
│   ├── rents/            # 🚧 Calendrier loyers
│   └── documents/        # 🚧 Bibliothèque documents
└── shared/
    └── components/       # Button, Badge, Card, StatCard...
```

---

## 🎯 Prochaines Étapes

### Phase 1 : Composants
- [ ] Input component (validation)
- [ ] SearchBox component (debounce)
- [ ] PropertyCard, TenantCard, DocumentCard
- [ ] Calendar component

### Phase 2 : Vues
- [ ] PropertiesListView (grid + filtres)
- [ ] PropertyDetailView (2-column layout)
- [ ] TenantsListView (cards)
- [ ] RentsCalendarView (calendar)
- [ ] DocumentsView (upload + grid)

### Phase 3 : Data Layer
- [ ] Stores Pinia (properties, tenants, leases, rents, documents)
- [ ] Composables (useProperty, useTenant, useRent...)
- [ ] Services (CRUD operations)

### Phase 4 : Features
- [ ] Paiements loyers (logique overdue)
- [ ] Upload/download documents (IndexedDB blobs)
- [ ] États des lieux (inventories)
- [ ] Génération quittances PDF

---

## 🛠️ Stack Technique

- **Frontend** : Vue.js 3.5.24 + TypeScript 5.9.3
- **Build Tool** : Vite 7.2.4
- **State** : Pinia 3.0.4
- **Database** : Dexie.js 4.2.1 (IndexedDB)
- **UI** : PrimeVue 4.4.1 + Custom Components
- **Icons** : Material Design Icons (@mdi/font)
- **PWA** : Vite PWA Plugin (offline-first)
- **Tests** : Vitest + Happy DOM
- **Lint** : ESLint + Prettier

---

## 📚 Documentation

- **[INTEGRATION_REPORT.md](./INTEGRATION_REPORT.md)** : Rapport détaillé de l'intégration des maquettes
- **[mockups/README.md](./mockups/README.md)** : Documentation des maquettes HTML
- **[openspec/AGENTS.md](./openspec/AGENTS.md)** : Instructions pour agents AI

---

## 🎨 Maquettes

Les maquettes HTML statiques sont disponibles dans `/mockups/` :
- **design-system.html** : Palette, typographie, composants
- **01-dashboard.html** : Tableau de bord
- **02-properties.html** : Liste propriétés
- **03-property-detail.html** : Détail propriété
- **04-rents-calendar.html** : Calendrier loyers
- **05-documents.html** : Bibliothèque documents
- **06-tenants.html** : Liste locataires

👉 **Ouvrir** : `open mockups/index.html` (navigation hub)

---

## 🧪 Base de Données de Test

Au premier démarrage, la base est automatiquement peuplée avec :
- **5 propriétés** (3 occupées, 2 vacantes)
- **3 locataires** actifs
- **3 baux** en cours
- **9 loyers** (3 derniers mois)

**Clear database** (console navigateur) :
```javascript
import { clearDatabase } from '@db/seed'
await clearDatabase()
```

**Re-seed** :
```javascript
import { seedDatabase } from '@db/seed'
await seedDatabase()
```

---

## 📄 License

MIT

---

## 🤝 Contribution

Ce projet est en développement actif. Les contributions sont les bienvenues !

**Workflow** :
1. Consulter [openspec/AGENTS.md](./openspec/AGENTS.md) pour les specs
2. Créer une branche feature
3. Implémenter avec tests
4. Soumettre PR

---

## 📞 Support

Pour toute question : consulter la documentation dans `/openspec/` ou ouvrir une issue.

---

**Made with ❤️ and Vue.js**
