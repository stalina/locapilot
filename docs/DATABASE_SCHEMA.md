# Schéma de Base de Données - Locapilot

Documentation du schéma de base de données IndexedDB avec Dexie.js.

## Vue d'ensemble

Locapilot utilise **IndexedDB** via **Dexie.js** pour un stockage local offline-first. Toutes les données sont stockées localement dans le navigateur.

### Version actuelle

**Version 1** - Schéma initial

### Tables

- `properties` - Propriétés immobilières
- `tenants` - Locataires et candidats
- `leases` - Baux
- `rents` - Loyers et paiements
- `documents` - Documents attachés
- `settings` - Paramètres utilisateur

---

## Table: `properties`

Stocke les informations sur les biens immobiliers gérés.

### Structure

```typescript
interface Property {
  id?: number; // Auto-increment
  name: string; // Nom du bien
  address: string; // Adresse complète
  type: PropertyType; // Type de bien
  surface: number; // Surface en m²
  rooms: number; // Nombre de pièces
  bedrooms?: number; // Nombre de chambres
  bathrooms?: number; // Nombre de salles de bain
  rent: number; // Loyer mensuel en €
  charges?: number; // Charges en €
  deposit?: number; // Dépôt de garantie en €
  status: PropertyStatus; // Statut (vacant/occupied/maintenance)
  description?: string; // Description
  features?: string[]; // Équipements (parking, balcon, etc.)
  createdAt: Date; // Date de création
  updatedAt: Date; // Date de mise à jour
}

type PropertyType = 'apartment' | 'house' | 'commercial' | 'parking' | 'other';
type PropertyStatus = 'vacant' | 'occupied' | 'maintenance';
```

### Indexes

```typescript
properties.schema = {
  id: '++',
  name: '',
  type: '',
  status: '',
  createdAt: '',
};
```

- **Primary key**: `id` (auto-increment)
- **Index**: `name` - Recherche par nom
- **Index**: `type` - Filtrage par type
- **Index**: `status` - Filtrage par statut
- **Index**: `createdAt` - Tri chronologique

### Exemples de requêtes

```typescript
// Toutes les propriétés
await db.properties.toArray();

// Propriétés vacantes
await db.properties.where('status').equals('vacant').toArray();

// Recherche par nom
await db.properties.where('name').startsWithIgnoreCase('Rue').toArray();

// Appartements occupés
await db.properties.where({ type: 'apartment', status: 'occupied' }).toArray();

// Tri par date de création
await db.properties.orderBy('createdAt').reverse().toArray();
```

---

## Table: `tenants`

Stocke les locataires actifs et les candidats.

### Structure

```typescript
interface Tenant {
  id?: number; // Auto-increment
  firstName: string; // Prénom
  lastName: string; // Nom
  email: string; // Email
  phone: string; // Téléphone
  status: TenantStatus; // Statut
  dateOfBirth?: string; // Date de naissance
  occupation?: string; // Profession
  income?: number; // Revenus mensuels
  notes?: string; // Notes
  documents?: number[]; // IDs des documents associés
  createdAt: Date; // Date de création
  updatedAt: Date; // Date de mise à jour
}

type TenantStatus = 'candidate' | 'active' | 'former';
```

### Indexes

```typescript
tenants.schema = {
  id: '++',
  firstName: '',
  lastName: '',
  email: '',
  status: '',
  createdAt: '',
};
```

- **Primary key**: `id` (auto-increment)
- **Index**: `firstName`, `lastName` - Recherche par nom
- **Index**: `email` - Recherche par email (unique)
- **Index**: `status` - Filtrage par statut
- **Index**: `createdAt` - Tri chronologique

### Workflow Candidat → Locataire

Lorsqu'un bail est créé pour un candidat (`status: 'candidate'`), celui-ci est automatiquement converti en locataire actif (`status: 'active'`).

```typescript
// Conversion automatique dans LeaseFormModal
for (const tenantId of formData.value.tenantIds) {
  const tenant = tenantsStore.tenants.find(t => t.id === tenantId);
  if (tenant && tenant.status === 'candidate') {
    await tenantsStore.updateTenant(tenantId, {
      ...tenant,
      status: 'active',
    });
  }
}
```

### Exemples de requêtes

```typescript
// Tous les locataires actifs
await db.tenants.where('status').equals('active').toArray();

// Tous les candidats
await db.tenants.where('status').equals('candidate').toArray();

// Recherche par nom
await db.tenants.where('lastName').startsWithIgnoreCase('Dupont').toArray();

// Recherche par email
await db.tenants.where('email').equals('jean@example.com').first();
```

