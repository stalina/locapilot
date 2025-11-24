# Next Steps - Plan d'Action Détaillé

**Objectif** : Continuer l'implémentation des vues et features en suivant les specs OpenSpec

---

## 🎯 Prochaine Session : Vue Propriétés

### Étape 1 : PropertyCard Component (30 min)

**Fichier** : `/src/shared/components/PropertyCard.vue`

**Props TypeScript** :
```typescript
interface Props {
  property: {
    id: string;
    name: string;
    address: string;
    type: 'apartment' | 'house' | 'commercial' | 'parking';
    surface: number;
    rooms: number;
    rentAmount: number;
    status: 'occupied' | 'vacant' | 'maintenance';
  };
  clickable?: boolean;
}
```

**Design** (inspiré de `02-properties.html`) :
- Image placeholder (gradient background avec icône type)
- Badge status (vert si occupé, gris si vacant, orange si maintenance)
- Nom en titre (font-semibold, primary color)
- Adresse en sous-titre (text-secondary, smaller)
- Stats inline : surface (m²), rooms (pièces), prix (€/mois)
- Hover : Shadow elevation + scale transform
- Click : Router link vers `/properties/:id`

**Slots** :
- `actions` : Boutons d'action (Edit, Delete)

---

### Étape 2 : PropertiesListView (45 min)

**Fichier** : `/src/features/properties/views/PropertiesView.vue`

**Layout** :
```
┌─────────────────────────────────────┐
│ Header                              │
│ - Titre "Propriétés"                │
│ - SearchBox (recherche)             │
│ - Button "Nouvelle propriété"       │
├─────────────────────────────────────┤
│ Stats Bar (4 mini stats)            │
│ - Total, Occupées, Vacantes, Rev.  │
├─────────────────────────────────────┤
│ Filters                             │
│ - Type (tous, appart, maison...)    │
│ - Status (tous, occupé, vacant...)  │
│ - Tri (nom, prix, surface)          │
├─────────────────────────────────────┤
│ Grid PropertyCard (3 cols)          │
│ - Responsive 2 cols, 1 col mobile   │
│ - Gap 24px                          │
│ - Empty state si aucune propriété   │
└─────────────────────────────────────┘
```

**State Management** :
```typescript
const searchQuery = ref('');
const filterType = ref<PropertyType | 'all'>('all');
const filterStatus = ref<PropertyStatus | 'all'>('all');
const sortBy = ref<'name' | 'price' | 'surface'>('name');

const properties = computed(() => {
  // Filter + search + sort logic
});
```

**Méthode** :
```typescript
async function loadProperties() {
  const allProperties = await db.properties.toArray();
  // Apply filters
}

function handleSearch(query: string) {
  searchQuery.value = query;
}

function handlePropertyClick(id: string) {
  router.push(`/properties/${id}`);
}
```

---

### Étape 3 : PropertiesStore (30 min)

**Fichier** : `/src/features/properties/stores/propertiesStore.ts`

**Structure Pinia** :
```typescript
export const usePropertiesStore = defineStore('properties', () => {
  // State
  const properties = ref<Property[]>([]);
  const currentProperty = ref<Property | null>(null);
  const isLoading = ref(false);
  
  // Getters
  const occupiedProperties = computed(() => 
    properties.value.filter(p => p.status === 'occupied')
  );
  
  const vacantProperties = computed(() =>
    properties.value.filter(p => p.status === 'vacant')
  );
  
  const totalRevenue = computed(() =>
    occupiedProperties.value.reduce((sum, p) => sum + p.rentAmount, 0)
  );
  
  // Actions
  async function fetchProperties() {
    isLoading.value = true;
    try {
      properties.value = await db.properties.toArray();
    } finally {
      isLoading.value = false;
    }
  }
  
  async function fetchPropertyById(id: string) {
    currentProperty.value = await db.properties.get(id) || null;
  }
  
  async function createProperty(data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = await db.properties.add({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await fetchProperties(); // Refresh list
    return id;
  }
  
  async function updateProperty(id: string, data: Partial<Property>) {
    await db.properties.update(id, {
      ...data,
      updatedAt: new Date(),
    });
    await fetchProperties();
  }
  
  async function deleteProperty(id: string) {
    await db.properties.delete(id);
    await fetchProperties();
  }
  
  return {
    properties,
    currentProperty,
    isLoading,
    occupiedProperties,
    vacantProperties,
    totalRevenue,
    fetchProperties,
    fetchPropertyById,
    createProperty,
    updateProperty,
    deleteProperty,
  };
});
```

---

### Étape 4 : SearchBox Component (20 min)

**Fichier** : `/src/shared/components/SearchBox.vue`

**Props** :
```typescript
interface Props {
  modelValue: string;
  placeholder?: string;
  debounce?: number; // Default 300ms
}
```

**Emits** :
```typescript
const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [value: string];
}>();
```

**Features** :
- Input avec icône search (MDI)
- Clear button (×) si value non vide
- Debounce sur input
- Emit 'search' après debounce
- v-model compatible

**Composable `useDebouncedRef`** (bonus) :
```typescript
// /src/shared/composables/useDebouncedRef.ts
export function useDebouncedRef<T>(value: T, delay = 300) {
  const debouncedValue = ref(value);
  const timeoutId = ref<number>();
  
  watch(() => value, (newValue) => {
    clearTimeout(timeoutId.value);
    timeoutId.value = setTimeout(() => {
      debouncedValue.value = newValue;
    }, delay);
  });
  
  return debouncedValue;
}
```

