# Guide de Contribution

Merci de votre intérêt pour contribuer à Locapilot ! 🎉

## 📋 Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Processus de développement](#processus-de-développement)
- [Standards de code](#standards-de-code)
- [Tests](#tests)
- [Commits](#commits)

---

## 🤝 Code de conduite

En participant à ce projet, vous acceptez de respecter un environnement bienveillant et inclusif.

---

## 💡 Comment contribuer

### Signaler un bug

1. Vérifiez que le bug n'a pas déjà été signalé dans [Issues](https://github.com/votre-username/locapilot/issues)
2. Créez une nouvelle issue avec le template "Bug Report"
3. Incluez :
   - Description claire du problème
   - Étapes pour reproduire
   - Comportement attendu vs actuel
   - Screenshots si applicable
   - Environnement (OS, navigateur, version)

### Proposer une fonctionnalité

1. Créez une issue avec le template "Feature Request"
2. Décrivez la fonctionnalité et sa valeur
3. Attendez feedback avant de commencer le développement

### Soumettre du code

1. **Fork** le projet
2. **Créer une branche** depuis `main`
   ```bash
   git checkout -b feature/ma-fonctionnalite
   ```
3. **Développer** en suivant les standards
4. **Tester** votre code
5. **Commit** avec des messages conventionnels
6. **Push** vers votre fork
7. **Ouvrir une Pull Request**

---

## 🔧 Processus de développement

### Setup initial

```bash
# Cloner votre fork
git clone https://github.com/votre-username/locapilot.git
cd locapilot

# Ajouter upstream
git remote add upstream https://github.com/original-owner/locapilot.git

# Installer dépendances
npm install

# Lancer en dev
npm run dev
```

### Workflow quotidien

```bash
# Sync avec upstream
git fetch upstream
git checkout main
git merge upstream/main

# Créer une branche
git checkout -b feature/nouvelle-fonctionnalite

# Développer...
# Commit régulièrement

# Vérifier avant de push
npm run lint
npm run type-check
npm test
npm run test:e2e

# Push
git push origin feature/nouvelle-fonctionnalite
```

---

## 📐 Standards de code

### Structure des fichiers

```typescript
// Imports
import { ref, computed } from 'vue';
import type { Property } from '@/db/types';

// Interfaces/Types
interface Props {
  property: Property;
}

// Composant/Fonction
export const usePropertyLogic = () => {
  // State
  const isLoading = ref(false);
  
  // Computed
  const displayName = computed(() => ...);
  
  // Methods
  const updateProperty = async () => {
    // ...
  };
  
  return {
    isLoading,
    displayName,
    updateProperty,
  };
};
```

### Nommage

```typescript
// Composants Vue: PascalCase
PropertyCard.vue
TenantForm.vue

// Fichiers TypeScript: camelCase
propertiesStore.ts
usePropertyLogic.ts

// Constantes: UPPER_SNAKE_CASE
const MAX_PROPERTIES = 100;
const API_BASE_URL = '...';

// Variables/Fonctions: camelCase
const propertyCount = 10;
const fetchProperties = () => { };
```

### TypeScript

- ✅ Mode strict activé
- ✅ Typer toutes les fonctions et variables
- ✅ Éviter `any`, préférer `unknown`
- ✅ Utiliser les interfaces pour les objets
- ✅ Utiliser les types pour les unions/primitives

```typescript
// ✅ Bon
interface Property {
  id: number;
  name: string;
}

function getProperty(id: number): Property | null {
  // ...
}

// ❌ Mauvais
function getProperty(id: any): any {
  // ...
}
```

### Composants Vue

```vue
<script setup lang="ts">
// 1. Imports
import { ref, computed } from 'vue';
import Button from '@/shared/components/Button.vue';

// 2. Props/Emits
interface Props {
  title: string;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
});

const emit = defineEmits<{
  update: [value: number];
}>();

// 3. State
const localValue = ref(props.count);

// 4. Computed
const displayValue = computed(() => localValue.value * 2);

// 5. Methods
const handleClick = () => {
  emit('update', localValue.value);
};
</script>

<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <Button @click="handleClick">
      {{ displayValue }}
    </Button>
  </div>
</template>

<style scoped>
.container {
  padding: var(--space-4);
}
</style>
```

---

## ✅ Tests

### Tests obligatoires

Toute PR doit inclure des tests pour :

1. **Nouveau store** → Tests unitaires (state, getters, actions)
2. **Nouveau composant** → Tests unitaires (props, events, slots)
3. **Nouveau flux utilisateur** → Test E2E

### Exemples de tests

```typescript
// Store
describe('propertiesStore', () => {
  it('should initialize with empty properties', () => {
    const store = usePropertiesStore();
    expect(store.properties).toEqual([]);
  });
  
  it('should fetch properties successfully', async () => {
    const store = usePropertiesStore();
    await store.fetchProperties();
    expect(store.properties.length).toBeGreaterThan(0);
  });
});

// Composant
describe('Button', () => {
  it('should emit click event', async () => {
    const wrapper = mount(Button);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });
});

// E2E
test('should create a property', async ({ page }) => {
  await page.goto('/properties');
  await page.click('text=Nouvelle propriété');
  await page.fill('input[name="name"]', 'Test');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=Test')).toBeVisible();
});
```

### Lancer les tests

```bash
# Tests unitaires
npm test                    # Mode watch
npm run test:coverage       # Avec couverture

# Tests E2E
npm run test:e2e            # Tous les navigateurs
npm run test:e2e -- --headed  # Mode visible
```

---

## 📝 Commits

### Format Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage (sans changement de code)
- `refactor`: Refactoring
- `test`: Ajout/modification de tests
- `chore`: Tâches diverses (build, config...)
- `perf`: Amélioration de performance

### Exemples

```bash
feat(properties): add filter by type
fix(tenants): correct email validation
docs: update README with new commands
test(leases): add tests for createLease action
refactor(stores): extract common logic to composable
chore(deps): update vue to 3.5.24
```

### Bonnes pratiques

- ✅ Messages en anglais
- ✅ Impératif présent ("add" pas "added")
- ✅ Première lettre minuscule
- ✅ Pas de point final
- ✅ Description claire et concise (< 72 caractères)
- ✅ Body si besoin d'explications supplémentaires

---

## 🔍 Review Process

### Checklist avant PR

- [ ] Code lint-free (`npm run lint`)
- [ ] Tests passants (`npm test` et `npm run test:e2e`)
- [ ] TypeScript sans erreurs (`npm run type-check`)
- [ ] Code formaté (`npm run format`)
- [ ] Documentation à jour
- [ ] Commits conventionnels
- [ ] Description PR complète

### Attentes PR

1. **Titre clair** : type(scope): description
2. **Description** :
   - Qu'est-ce qui change ?
   - Pourquoi ?
   - Comment tester ?
3. **Screenshots** si changement UI
4. **Lien vers issue** si applicable
5. **Breaking changes** clairement documentés

---

## 🎯 Priorités actuelles

Consultez le [Project Board](https://github.com/votre-username/locapilot/projects) pour voir les priorités.

Zones qui acceptent des contributions :

- 📱 Amélioration PWA
- 🎨 Composants UI supplémentaires
- 🧪 Augmentation couverture de tests
- 📚 Documentation
- 🌐 Internationalisation (i18n)
- ♿ Accessibilité (a11y)

---

## 💬 Questions ?

- **Issues** : [GitHub Issues](https://github.com/votre-username/locapilot/issues)
- **Discussions** : [GitHub Discussions](https://github.com/votre-username/locapilot/discussions)

---

Merci de contribuer à Locapilot ! 🚀