---

## Table: `leases`

Stocke les contrats de location (baux).

### Structure

```typescript
interface Lease {
  id?: number; // Auto-increment
  propertyId: number; // ID de la propriété
  tenantIds: number[]; // IDs des locataires (co-location)
  startDate: string; // Date de début (YYYY-MM-DD)
  endDate?: string; // Date de fin (YYYY-MM-DD)
  rent: number; // Loyer mensuel en €
  charges?: number; // Charges en €
  deposit: number; // Dépôt de garantie en €
  paymentDay: number; // Jour de paiement (1-31)
  type: LeaseType; // Type de bail
  status: LeaseStatus; // Statut
  notes?: string; // Notes
  documentIds?: number[]; // IDs des documents
  createdAt: Date; // Date de création
  updatedAt: Date; // Date de mise à jour
}

type LeaseType = 'residential' | 'commercial' | 'furnished' | 'seasonal';
type LeaseStatus = 'active' | 'ended' | 'renewed';
```

### Indexes

```typescript
leases.schema = {
  id: '++',
  propertyId: '',
  status: '',
  startDate: '',
  createdAt: '',
};
```

- **Primary key**: `id` (auto-increment)
- **Index**: `propertyId` - Baux par propriété
- **Index**: `status` - Filtrage par statut
- **Index**: `startDate` - Tri chronologique
- **Index**: `createdAt` - Date de création

### Relations

- **One-to-One**: `lease.propertyId` → `properties.id`
- **One-to-Many**: `lease.tenantIds[]` → `tenants.id`

### Exemples de requêtes

```typescript
// Baux actifs
await db.leases.where('status').equals('active').toArray();

// Baux d'une propriété
await db.leases.where('propertyId').equals(1).toArray();

// Baux d'un locataire
const leases = await db.leases.toArray();
const tenantLeases = leases.filter(l => l.tenantIds.includes(tenantId));

// Bail avec relations
const lease = await db.leases.get(1);
const property = await db.properties.get(lease.propertyId);
const tenants = await db.tenants.bulkGet(lease.tenantIds);
```

---

## Table: `rents`

Stocke les loyers et leurs paiements.

### Structure

```typescript
interface Rent {
  id?: number; // Auto-increment
  leaseId: number; // ID du bail
  month: string; // Mois (YYYY-MM)
  amount: number; // Montant loyer en €
  charges?: number; // Charges en €
  totalAmount: number; // Total (loyer + charges)
  status: RentStatus; // Statut paiement
  paymentDate?: string; // Date de paiement (YYYY-MM-DD)
  paymentMethod?: PaymentMethod; // Méthode de paiement
  notes?: string; // Notes
  createdAt: Date; // Date de création
  updatedAt: Date; // Date de mise à jour
}

type RentStatus = 'pending' | 'paid' | 'partial' | 'late' | 'cancelled';
type PaymentMethod = 'transfer' | 'check' | 'cash' | 'card';
```

### Indexes

```typescript
rents.schema = {
  id: '++',
  leaseId: '',
  month: '',
  status: '',
  createdAt: '',
};
```

- **Primary key**: `id` (auto-increment)
- **Index**: `leaseId` - Loyers par bail
- **Index**: `month` - Loyers par mois
- **Index**: `status` - Filtrage par statut
- **Index**: `createdAt` - Date de création

### Relations

- **Many-to-One**: `rent.leaseId` → `leases.id`

### Exemples de requêtes

```typescript
// Loyers d'un bail
await db.rents.where('leaseId').equals(1).toArray();

// Loyers en attente
await db.rents.where('status').equals('pending').toArray();

// Loyers d'un mois
await db.rents.where('month').equals('2025-11').toArray();

// Loyers en retard
const today = new Date().toISOString().split('T')[0];
const lateRents = await db.rents
  .where('status')
  .equals('pending')
  .and(r => r.month < today.substring(0, 7))
  .toArray();
```

---

## Table: `documents`

Stocke les documents uploadés (contrats, factures, etc.).

### Structure

