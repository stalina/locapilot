# Maquettes Locapilot 🎨

Design system moderne et maquettes statiques HTML/CSS pour l'application Locapilot.

## 📋 Vue d'ensemble

Ces maquettes proposent une refonte complète et moderne de l'interface Locapilot avec :

- **Design System cohérent** : Palette de couleurs, typographie, composants
- **Interface moderne** : Dégradés, ombres subtiles, animations fluides
- **Responsive** : Grilles flexibles qui s'adaptent aux écrans
- **Accessibilité** : Contrastes WCAG AA, icônes Material Design
- **Expérience utilisateur optimale** : Navigation intuitive, feedback visuel

## 🎨 Design System

### Palette de couleurs

**Couleurs principales**
- Primary: Gradient bleu/violet (`#4f46e5` → `#4338ca`)
- Accent: Teal (`#14b8a6`)
- Success: Vert (`#22c55e`)
- Warning: Orange (`#f59e0b`)
- Error: Rouge (`#ef4444`)

**Couleurs sémantiques**
- Neutral: Échelle de gris pour textes et backgrounds
- Dégradés: Utilisés pour les cards de propriétés et états visuels

### Typographie

- **Font**: Inter (Google Fonts)
- **Poids**: 300, 400, 500, 600, 700, 800
- **Échelle typographique**:
  - H1: 2.5rem / 800 (avec gradient)
  - H2: 1.875rem / 700
  - H3: 1.25rem / 600
  - Body: 1rem / 400

### Composants

- **Buttons**: Primary, Secondary, Outline, Success, Warning, Error
- **Cards**: Avec hover effects, borders, shadows
- **Badges**: Status indicators (payé, en attente, impayé)
- **Inputs**: Border focus avec shadow ring
- **Icons**: Material Design Icons (@mdi/font)

## 📁 Fichiers

### `design-system.html`
**Design System complet**
- Palette de couleurs interactive
- Échantillons typographiques
- Composants UI (boutons, cards, badges, inputs)
- Galerie d'icônes principales

### `01-dashboard.html`
**Dashboard / Tableau de bord**

Fonctionnalités :
- **Sidebar navigation** : Menu latéral fixe avec gradient
- **Stats cards** : 4 KPIs principaux (propriétés, occupation, revenus, impayés)
- **Activité récente** : Timeline des derniers événements
- **Événements à venir** : Calendrier des échéances
- **Quick actions** : Boutons d'actions rapides

Design :
- Layout 2 colonnes (sidebar 260px + contenu flexible)
- Cards avec hover effects et trends (+/-)
- Icônes contextuelles par type d'activité
- Gradient sur sidebar pour distinction visuelle

### `02-properties.html`
**Liste des propriétés**

Fonctionnalités :
- **Filtres avancés** : Recherche, statut, type
- **Grid responsive** : Auto-fill minmax(340px, 1fr)
- **Property cards** : Image gradient, badges status, détails (surface, pièces, étage)
- **Actions rapides** : Modifier, voir détails

Design :
- Dégradés uniques par propriété pour différenciation visuelle
- Badges en overlay sur images (Loué/Vacant)
- Hover effects avec transformation et shadow
- Footer avec prix en avant et actions

### `03-property-detail.html`
**Détail d'une propriété**

Fonctionnalités :
- **Breadcrumb navigation** : Fil d'Ariane
- **Header avec stats** : Loyer, charges, surface, date
- **Section Caractéristiques** : Grid 2 colonnes de détails
- **Section Financière** : Infos loyer, charges, rentabilité
- **Locataire actuel** : Card avec contact et statut
- **Timeline historique** : Événements chronologiques

Design :
- Layout 2 colonnes (2fr + 1fr)
- Stats boxes avec fond coloré
- Info grid pour données structurées
- Timeline avec ligne verticale et points

### `04-rents-calendar.html`
**Gestion des loyers avec calendrier**

Fonctionnalités :
- **Summary cards** : Vue globale (payés, en attente, impayés, total)
- **Calendrier mensuel** : Vue calendrier avec loyers par jour
- **Légende visuelle** : Codes couleur (payé, en attente, impayé)
- **Liste détaillée** : Grid avec toutes les infos (propriété, locataire, montant, date, statut, actions)
- **Actions contextuelles** : Quittance, relance, urgence

Design :
- Summary cards avec dégradés selon statut
- Calendrier grid 7 colonnes (jours de la semaine)
- Items cliquables dans calendrier avec badges colorés
- Rent list avec grid aligné et hover effects

