## 1. Implementation

- [ ] 1.1 Ajouter le type `ChargesAdjustmentRow` au schéma DB et migration (version 6)
- [ ] 1.2 Exposer la table `chargesAdjustments` dans `LocapilotDB`
- [ ] 1.3 Ajouter méthodes store: `fetchChargesAdjustments`, `upsertChargesAdjustment`
- [ ] 1.4 Créer `ChargesAdjustmentTable.vue` avec UI et popin d'ajout de colonne
- [ ] 1.5 Intégrer le composant dans `LeaseDetailView.vue`
- [ ] 1.6 Ajouter tests unitaires pour la logique de calcul
- [ ] 1.7 Revues visuelles et adapations de styles

## 2. Validation

- [ ] Valider que les lignes sont sauvegardées et rechargées
- [ ] Valider que les colonnes custom sont persistées et éditables
- [ ] Valider les calculs: total charges et régulation