```typescript
interface Document {
  id?: number; // Auto-increment
  name: string; // Nom du fichier
  type: string; // Type MIME
  size: number; // Taille en bytes
  category: DocumentCategory; // Catégorie
  entityType?: EntityType; // Type d'entité liée
  entityId?: number; // ID de l'entité liée
  file: Blob; // Fichier binaire
  uploadDate: Date; // Date d'upload
  createdAt: Date; // Date de création
  updatedAt: Date; // Date de mise à jour
}

type DocumentCategory = 'lease' | 'invoice' | 'receipt' | 'id' | 'payslip' | 'inventory' | 'other';

type EntityType = 'property' | 'tenant' | 'lease' | 'rent';
```

### Indexes

```typescript
documents.schema = {
  id: '++',
  name: '',
  category: '',
  entityType: '',
  entityId: '',
  uploadDate: '',
};
```

- **Primary key**: `id` (auto-increment)
- **Index**: `name` - Recherche par nom
- **Index**: `category` - Filtrage par catégorie
- **Index**: `entityType`, `entityId` - Documents par entité
- **Index**: `uploadDate` - Tri chronologique

### Exemples de requêtes

```typescript
// Tous les documents
await db.documents.toArray();

// Documents d'une propriété
await db.documents.where({ entityType: 'property', entityId: 1 }).toArray();

// Documents par catégorie
await db.documents.where('category').equals('lease').toArray();

// Recherche par nom
await db.documents.where('name').startsWithIgnoreCase('Bail').toArray();
```

---

## Table: `settings`

Stocke les paramètres utilisateur de l'application.

### Structure

```typescript
interface Setting {
  key: string; // Clé unique (primary)
  value: any; // Valeur (JSON serializable)
  updatedAt: Date; // Date de mise à jour
}
```

### Indexes

```typescript
settings.schema = {
  key: '', // Primary key
};
```

- **Primary key**: `key` (unique)

### Paramètres disponibles

```typescript
type SettingsKeys =
  | 'theme' // 'light' | 'dark' | 'auto'
  | 'language' // 'fr' | 'en'
  | 'currency' // 'EUR' | 'USD'
  | 'dateFormat' // 'DD/MM/YYYY' | 'MM/DD/YYYY'
  | 'notifications' // boolean
  | 'autoSave' // boolean
  | 'compactMode'; // boolean
```

### Exemples de requêtes

```typescript
// Obtenir un paramètre
const setting = await db.settings.get('theme');
const theme = setting?.value ?? 'light';

// Définir un paramètre
await db.settings.put({
  key: 'theme',
  value: 'dark',
  updatedAt: new Date(),
});

// Tous les paramètres
const allSettings = await db.settings.toArray();
const settingsObject = Object.fromEntries(allSettings.map(s => [s.key, s.value]));
```

---

## Migrations

### Système de migrations

Le schéma utilise Dexie.js versioning pour les migrations futures.

```typescript
export const db = new Dexie('LocapilotDB') as Dexie & LocapilotDB;

db.version(1).stores({
  properties: '++id, name, type, status, createdAt',
  tenants: '++id, firstName, lastName, email, status, createdAt',
  leases: '++id, propertyId, status, startDate, createdAt',
  rents: '++id, leaseId, month, status, createdAt',
  documents: '++id, name, category, entityType, entityId, uploadDate',
  settings: 'key',
});

// Future migrations
db.version(2)
  .stores({
    // Ajout de nouvelles tables ou modification d'indexes
    expenses: '++id, propertyId, date, amount',
  })
  .upgrade(async tx => {
    // Migration de données si nécessaire
  });
```

### Planification migrations futures

**Version 2** (à venir):

- Table `expenses` - Dépenses et charges
- Table `inventories` - États des lieux
- Table `communications` - Messages et rappels
- Table `visits` - Visites programmées

---

## Bonnes pratiques

### 1. Transactions

Utiliser des transactions pour les opérations atomiques :

```typescript
await db.transaction('rw', [db.leases, db.tenants], async () => {
  // Créer le bail
  const leaseId = await db.leases.add(leaseData);

  // Convertir candidat en locataire
  await db.tenants.update(tenantId, { status: 'active' });
});
```

### 2. Validation

Valider les données avant insertion :

```typescript
if (!property.name || property.rent < 0) {
  throw new Error('Invalid property data');
}
await db.properties.add(property);
```

### 3. Relations

Utiliser `bulkGet` pour charger plusieurs entités liées :

```typescript
const lease = await db.leases.get(1);
const [property, ...tenants] = await Promise.all([
  db.properties.get(lease.propertyId),
  db.tenants.bulkGet(lease.tenantIds),
]);
```

### 4. Recherche full-text

Pour recherche avancée, combiner plusieurs indexes :

