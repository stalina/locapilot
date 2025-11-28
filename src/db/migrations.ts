/**
 * Système de migrations pour Dexie.js
 * Permet de gérer l'évolution du schéma de la base de données
 */

import type Dexie from 'dexie';
import { db } from './database';

export interface Migration {
  version: number;
  description: string;
  upgrade: () => Promise<void>;
}

/**
 * Liste des migrations disponibles
 * Chaque migration doit avoir un numéro de version unique et croissant
 */
export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Schema initial - Tables properties, tenants, leases, rents, documents, settings',
    upgrade: async () => {
      // Version 1 est déjà définie dans schema.ts
      // Pas de migration nécessaire
    },
  },

  {
    version: 2,
    description:
      'Ajout du support des photos pour les propriétés (champ photos[], type document photo)',
    upgrade: async () => {
      // Migration gérée dans schema.ts version 2
      // Initialise le champ photos: [] pour toutes les propriétés existantes
    },
  },

  // Exemple de migration future (version 3)
  // {
  //   version: 3,
  //   description: 'Ajout de la colonne "archived" aux propriétés',
  //   upgrade: async (transaction) => {
  //     // Les migrations Dexie sont déclaratives
  //     // Il suffit de définir le nouveau schéma dans db.version(3).stores()
  //     // et Dexie gère automatiquement l'ajout de colonnes
  //
  //     // Pour des transformations de données complexes:
  //     const properties = await transaction.table('properties').toArray();
  //     await Promise.all(
  //       properties.map(property =>
  //         transaction.table('properties').update(property.id!, {
  //           archived: false,
  //         })
  //       )
  //     );
  //   },
  // },

  // Exemple: Migration version 4 - Ajout table inventories
  // {
  //   version: 4,
  //   description: 'Ajout de la table inventories pour les états des lieux',
  //   upgrade: async () => {
  //     // Schéma défini dans db.version(4).stores() dans schema.ts
  //     // Pas besoin de code ici sauf pour migration de données
  //   },
  // },
];

/**
 * Applique toutes les migrations nécessaires
 * Appelé automatiquement à l'ouverture de la base de données
 */
export async function runMigrations(): Promise<void> {
  const currentVersion = db.verno;
  const pendingMigrations = migrations.filter(m => m.version > currentVersion);

  if (pendingMigrations.length === 0) {
    console.log(`✅ Database version ${currentVersion} - No migrations needed`);
    return;
  }

  console.log(`🔄 Running ${pendingMigrations.length} migration(s)...`);

  for (const migration of pendingMigrations) {
    console.log(`  - Migration ${migration.version}: ${migration.description}`);
  }

  // Les migrations Dexie sont automatiques via db.version().stores()
  // Cette fonction sert principalement pour le logging et les transformations custom
}

/**
 * Obtient l'historique des migrations
 */
export function getMigrationHistory(): {
  current: number;
  available: number;
  pending: Migration[];
  applied: Migration[];
} {
  const currentVersion = db.verno;
  const applied = migrations.filter(m => m.version <= currentVersion);
  const pending = migrations.filter(m => m.version > currentVersion);

  return {
    current: currentVersion,
    available: migrations.length,
    pending,
    applied,
  };
}

/**
 * Vérifie si des migrations sont en attente
 */
export function hasPendingMigrations(): boolean {
  return migrations.some(m => m.version > db.verno);
}

/**
 * Exporte les fonctions de migration pour utilisation dans schema.ts
 */
export function defineMigrations(database: Dexie): void {
  // Version 1 - Schema initial
  database.version(1).stores({
    properties: '++id, name, address, city, postalCode, type, status, price, createdAt',
    tenants: '++id, email, phone, status, lastName, firstName, createdAt',
    leases: '++id, propertyId, status, startDate, endDate, createdAt',
    rents: '++id, leaseId, propertyId, tenantId, status, dueDate, paidDate, createdAt',
    documents: '++id, name, type, category, relatedId, uploadDate, createdAt',
    settings: '++id, &key, updatedAt',
  });

  // Futures versions à ajouter ici
  // database.version(2).stores({
  //   properties: '++id, name, address, city, postalCode, type, status, price, archived, createdAt',
  //   // ... autres tables inchangées
  // }).upgrade(async (transaction) => {
  //   // Code de migration si nécessaire
  //   const migration = migrations.find(m => m.version === 2);
  //   if (migration) {
  //     await migration.upgrade(transaction);
  //   }
  // });
}

/**
 * Rollback de la base de données (pour développement uniquement)
 * ATTENTION: Supprime toutes les données !
 */
export async function resetDatabase(): Promise<void> {
  if (import.meta.env.PROD) {
    throw new Error('resetDatabase is not allowed in production');
  }

  console.warn('⚠️  Resetting database - All data will be lost!');
  await db.delete();
  await db.open();
  console.log('✅ Database reset complete');
}

/**
 * Exporte la structure de la base de données pour backup
 */
export async function exportDatabaseSchema(): Promise<{
  version: number;
  tables: Record<string, string>;
}> {
  const tables: Record<string, string> = {};

  for (const table of db.tables) {
    const schema = table.schema;
    const indexes = [
      schema.primKey.src,
      ...schema.indexes.map(idx => {
        const prefix = idx.unique ? '&' : idx.multi ? '*' : '';
        return prefix + idx.src;
      }),
    ].join(', ');

    tables[table.name] = indexes;
  }

  return {
    version: db.verno,
    tables,
  };
}
