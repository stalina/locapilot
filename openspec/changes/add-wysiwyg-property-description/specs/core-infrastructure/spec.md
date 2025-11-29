## ADDED Requirements

### Requirement: REQ-CORE-009: Éditeur WYSIWYG pour Description des Propriétés

The application MUST provide a WYSIWYG (What You See Is What You Get) editor for property descriptions to allow formatted text input with basic styling capabilities.

**Priority**: Medium  
**Status**: Proposed

**Details**:

- Éditeur basé sur TipTap v2 (Vue 3 compatible)
- Support des fonctionnalités essentielles : gras, italique, barré, titres (H2, H3), listes (à puces, numérotées), liens hypertextes
- Toolbar intuitive avec boutons pour chaque action de formatage
- Stockage du contenu au format HTML sanitisé dans le champ `Property.description`
- Composant réutilisable `RichTextEditor.vue` dans `src/shared/components/`
- Composant d'affichage `RichTextDisplay.vue` pour le rendu sécurisé du HTML
- Sanitisation HTML avec DOMPurify pour prévenir les attaques XSS
- Limite de taille du HTML à 50KB
- Rétrocompatibilité avec les descriptions texte existantes

**Acceptance Criteria**:

- L'éditeur s'affiche dans le modal de création/modification de propriété
- Les boutons de formatage appliquent correctement les styles
- Le HTML généré est propre et sémantique
- La sanitisation bloque tout code malveillant
- Les descriptions existantes (texte brut) s'affichent correctement
- L'éditeur est accessible au clavier
- Le composant respecte le design system existant (PrimeVue)

#### Scenario: Création d'une propriété avec description formatée

**WHEN** l'utilisateur crée une nouvelle propriété  
**AND** saisit une description avec formatage (gras, listes, titres)  
**THEN**:

- L'éditeur WYSIWYG affiche la mise en forme en temps réel
- Le bouton "Enregistrer" sauvegarde le HTML dans la base de données
- La description formatée s'affiche correctement dans la vue détail

#### Scenario: Modification d'une description existante

**WHEN** l'utilisateur ouvre le formulaire d'édition d'une propriété avec description existante  
**THEN**:

- Si la description est en HTML, elle s'affiche formatée dans l'éditeur
- Si la description est en texte brut, elle s'affiche comme un paragraphe simple
- L'utilisateur peut ajouter ou modifier le formatage
- L'enregistrement met à jour le HTML dans la base de données

#### Scenario: Affichage sécurisé du HTML

**WHEN** l'utilisateur consulte la vue détail d'une propriété  
**THEN**:

- Le HTML de la description est sanitisé avant l'affichage
- Les balises autorisées (p, h2, h3, ul, ol, li, strong, em, a) sont rendues correctement
- Les balises non autorisées (script, iframe, etc.) sont supprimées
- Les attributs dangereux (onclick, onerror) sont supprimés
- Le contenu est affiché avec le style typographique cohérent

#### Scenario: Utilisation du clavier dans l'éditeur

**WHEN** l'utilisateur navigue dans l'éditeur avec le clavier  
**THEN**:

- Les raccourcis clavier standards fonctionnent (Ctrl+B pour gras, Ctrl+I pour italique, etc.)
- La touche Tab permet de naviguer entre l'éditeur et les boutons de la toolbar
- L'éditeur est accessible sans souris

#### Scenario: Validation de la taille du contenu

**WHEN** l'utilisateur saisit une description très longue (>50KB de HTML)  
**THEN**:

- Un message d'avertissement s'affiche
- L'enregistrement est bloqué jusqu'à réduction du contenu
- Le message indique la taille actuelle et la limite

#### Scenario: Insertion d'un lien hypertexte

**WHEN** l'utilisateur clique sur le bouton "Lien" dans la toolbar  
**AND** saisit une URL valide et un texte d'affichage  
**THEN**:

- Le lien est inséré dans le contenu avec la balise `<a>`
- Le lien s'affiche souligné dans l'éditeur
- Le lien s'ouvre dans un nouvel onglet lors de l'affichage (target="\_blank")
- Les URLs invalides sont rejetées avec un message d'erreur

---

## MODIFIED Requirements

### Requirement: REQ-CORE-004: ESLint et Prettier Configuration

The project MUST have ESLint and Prettier configured to ensure code quality and consistency, including HTML formatting in Vue templates.

**Priority**: High  
**Status**: Active

**Details**:

- ESLint avec règles Vue.js et TypeScript
- Prettier pour formatage automatique (JS, TS, Vue, **HTML**)
- Integration avec VS Code
- Pre-commit hooks avec Husky et lint-staged
- Scripts npm pour linting et formatting
- **NEW**: Configuration Prettier pour formater le HTML généré par TipTap

**Acceptance Criteria**:

- ESLint détecte les erreurs de code
- Prettier formate automatiquement à la sauvegarde
- Pre-commit hook empêche commit de code non conforme
- Tous les fichiers passent le lint sans erreurs
- Configuration partagée et versionée
- **NEW**: Le HTML dans les strings est formaté correctement

#### Scenario: Sauvegarde d'un fichier avec erreurs de format

**WHEN** l'utilisateur sauvegarde le fichier dans VS Code  
**THEN**:

- Prettier reformate automatiquement le fichier
- Les indentations sont corrigées
- Les espaces et sauts de ligne sont normalisés
- Le fichier est conforme au style guide

#### Scenario: Tentative de commit avec code non conforme

**WHEN** l'utilisateur tente de commit avec `git commit`  
**THEN**:

- Le pre-commit hook s'exécute
- ESLint détecte les erreurs
- Le commit est bloqué
- Un message indique les erreurs à corriger
