# Change: add-wysiwyg-annonce-property

## Why

Les gestionnaires / propriétaires doivent pouvoir définir une "annonce type" éditable directement depuis la vue détaillée d'une propriété. Cette annonce servira de texte par défaut pour les sites de recherche de locataires (ex: Leboncoin, SeLoger) et doit être éditable via un WYSIWYG similaire au champ `description` existant.

## What Changes

- **ADD** un champ `annonce` (rich text / WYSIWYG) sur l'entité `Property` et son UI dans la vue détaillée (`PropertyDetailView`).
- **ADD** une valeur par défaut pour les nouvelles propriétés (template de l'annonce) utilisant des placeholders `{LOYER}`, `{CHARGES}`, `{GARANTIE}` qui seront remplacés à l'affichage/à l'export.
- **IMPACT** sur la base de données : ajout d'une colonne `annonce` (string) dans le schéma IndexedDB.
- **UI** : réutiliser le WYSIWYG et le toolbar existants de `description` (composant partagé).

## Impact

- Affected specs: `specs/properties/spec.md`
- Affected code: `src/db/schema.ts`, `src/features/properties/views/PropertyDetailView.vue`, `src/features/properties/stores/*`, `src/shared/components/Wysiwyg*` (réutilisation), tests unitaires pour le store et migration DB.
