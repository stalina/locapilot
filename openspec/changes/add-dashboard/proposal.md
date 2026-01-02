# Change: add dashboard feature

## Why

Le tableau de bord est actuellement une maquette statique. Il faut formaliser les exigences, planifier et implémenter une vue dashboard fonctionnelle en réutilisant les styles existants et en respectant l'architecture du projet.

## What changes

- Ajouter une spécification openspec pour la fonctionnalité dashboard
- Implémenter et rendre dynamique la vue DashboardView en réutilisant les composants et styles communs
- Ajouter des tests unitaires pour couvrir le chargement des stats et le rendu principal
- Factoriser tout style ou composant réutilisable manquant dans src/shared

## Impact

- Fichiers affectés: src/features/dashboard/views/DashboardView.vue, openspec/changes/add-dashboard/*, src/features/dashboard/tests/DashboardView.spec.ts
- Aucune modification de schéma de base de données prévue

## Tasks

- [ ] Rédiger spécification (spec.md)
- [ ] Implémenter amélioration DashboardView
- [ ] Ajouter tests unitaires
- [ ] Valider la spécification avec openspec validate
