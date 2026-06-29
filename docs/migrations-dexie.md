# Système de migrations Dexie

Locapilot stocke toutes ses données dans **IndexedDB** via **Dexie.js**. Le
schéma évolue dans le temps : ce document explique comment Dexie gère les
migrations, l'historique des versions du schéma, et la procédure pour en ajouter
une.

> Décision d'architecture associée :
> [ADR 0003 — Migrations déclaratives via Dexie](./adr/0003-migrations-declaratives-dexie.md).

## Principe : des migrations déclaratives

Dexie ne fonctionne **pas** comme un système de migrations SQL impératif
(`ALTER TABLE …`). On déclare chaque version du schéma avec
`db.version(n).stores({…})`, et Dexie applique automatiquement les
transformations de structure (création de tables, ajout/suppression d'index)
lorsqu'un navigateur ouvre une base dont la version est inférieure.

Points clés :

- **Ajouter un champ ne nécessite aucune migration** : IndexedDB stocke des
  objets libres. Un nouveau champ optionnel apparaît simplement sur les futurs
  enregistrements ; les anciens restent valides.
- **Une version n'est nécessaire que pour les index** : il faut une nouvelle
  `version(n).stores()` uniquement quand on change les **index** (clé primaire
  ou index secondaires) ou qu'on **crée / supprime une table**.
- **Un `.upgrade(callback)` n'est requis que pour transformer des données
  existantes** (ex. changer le type d'un champ, initialiser une valeur).
- Les versions doivent être **strictement croissantes** ; ne jamais modifier une
  version déjà publiée — toujours en ajouter une nouvelle.

Tout est défini dans la classe `LocapilotDB` de
[`src/db/schema.ts`](../src/db/schema.ts).

### Anatomie d'une déclaration de store

```typescript
this.version(1).stores({
  properties: '++id, name, status, createdAt',
  //           │     └──── index secondaires (recherche / tri)
  //           └────────── clé primaire auto-incrémentée
  settings: '++id, &key', // `&` = index unique
});
```

| Préfixe   | Signification                    |
| --------- | -------------------------------- |
| `++`      | Clé primaire auto-incrémentée    |
| `&`       | Index unique (ex. `&key`)        |
| `*`       | Index multi-entrées (multiEntry) |
| `[a+b]`   | Index composé (compound)         |
| _(aucun)_ | Index secondaire simple          |

## Historique des versions

L'instance déclare aujourd'hui **6 versions**. Tableau récapitulatif :

| Version | Objet                                                                                                                     | `upgrade()` ?                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1       | Schéma initial (properties, tenants, leases, rents, documents, inventories, communications, settings, chargesAdjustments) | Non                               |
| 2       | Support des photos de propriété : initialise `photos: []` sur les propriétés existantes                                   | Oui — initialise les données      |
| 3       | Harmonisation des index + conversion de `Inventory.photos` (string[] → number[])                                          | Oui — transforme les données      |
| 4       | Ajout du champ `annonce` (rich text) aux propriétés — rétrocompatible                                                     | Non                               |
| 5       | Ajout des tables `tenantDocuments` et `tenantAudits`                                                                      | Oui (no-op, garantit la création) |
| 6       | Ajout de l'index composé `[leaseId+year]` sur `chargesAdjustments`                                                        | Non                               |

### Exemple — migration v2 (transformation de données)

Quand on ouvre une base en v1 vers la v2, le `upgrade()` initialise le champ
`photos` sur tous les enregistrements existants :

```typescript
this.version(2)
  .stores({
    /* … index inchangés … */
  })
  .upgrade(async transaction => {
    const properties = await transaction.table('properties').toArray();
    await Promise.all(
      properties.map(p => transaction.table('properties').update(p.id!, { photos: [] }))
    );
  });
```

### Exemple — migration v3 (changement de type)

La v3 harmonise les index des tables et convertit `Inventory.photos` de
`string[]` (anciens chemins) vers `number[]` (IDs de documents) :

```typescript
this.version(3)
  .stores({
    properties: '++id, name, address, type, surface, status, createdAt',
    rents: '++id, leaseId, dueDate, paidDate, status, month, year',
    /* … */
  })
  .upgrade(async transaction => {
    const inventories = await transaction.table('inventories').toArray();
    await Promise.all(
      inventories.map(inventory =>
        transaction.table('inventories').update(inventory.id!, {
          photos: Array.isArray(inventory.photos) ? [] : [],
        })
      )
    );
  });
```

### Exemple — migration v6 (index composé, sans données)

Ajouter un index composé `[leaseId+year]` (pour les requêtes par bail + année)
ne demande qu'une nouvelle déclaration de store, sans `upgrade()` :

```typescript
this.version(6).stores({
  /* … autres tables inchangées … */
  chargesAdjustments: '++id, leaseId, year, [leaseId+year]',
});
```

## Helpers de migration

[`src/db/migrations.ts`](../src/db/migrations.ts) fournit des utilitaires
**autour** des migrations Dexie (les migrations réelles restent déclarées dans
`schema.ts`) :

| Fonction                 | Rôle                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| `runMigrations()`        | Log les migrations en attente à l'ouverture de la base.                    |
| `getMigrationHistory()`  | Retourne `{ current, available, pending[], applied[] }`.                   |
| `hasPendingMigrations()` | Indique si des migrations restent à appliquer.                             |
| `exportDatabaseSchema()` | Exporte la structure (tables + index) pour backup/debug.                   |
| `resetDatabase()`        | **DEV uniquement** — supprime et recrée la base (lève une erreur en prod). |

`initializeDatabase()` (dans `schema.ts`) ouvre la base au démarrage et logge la
version courante (`db.verno`).

## Procédure : ajouter une migration

1. **Modifier les types** dans `schema.ts` (interfaces `Property`, `Tenant`, …)
   si vous ajoutez/changez un champ.
2. **Décider si une nouvelle version est nécessaire** :
   - Champ optionnel sans index → **aucune nouvelle version** requise.
   - Nouvel index / nouvelle table / suppression → **ajouter** une
     `this.version(N+1).stores({ … })` reprenant toutes les tables (les tables
     non répétées sont supprimées par Dexie — toujours toutes les lister).
3. **Ajouter un `.upgrade(async transaction => { … })`** uniquement si des
   données existantes doivent être transformées. Utiliser `transaction.table()`
   et non `db.*` à l'intérieur du callback.
4. **Ne jamais modifier une version publiée** — toujours en créer une nouvelle.
5. **Mettre à jour la documentation** : ce fichier + la table « Data Model » des
   specs concernées (voir la _Mandatory Spec Maintenance Rule_ du
   [CLAUDE.md](../CLAUDE.md)) et le diagramme `erDiagram` si les relations
   changent.
6. **Couvrir par des tests** : `src/db/__tests__/schema.spec.ts` et
   `migrations.spec.ts`.

## Export / import et migrations

Deux chemins coexistent :

- `exportData()` / `importData()` dans `schema.ts` — export/import **JSON brut**,
  qui **n'inclut pas** le contenu binaire (`Blob`) des documents. L'import est
  transactionnel : toutes les tables sont vidées puis réécrites dans une même
  transaction (`db.transaction('rw', …)`), pour éviter l'erreur de scope Dexie
  (cf. issue #55).
- Le store `dataTransfer` (feature `settings`) gère la **sauvegarde / restauration
  complète** côté utilisateur, en préservant les fichiers (`Blob`). C'est aussi
  ce qui circule via la [synchronisation P2P](./adr/0002-synchronisation-p2p-chiffree.md).

> Lors d'un import, les données proviennent potentiellement d'une version de
> schéma différente. Dexie applique les migrations à l'ouverture de la base ;
> assurez-vous qu'un import de données anciennes reste compatible avec les
> `upgrade()` (ou normalisez à l'import).