```typescript
const searchTerm = 'dupont';
const results = await db.tenants
  .where('lastName')
  .startsWithIgnoreCase(searchTerm)
  .or('firstName')
  .startsWithIgnoreCase(searchTerm)
  .or('email')
  .startsWithIgnoreCase(searchTerm)
  .toArray();
```

### 5. Pagination

Implémenter la pagination efficacement :

```typescript
const pageSize = 20;
const page = 2;

const properties = await db.properties
  .orderBy('createdAt')
  .reverse()
  .offset(page * pageSize)
  .limit(pageSize)
  .toArray();
```

---

## Taille et limites

### Limites IndexedDB

- **Quota navigateur** : ~50% de l'espace disque disponible (varie selon navigateur)
- **Taille par table** : Illimitée (dans la limite du quota)
- **Nombre d'enregistrements** : Illimité
- **Taille fichier (Blob)** : Limité par le quota global

### Monitoring

```typescript
// Vérifier l'utilisation du stockage
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage / (1024 * 1024); // MB
  const quota = estimate.quota / (1024 * 1024); // MB
  console.log(`Using ${usage.toFixed(2)} MB of ${quota.toFixed(2)} MB`);
}
```

---

## Backup et Export

### Export données

```typescript
// Export toutes les données
const backup = {
  properties: await db.properties.toArray(),
  tenants: await db.tenants.toArray(),
  leases: await db.leases.toArray(),
  rents: await db.rents.toArray(),
  documents: await db.documents.toArray(),
  settings: await db.settings.toArray(),
};

const json = JSON.stringify(backup);
// Télécharger ou sauvegarder
```

### Import données

```typescript
// Import depuis backup
const importData = async (backup: any) => {
  await db.transaction('rw', db.tables, async () => {
    await db.properties.bulkAdd(backup.properties);
    await db.tenants.bulkAdd(backup.tenants);
    await db.leases.bulkAdd(backup.leases);
    await db.rents.bulkAdd(backup.rents);
    await db.documents.bulkAdd(backup.documents);
    await db.settings.bulkPut(backup.settings);
  });
};
```

---

## Performance

### Conseils d'optimisation

1. **Indexes appropriés** : Indexer les champs utilisés dans `where()`
2. **Éviter les scans complets** : Toujours utiliser des indexes
3. **Bulk operations** : Préférer `bulkAdd`, `bulkPut`, `bulkDelete`
4. **Transactions** : Grouper les opérations liées
5. **Lazy loading** : Charger les relations à la demande

### Exemple optimisé

```typescript
// ❌ Lent - Scan complet + N+1 queries
const leases = await db.leases.toArray();
for (const lease of leases) {
  lease.property = await db.properties.get(lease.propertyId);
}

// ✅ Rapide - Index + bulk load
const leases = await db.leases.where('status').equals('active').toArray();
const propertyIds = [...new Set(leases.map(l => l.propertyId))];
const properties = await db.properties.bulkGet(propertyIds);
const propertyMap = new Map(properties.map(p => [p.id, p]));
leases.forEach(l => (l.property = propertyMap.get(l.propertyId)));
```

---

## Diagramme des relations

```
┌─────────────┐
│ properties  │
│ ────────────│
│ id (PK)     │◄───┐
│ name        │    │
│ type        │    │
│ status      │    │
└─────────────┘    │
                   │
                   │ propertyId
                   │
┌─────────────┐    │
│ leases      │    │
│ ────────────│    │
│ id (PK)     │────┘
│ propertyId  │
│ tenantIds[] │────┐
│ status      │    │
└─────────────┘    │
       ▲           │
       │           │
       │ leaseId   │ tenantIds
       │           │
┌─────────────┐    │
│ rents       │    │
│ ────────────│    │
│ id (PK)     │    │
│ leaseId     │────┘
│ month       │
│ status      │
└─────────────┘

┌─────────────┐
│ tenants     │
│ ────────────│
│ id (PK)     │◄───┘
│ firstName   │
│ lastName    │
│ status      │
└─────────────┘

┌─────────────┐
│ documents   │
│ ────────────│
│ id (PK)     │
│ entityType  │
│ entityId    │─── (peut référencer n'importe quelle table)
│ category    │
└─────────────┘

┌─────────────┐
│ settings    │
│ ────────────│
│ key (PK)    │
│ value       │
└─────────────┘
```

---

Cette documentation sera mise à jour à chaque évolution du schéma.
