## 1. Migration Base de Données

- [x] 1.1 Créer migration v3 pour harmoniser type `Inventory.photos` (string[] → number[])
- [x] 1.2 Mettre à jour interface `Inventory` dans schema.ts
- [x] 1.3 Tester la migration sur données existantes

## 2. Composable Photos Inventaire

- [x] 2.1 Créer `useInventoryPhotos` basé sur `usePropertyPhotos`
- [x] 2.2 Implémenter `addInventoryPhoto(inventoryId, file, itemId?)`
- [x] 2.3 Implémenter `getInventoryPhotos(inventoryId)` et `getItemPhotos(inventoryId, itemId)`
- [x] 2.4 Implémenter suppression et gestion des photos
- [x] 2.5 Tests unitaires du composable

## 3. Composants UI

- [x] 3.1 Créer `InventoryPhotoGallery.vue` (adapté de PhotoGallery)
- [x] 3.2 Intégrer dans la vue création/édition d'inventaire
- [ ] 3.3 Permettre l'ajout de photos par pièce (InventoryItem)
- [ ] 3.4 Aperçu des photos dans la liste des inventaires

## 4. Vues & Formulaires

- [x] 4.1 Mettre à jour `InventoryFormModal` avec galerie de photos
- [x] 4.2 Afficher les photos dans `InventoryDetailView`
- [ ] 4.3 Organisation par pièce/équipement
- [ ] 4.4 Interface intuitive pour photographier par section

## 5. Tests & Validation

- [x] 5.1 Tests unitaires composable
- [x] 5.2 Tests d'intégration upload/affichage
- [x] 5.3 Vérifier export/import des photos d'inventaire
- [x] 5.4 Tests de performance (gestion mémoire)

## 6. Documentation

- [x] 6.1 Mettre à jour docs/PHOTOS.md avec section inventaires
- [x] 6.2 Documenter l'utilisation dans états des lieux
- [x] 6.3 Exemples d'usage du composable
