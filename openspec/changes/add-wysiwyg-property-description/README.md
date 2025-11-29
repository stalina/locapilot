# Guide d'implémentation - Éditeur WYSIWYG pour Description de Propriétés

## 📋 Résumé

Cette fonctionnalité ajoute un éditeur WYSIWYG (TipTap) pour permettre la mise en forme des descriptions de propriétés.

## 🎯 Statut actuel

**Change ID**: `add-wysiwyg-property-description`  
**Tâches**: 0/27 complétées  
**Validation**: ✅ Passée en mode strict

## 📁 Fichiers de spécification

- **Proposal**: `openspec/changes/add-wysiwyg-property-description/proposal.md`
- **Tasks**: `openspec/changes/add-wysiwyg-property-description/tasks.md`
- **Design**: `openspec/changes/add-wysiwyg-property-description/design.md`
- **Spec Delta**: `openspec/changes/add-wysiwyg-property-description/specs/core-infrastructure/spec.md`

## 🚀 Commandes OpenSpec utiles

```bash
# Afficher tous les changements actifs
openspec list

# Afficher les détails de ce changement
openspec show add-wysiwyg-property-description

# Valider les modifications
openspec validate add-wysiwyg-property-description --strict

# Afficher les tâches au format JSON (pour scripts)
openspec show add-wysiwyg-property-description --json

# Une fois terminé (après déploiement), archiver le changement
openspec archive add-wysiwyg-property-description
```

## 📦 Dépendances à installer

```bash
npm install @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder
npm install dompurify
npm install -D @types/dompurify
```

## 🏗️ Architecture des composants

```
src/shared/components/
├── RichTextEditor.vue      # Éditeur WYSIWYG (création/modification)
└── RichTextDisplay.vue     # Affichage sécurisé du HTML

src/features/properties/
├── components/
│   └── PropertyFormModal.vue    # ⚠️ À modifier : remplacer Textarea
└── views/
    └── PropertyDetailView.vue   # ⚠️ À modifier : afficher HTML formaté
```

## 🔑 Points clés de l'implémentation

### 1. Configuration TipTap minimale

Extensions à activer :

- `StarterKit` (base)
- `Heading` (H2, H3 uniquement)
- `BulletList` + `OrderedList`
- `Link` (avec validation URL)
- `Placeholder`

### 2. Sécurité (DOMPurify)

Balises autorisées : `p, h2, h3, ul, ol, li, strong, em, a, br`  
Tous les attributs `on*` et balises `<script>`, `<iframe>` doivent être supprimés.

### 3. Limite de taille

Maximum : 50KB de HTML (validé avant enregistrement)

### 4. Rétrocompatibilité

Les descriptions existantes (texte brut) doivent s'afficher comme paragraphes simples sans erreur.

## ✅ Checklist avant de démarrer

- [ ] Lire `proposal.md` pour comprendre le contexte
- [ ] Lire `design.md` pour les décisions techniques
- [ ] Consulter `tasks.md` pour la liste complète des étapes
- [ ] Vérifier que les dépendances sont installées
- [ ] Créer une branche git : `git checkout -b feature/wysiwyg-property-description`

## 🧪 Tests à effectuer

1. **Tests unitaires**
   - RichTextEditor.vue (édition, formatage)
   - RichTextDisplay.vue (sanitisation, affichage)

2. **Tests E2E**
   - Créer une propriété avec description formatée
   - Modifier une description existante
   - Vérifier l'affichage dans PropertyDetailView
   - Tester avec contenu malveillant (XSS)

3. **Tests d'accessibilité**
   - Navigation clavier
   - Lecteurs d'écran
   - Raccourcis clavier (Ctrl+B, Ctrl+I)

## 📝 Suivi de progression

Pour mettre à jour l'état des tâches, modifiez directement le fichier `tasks.md` en changeant `- [ ]` en `- [x]` pour chaque tâche complétée.

Vérifiez la progression avec :

```bash
openspec list
```

## 🎓 Ressources

- [TipTap Documentation](https://tiptap.dev/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)

---

**Note** : Ne pas oublier de valider régulièrement avec `openspec validate` et de commiter les changements dans `tasks.md` au fur et à mesure de l'avancement.