---

### Étape 5 : Integration (15 min)

**Modifier** : `/src/features/properties/views/PropertiesView.vue`

1. Importer `usePropertiesStore`
2. Appeler `fetchProperties()` dans `onMounted`
3. Utiliser `properties` du store dans template
4. Bind `@search` de SearchBox à `handleSearch`
5. Bind `@click` de PropertyCard à `handlePropertyClick`

**Test** :
- Vérifier que les 5 propriétés seed s'affichent
- Tester la recherche (nom, adresse)
- Tester les filtres (type, status)
- Tester le tri
- Tester le clic sur carte (navigation)

---

## 📋 Checklist Complète

### Session 1 : Vue Propriétés ✅
- [ ] PropertyCard.vue (design, props, events)
- [ ] SearchBox.vue (debounce, v-model)
- [ ] useDebouncedRef.ts (composable)
- [ ] propertiesStore.ts (CRUD, getters)
- [ ] PropertiesView.vue (layout, filters, grid)
- [ ] Test navigation `/properties`
- [ ] Test données seed

### Session 2 : Détail Propriété
- [ ] PropertyDetailView.vue (2-column layout)
- [ ] Timeline.vue component (historique)
- [ ] useProperty.ts composable
- [ ] Tab navigation (Info, Baux, Loyers, Documents)
- [ ] Edit modal (formulaire)

### Session 3 : Vue Locataires
- [ ] TenantCard.vue
- [ ] TenantsView.vue (grid)
- [ ] tenantsStore.ts
- [ ] TenantDetailView.vue

### Session 4 : Vue Loyers
- [ ] Calendar.vue component
- [ ] RentsCalendarView.vue
- [ ] rentsStore.ts (payment logic)
- [ ] PaymentModal.vue

### Session 5 : Vue Documents
- [ ] DocumentCard.vue
- [ ] UploadZone.vue
- [ ] DocumentsView.vue
- [ ] documentsStore.ts (IndexedDB blobs)

### Session 6 : Forms & Validation
- [ ] Input.vue (text, email, tel, number)
- [ ] Select.vue
- [ ] Textarea.vue
- [ ] DatePicker.vue
- [ ] Form validation (Vuelidate or Yup)

### Session 7 : Tests
- [ ] Button.spec.ts
- [ ] PropertyCard.spec.ts
- [ ] propertiesStore.spec.ts
- [ ] PropertiesView.spec.ts

### Session 8 : Polish
- [ ] Loading states (skeletons)
- [ ] Error boundaries
- [ ] Toasts/notifications
- [ ] Confirmations (delete)
- [ ] Dark mode
- [ ] Mobile responsive

---

## 🎨 Design Tokens à Utiliser

```css
/* Cards */
--radius-xl: 1rem;
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

/* Spacing */
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;

/* Typography */
--text-lg: 1.125rem;
--text-base: 1rem;
--text-sm: 0.875rem;
--font-weight-semibold: 600;
--font-weight-medium: 500;

/* Colors */
--primary-600: #4f46e5;
--success-500: #22c55e;
--text-secondary: #64748b;
--border-color: #e2e8f0;
```

---

## 🔧 Commandes Utiles

```bash
# Créer composant (copier template)
cp src/shared/components/Card.vue src/shared/components/PropertyCard.vue

# Créer store
cp src/core/store/appStore.ts src/features/properties/stores/propertiesStore.ts

# Linter avant commit
npm run lint

# Tests en watch mode
npm run test -- --watch

# Check TypeScript
npm run type-check
```

---

## 📚 Références

- **Maquette** : `/mockups/02-properties.html`
- **Exemple composant** : `/src/shared/components/StatCard.vue`
- **Exemple store** : `/src/core/store/appStore.ts`
- **Exemple vue** : `/src/features/dashboard/views/DashboardView.vue`

---

## ⏱️ Estimation Temps

| Tâche | Temps | Difficulté |
|-------|-------|------------|
| PropertyCard | 30 min | ⭐⭐ |
| SearchBox | 20 min | ⭐⭐ |
| PropertiesStore | 30 min | ⭐⭐⭐ |
| PropertiesView | 45 min | ⭐⭐⭐ |
| Integration & Tests | 15 min | ⭐ |
| **Total Session 1** | **2h20** | - |

---

## 🎯 Critères de Succès

### Must Have ✅
- [ ] Liste des 5 propriétés s'affiche
- [ ] Recherche fonctionne (nom, adresse)
- [ ] Filtres fonctionnent (type, status)
- [ ] Clic sur carte → navigation détail
- [ ] Design cohérent avec maquette

### Should Have ⭐
- [ ] Tri fonctionnel (nom, prix, surface)
- [ ] Empty state si aucune propriété
- [ ] Loading skeleton pendant fetch
- [ ] Stats bar en header

### Nice to Have 💎
- [ ] Animations de transition
- [ ] Infinite scroll / pagination
- [ ] Export CSV
- [ ] Bulk actions

---

**Prêt pour la prochaine session !** 🚀

Commencer par `PropertyCard.vue` puis `SearchBox.vue` pour avoir les composants de base, ensuite le store, et enfin assembler dans `PropertiesView.vue`.
