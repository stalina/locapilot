## Context

La description des propriétés est actuellement un simple champ texte qui limite la présentation des informations. Les gestionnaires immobiliers ont besoin de structurer et mettre en forme les descriptions pour :

- Améliorer la lisibilité (titres, listes)
- Mettre en valeur certaines informations (gras, italique)
- Ajouter des liens (règlement de copropriété, plans, etc.)

Cette fonctionnalité impacte uniquement l'interface utilisateur, le schéma de base de données reste inchangé (le champ `description` continue de stocker une string, mais au format HTML).

## Goals / Non-Goals

**Goals:**

- Fournir un éditeur WYSIWYG moderne et intuitif pour la description des propriétés
- Supporter les fonctionnalités essentielles : gras, italique, titres (h2, h3), listes (à puces, numérotées), liens
- Garantir la sécurité (sanitisation HTML contre XSS)
- Maintenir la rétrocompatibilité avec les descriptions existantes (texte brut)
- Respecter le design system existant (PrimeVue)

**Non-Goals:**

- Support d'images embarquées dans la description (les photos sont gérées séparément)
- Support de tableaux, code, ou autres fonctionnalités avancées
- Support de copier-coller depuis Word/Google Docs (peut être ajouté plus tard)
- Éditeur temps-réel collaboratif

## Decisions

### Choix de l'éditeur : TipTap

**Decision**: Utiliser TipTap v2 comme éditeur WYSIWYG

**Rationale**:

- Vue 3 native avec Composition API
- Basé sur ProseMirror (robuste, extensible)
- Headless (personnalisation complète du design)
- Bundle léger avec tree-shaking
- Bonne documentation et communauté active
- Support TypeScript

**Alternatives considérées**:

- **Quill**: Populaire mais moins moderne, pas de support Vue 3 officiel, monolithique
- **ProseMirror direct**: Trop bas niveau, courbe d'apprentissage élevée
- **CKEditor 5**: Lourd, licence commerciale pour certaines features, moins flexible

### Extensions TipTap requises

- `StarterKit` : Inclut Document, Paragraph, Text, Bold, Italic, Strike, Code, etc.
- `Heading` : Titres H2 et H3 uniquement (pas de H1)
- `BulletList` & `OrderedList` : Listes à puces et numérotées
- `Link` : Liens hypertextes avec validation d'URL
- `Placeholder` : Texte d'aide dans l'éditeur vide

### Toolbar Design

Toolbar simple avec boutons pour :

- Gras, Italique, Barré
- H2, H3
- Liste à puces, Liste numérotée
- Lien
- Bouton "Effacer le formatage"

Placement : au-dessus de l'éditeur, sticky lors du scroll (dans le modal)

### Stockage et sécurité

**Format de stockage** : HTML string dans `Property.description`

**Sanitisation** :

- Utiliser `DOMPurify` pour nettoyer le HTML avant l'affichage
- Configuration stricte : uniquement les balises autorisées (p, h2, h3, ul, ol, li, strong, em, a, br)
- Validation côté client uniquement (pas de backend)

**Limite de taille** : 50KB pour le HTML (suffisant pour ~25 pages A4 de texte)

### Architecture des composants

```
src/shared/components/
├── RichTextEditor.vue      # Composant d'édition (wraps TipTap)
└── RichTextDisplay.vue     # Composant d'affichage (sanitized HTML)
```

**RichTextEditor.vue**:

- Props: `modelValue: string`
- Emits: `update:modelValue`
- Utilise TipTap EditorContent + Toolbar custom
- Style : compatible avec le design system existant

**RichTextDisplay.vue**:

- Props: `content: string`
- Sanitise et affiche le HTML
- Style : typo cohérente avec le reste de l'app

## Risks / Trade-offs

### Risques

| Risque                                | Impact   | Mitigation                                              |
| ------------------------------------- | -------- | ------------------------------------------------------- |
| Faille XSS via HTML injecté           | Critique | DOMPurify avec configuration stricte, tests de sécurité |
| Taille du bundle augmentée            | Moyen    | TipTap modulaire avec tree-shaking, ~40KB gzipped       |
| Compatibilité mobile                  | Moyen    | Tester sur mobile, toolbar responsive                   |
| Complexité pour utilisateurs non-tech | Faible   | Interface simple, aide contextuelle                     |

### Trade-offs

- **Simplicité vs Fonctionnalités** : On limite volontairement aux features essentielles pour garder une UX simple
- **Performance vs Richesse** : On accepte ~40KB de bundle pour une meilleure UX d'édition
- **Sécurité vs Flexibilité** : On restreint les balises HTML autorisées au strict nécessaire

## Migration Plan

### Étape 1 : Installation (non-breaking)

- Installer les dépendances TipTap et DOMPurify
- Créer les composants RichTextEditor et RichTextDisplay
- Pas d'impact sur les fonctionnalités existantes

### Étape 2 : Intégration dans PropertyFormModal

- Remplacer le Textarea par RichTextEditor
- Les anciennes descriptions (texte brut) sont automatiquement compatibles
- Test : créer et modifier des propriétés

### Étape 3 : Affichage dans PropertyDetailView

- Remplacer l'affichage texte par RichTextDisplay
- Les descriptions texte existantes s'affichent comme paragraphes simples
- Test : afficher des propriétés avec et sans formatage

### Rollback

Si problème critique :

1. Revenir à l'utilisation du Textarea
2. Les données restent intactes (HTML stocké comme string)
3. L'HTML s'affiche comme texte brut (dégradation gracieuse)

### Compatibilité

- **Backward** : ✅ Les descriptions texte existantes fonctionnent
- **Forward** : ✅ Si rollback, le HTML reste lisible (moins joli mais fonctionnel)

## Open Questions

1. **Doit-on supporter le copier-coller de contenu formaté depuis Word/Google Docs ?**
   - Réponse future : Peut-être en v2, nécessite parsing complexe
2. **Faut-il un bouton "Mode source" pour éditer le HTML directement ?**
   - Réponse future : Non prioritaire, utilisateurs non-tech
3. **Support de l'impression des descriptions formatées ?**
   - Réponse : Oui, le CSS d'impression existant devrait fonctionner avec le HTML

4. **Internationalisation de l'éditeur (textes des boutons) ?**
   - Réponse : À aligner avec la stratégie i18n du projet (actuellement FR uniquement)
