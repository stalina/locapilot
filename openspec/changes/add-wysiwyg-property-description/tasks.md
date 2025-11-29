## 1. Choix et installation de l'éditeur WYSIWYG

- [x] 1.1 Évaluer les options (TipTap, Quill, ProseMirror)
- [x] 1.2 Installer TipTap avec extensions essentielles
- [x] 1.3 Configurer TipTap dans le projet

## 2. Création du composant éditeur

- [x] 2.1 Créer `RichTextEditor.vue` dans `src/shared/components/`
- [x] 2.2 Configurer les extensions TipTap (Bold, Italic, Heading, BulletList, OrderedList, Link)
- [x] 2.3 Implémenter la toolbar de l'éditeur
- [x] 2.4 Gérer la liaison bidirectionnelle avec v-model
- [x] 2.5 Ajouter le style CSS personnalisé pour l'éditeur

## 3. Intégration dans PropertyFormModal

- [x] 3.1 Remplacer le `<Textarea>` par `<RichTextEditor>` dans PropertyFormModal.vue
- [x] 3.2 Gérer la validation du HTML
- [x] 3.3 Tester la création et modification de propriété avec description formatée

## 4. Affichage dans PropertyDetailView

- [x] 4.1 Créer un composant `RichTextDisplay.vue` pour afficher le HTML
- [x] 4.2 Intégrer la sanitisation HTML (avec DOMPurify)
- [x] 4.3 Appliquer le style CSS pour l'affichage du contenu formaté
- [x] 4.4 Remplacer l'affichage texte par `<RichTextDisplay>` dans PropertyDetailView.vue

## 5. Sécurité et validation

- [x] 5.1 Installer et configurer DOMPurify pour la sanitisation
- [x] 5.2 Implémenter la sanitisation à l'affichage
- [x] 5.3 Ajouter une limite de taille pour le HTML (ex: 50KB)
- [x] 5.4 Tester avec du contenu potentiellement malveillant

## 6. Tests et documentation

- [x] 6.1 Écrire des tests unitaires pour RichTextEditor
- [x] 6.2 Écrire des tests unitaires pour RichTextDisplay
- [x] 6.3 Ajouter des tests E2E pour la création/modification de description
- [ ] 6.4 Mettre à jour la documentation utilisateur
- [ ] 6.5 Tester l'accessibilité (navigation clavier, lecteurs d'écran)

## 7. Migration et rétrocompatibilité

- [ ] 7.1 Vérifier que les descriptions texte existantes s'affichent correctement
- [ ] 7.2 Tester avec différents types de contenu (vide, texte simple, HTML)
- [ ] 7.3 Valider que l'export/import de données fonctionne toujours