### `05-documents.html`
**Bibliothèque documentaire**

Fonctionnalités :
- **Sidebar de navigation** : Dossiers, types de fichiers, compteurs
- **Barre d'outils** : Recherche, vue grid/liste
- **Zone d'upload** : Drag & drop avec feedback visuel
- **Documents grid** : Miniatures avec icônes typées (PDF, Word, Excel, Image)
- **Actions par document** : Télécharger, partager, supprimer
- **Métadonnées** : Taille, date

Design :
- Layout sidebar (280px) + contenu
- Icônes colorées par type de fichier (PDF rouge, Word bleu, Excel vert, Image cyan)
- Upload zone avec border dashed et hover state
- Document cards avec actions au hover
- Sticky sidebar pour navigation persistante

## 🎯 Principes de design

### Modernité
- Dégradés subtils pour profondeur
- Ombres douces (shadow-md, shadow-xl)
- Border radius généreux (lg, xl, 2xl)
- Transitions fluides (0.2s, 0.3s)

### Hiérarchie visuelle
- Tailles de police progressives
- Poids de police variables (300-800)
- Couleurs sémantiques (primary, success, warning, error)
- Espacement cohérent (scale 4, 8, 12, 16)

### Interactivité
- Hover states sur tous les éléments cliquables
- Transform effects (translateY, scale)
- Shadow elevation au hover
- Feedback visuel immédiat

### Accessibilité
- Contrastes WCAG AA minimum
- Icônes + texte pour clarté
- Focus states visibles
- Tailles de clic optimales (min 36px)

## 🚀 Utilisation

1. **Ouvrir les fichiers HTML** dans un navigateur moderne
2. **Explorer les interactions** : hover, clicks
3. **Inspecter le CSS** pour réutilisation dans composants Vue
4. **Adapter les couleurs** selon besoins (CSS custom properties)

## 🔄 Intégration dans Vue.js

### Étapes recommandées

1. **Extraire les CSS variables** dans un fichier `variables.css` global
2. **Créer des composants Vue** pour chaque type de card/button
3. **Utiliser PrimeVue** pour formulaires et composants complexes
4. **Adapter les grids** avec CSS Grid natif ou PrimeVue Grid
5. **Implémenter les animations** avec Vue transitions

### Exemple d'intégration

```vue
<!-- PropertyCard.vue -->
<template>
  <div class="property-card" @click="viewDetails">
    <div class="property-image" :style="{ background: gradient }">
      <i :class="`mdi mdi-${icon}`"></i>
      <span :class="`property-badge badge-${statusColor}`">
        <i :class="`mdi mdi-${statusIcon}`"></i>
        {{ status }}
      </span>
    </div>
    <div class="property-content">
      <!-- Contenu de la card -->
    </div>
  </div>
</template>

<style scoped>
/* Copier les styles de 02-properties.html */
</style>
```

## 📱 Responsive

Les maquettes utilisent :
- **Grid auto-fit/auto-fill** : S'adapte automatiquement
- **minmax()** : Tailles minimales et maximales
- **Breakpoints** : À définir selon besoins (mobile first)

Suggestion de breakpoints :
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## 🎨 Personnalisation

### Modifier les couleurs

Éditer les CSS custom properties dans `:root` :

```css
:root {
  --primary-600: #4f46e5; /* Changer ici */
  --accent-500: #14b8a6;  /* Changer ici */
  /* ... */
}
```

### Modifier la typographie

```css
:root {
  --font-family: 'Inter', sans-serif; /* Changer ici */
}
```

### Modifier les espacements

```css
:root {
  --space-base: 4px; /* Toutes les autres valeurs en dérivent */
}
```

## 📝 Notes d'implémentation

### PWA
- Penser aux icônes d'apps (192x192, 512x512)
- Splash screens pour installation
- Theme color cohérent avec palette

### Performance
- Lazy load des images de propriétés
- Virtual scrolling pour listes longues
- Debounce sur recherches

### Accessibilité
- ARIA labels sur boutons d'icônes
- Focus trap dans modals
- Keyboard navigation

## 🔗 Ressources

- [Inter Font](https://fonts.google.com/specimen/Inter)
- [Material Design Icons](https://materialdesignicons.com/)
- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [PrimeVue](https://primevue.org/)

## 📄 Licence

Ces maquettes font partie du projet Locapilot et sont sous la même licence que le projet principal.
