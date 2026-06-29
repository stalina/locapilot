# ADR 0003 — Migrations déclaratives via Dexie

- **Statut** : Accepté
- **Date** : 2026-06-29

## Contexte

Le schéma de la base IndexedDB évolue au fil des fonctionnalités (nouveaux
champs, nouvelles tables, nouveaux index). Comme les données vivent **sur
l'appareil de chaque utilisateur** ([ADR 0001](./0001-offline-first-indexeddb.md)),
il n'existe pas de migration centralisée : chaque navigateur doit pouvoir faire
évoluer **sa propre base** au prochain chargement, sans perte de données et sans
intervention.

Contraintes :

- Migration automatique, déclenchée à l'ouverture de la base.
- Compatibilité ascendante : une base ancienne doit pouvoir sauter plusieurs
  versions d'un coup.
- Possibilité de transformer des données existantes (pas seulement la structure).

## Décision

Utiliser le **système de versions natif de Dexie** : chaque évolution du schéma
est déclarée par `this.version(n).stores({ … })` dans la classe `LocapilotDB`
([`src/db/schema.ts`](../../src/db/schema.ts)). Les transformations de données
sont exprimées dans un callback `.upgrade()` attaché à la version concernée.

Règles adoptées :

1. **Déclaratif d'abord** : ajouter/retirer un index ou une table = nouvelle
   `version().stores()`. Ajouter un champ optionnel sans index ne nécessite
   aucune nouvelle version (IndexedDB stocke des objets libres).
2. **`upgrade()` uniquement pour les données** : on n'écrit du code de migration
   que pour transformer des enregistrements existants (init de champ, changement
   de type).
3. **Immuabilité des versions publiées** : on ne modifie jamais une version
   livrée ; on en ajoute une nouvelle.
4. **Helpers de logging/inspection** dans
   [`src/db/migrations.ts`](../../src/db/migrations.ts)
   (`runMigrations`, `getMigrationHistory`, `hasPendingMigrations`,
   `exportDatabaseSchema`) — la logique de migration **réelle** reste dans
   `schema.ts`.

Le guide détaillé (historique des 6 versions, exemples, procédure d'ajout) est
dans [migrations-dexie.md](../migrations-dexie.md).

## Alternatives envisagées

- **Système de migrations impératif maison** (numéro de version stocké en base +
  scripts séquentiels) — rejeté : réinvente ce que Dexie fait nativement, avec
  un risque d'incohérence entre le schéma déclaré et les scripts.
- **Recréer la base à chaque changement** — rejeté : perte de données
  inacceptable côté utilisateur.
- **Pas de versionnement, schéma implicite** — rejeté : impossible de gérer
  proprement les changements d'index et les transformations de données.

## Conséquences

### Positives

- Migrations **automatiques** et **transactionnelles** à l'ouverture, gérées par
  Dexie ; saut multi-versions pris en charge.
- Schéma et migrations **colocalisés** et versionnés avec le code.
- Ajout de champ sans cérémonie (pas de migration pour un champ optionnel).

### Négatives / compromis

- Toutes les tables doivent être **re-listées** à chaque
  `version().stores()` : une table omise est supprimée par Dexie. Source
  d'erreur si on l'oublie.
- Les `upgrade()` s'exécutent dans le navigateur de l'utilisateur : ils doivent
  rester **robustes et idempotents**, et être testés.
- Le double fichier (`schema.ts` pour le réel, `migrations.ts` pour les helpers)
  peut prêter à confusion : la source de vérité des migrations est `schema.ts`.

## Références

- [`src/db/schema.ts`](../../src/db/schema.ts) — déclarations `version().stores()`
- [`src/db/migrations.ts`](../../src/db/migrations.ts) — helpers
- [migrations-dexie.md](../migrations-dexie.md) — guide complet
- Tests : `src/db/__tests__/schema.spec.ts`, `migrations.spec.ts`
