# Documentation API - Locapilot

Documentation JSDoc/TSDoc des principales fonctions, stores et composables.

---

## Table des matières

1. [Database API](#database-api)
2. [Stores API](#stores-api)
3. [Composables API](#composables-api)
4. [Shared Components API](#shared-components-api)
5. [Utils API](#utils-api)

---

## Database API

### `db/database.ts`

#### `db.properties`

API de gestion des propriétés.

```typescript
/**
 * Table des propriétés immobilières
 * @table properties
 * @version 1
 */
interface PropertiesTable extends Table<Property, number> {
  /**
   * Récupère toutes les propriétés
   * @returns Promise<Property[]>
   * @example
   * const properties = await db.properties.toArray();
   */
  toArray(): Promise<Property[]>;

  /**
   * Récupère une propriété par ID
   * @param id - ID de la propriété
   * @returns Promise<Property | undefined>
   * @example
   * const property = await db.properties.get(1);
   */
  get(id: number): Promise<Property | undefined>;

  /**
   * Ajoute une nouvelle propriété
   * @param property - Données de la propriété (sans id)
   * @returns Promise<number> - ID de la propriété créée
   * @throws {Error} Si validation échoue
   * @example
   * const id = await db.properties.add({
   *   name: 'Appartement Paris',
   *   type: 'apartment',
   *   rent: 1200,
   *   status: 'vacant',
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   */
  add(property: Omit<Property, 'id'>): Promise<number>;

  /**
   * Met à jour une propriété existante
   * @param id - ID de la propriété
   * @param changes - Champs à modifier
   * @returns Promise<number> - Nombre de modifications (0 ou 1)
   * @example
   * await db.properties.update(1, { status: 'occupied' });
   */
  update(id: number, changes: Partial<Property>): Promise<number>;

  /**
   * Supprime une propriété
   * @param id - ID de la propriété
   * @returns Promise<void>
   * @example
   * await db.properties.delete(1);
   */
  delete(id: number): Promise<void>;

  /**
   * Filtre les propriétés par statut
   * @param status - Statut recherché
   * @returns Collection<Property, number>
   * @example
   * const vacantProperties = await db.properties
   *   .where('status').equals('vacant')
   *   .toArray();
   */
  where(field: keyof Property): Collection<Property, number>;
}
```

#### `db.tenants`

```typescript
/**
 * Table des locataires
 * @table tenants
 * @version 1
 */
interface TenantsTable extends Table<Tenant, number> {
  /**
   * Recherche les locataires par nom (insensible à la casse)
   * @param lastName - Nom de famille (ou début)
   * @returns Promise<Tenant[]>
   * @example
   * const tenants = await db.tenants
   *   .where('lastName')
   *   .startsWithIgnoreCase('Dupont')
   *   .toArray();
   */
  where(field: 'lastName' | 'firstName' | 'email'): Collection<Tenant, number>;

  /**
   * Récupère tous les locataires actifs
   * @returns Promise<Tenant[]>
   * @example
   * const activeTenants = await db.tenants
   *   .where('status').equals('active')
   *   .toArray();
   */
  where(field: 'status'): Collection<Tenant, number>;
}
```

#### `db.leases`

```typescript
/**
 * Table des baux
 * @table leases
 * @version 1
 */
interface LeasesTable extends Table<Lease, number> {
  /**
   * Récupère les baux d'une propriété
   * @param propertyId - ID de la propriété
   * @returns Promise<Lease[]>
   * @example
   * const leases = await db.leases
   *   .where('propertyId').equals(1)
   *   .toArray();
   */
  where(field: 'propertyId'): Collection<Lease, number>;

  /**
   * Récupère les baux actifs
   * @returns Promise<Lease[]>
   * @example
   * const activeLeases = await db.leases
   *   .where('status').equals('active')
   *   .toArray();
   */
  where(field: 'status'): Collection<Lease, number>;
}
```

#### `db.rents`

```typescript
/**
 * Table des loyers
 * @table rents
 * @version 1
 */
interface RentsTable extends Table<Rent, number> {
  /**
   * Récupère les loyers d'un bail
   * @param leaseId - ID du bail
   * @returns Promise<Rent[]>
   * @example
   * const rents = await db.rents
   *   .where('leaseId').equals(1)
   *   .orderBy('month')
   *   .toArray();
   */
  where(field: 'leaseId'): Collection<Rent, number>;

  /**
   * Récupère les loyers d'un mois donné
   * @param month - Mois au format YYYY-MM
   * @returns Promise<Rent[]>
   * @example
   * const novemberRents = await db.rents
   *   .where('month').equals('2025-11')
   *   .toArray();
   */
  where(field: 'month'): Collection<Rent, number>;

  /**
   * Récupère les loyers en attente de paiement
   * @returns Promise<Rent[]>
   * @example
   * const pendingRents = await db.rents
   *   .where('status').equals('pending')
   *   .toArray();
   */
  where(field: 'status'): Collection<Rent, number>;
}
```

#### `db.documents`

```typescript
/**
 * Table des documents
 * @table documents
 * @version 1
 */
interface DocumentsTable extends Table<Document, number> {
  /**
   * Récupère les documents d'une entité
   * @param entityType - Type d'entité ('property' | 'tenant' | 'lease' | 'rent')
   * @param entityId - ID de l'entité
   * @returns Promise<Document[]>
   * @example
   * const propertyDocs = await db.documents
   *   .where({ entityType: 'property', entityId: 1 })
   *   .toArray();
   */
  where(filter: { entityType: EntityType; entityId: number }): Collection<Document, number>;

  /**
   * Filtre les documents par catégorie
   * @param category - Catégorie de document
   * @returns Promise<Document[]>
   * @example
   * const leases = await db.documents
   *   .where('category').equals('lease')
   *   .toArray();
   */
  where(field: 'category'): Collection<Document, number>;
}
```

#### Seed Data

```typescript
/**
 * Initialise la base de données avec des données de test
 * @async
 * @returns Promise<void>
 * @description Ajoute 4 propriétés, 6 locataires, 3 baux, et loyers associés
 * @example
 * import { seedDatabase } from '@/db/seed';
 * await seedDatabase();
 */
export async function seedDatabase(): Promise<void>;
```

---

## Stores API

### Properties Store

`features/properties/stores/propertiesStore.ts`

```typescript
/**
 * Store de gestion des propriétés immobilières
 * @store properties
 * @description Gère l'état et les actions CRUD sur les propriétés
 */
export const usePropertiesStore = defineStore('properties', () => {
  /**
   * Liste de toutes les propriétés
   * @type {Ref<Property[]>}
   * @reactive
   */
  const properties: Ref<Property[]> = ref([]);

  /**
   * État de chargement
   * @type {Ref<boolean>}
   * @reactive
   */
  const loading: Ref<boolean> = ref(false);

  /**
   * Propriétés vacantes (disponibles à la location)
   * @computed
   * @returns {Property[]} Propriétés avec status 'vacant'
   * @example
   * const store = usePropertiesStore();
   * const available = store.vacantProperties;
   */
  const vacantProperties = computed<Property[]>(() =>
    properties.value.filter(p => p.status === 'vacant')
  );

  /**
   * Propriétés occupées
   * @computed
   * @returns {Property[]} Propriétés avec status 'occupied'
   */
  const occupiedProperties = computed<Property[]>(() =>
    properties.value.filter(p => p.status === 'occupied')
  );

  /**
   * Nombre total de propriétés
   * @computed
   * @returns {number}
   */
  const totalProperties = computed<number>(() => properties.value.length);

  /**
   * Charge toutes les propriétés depuis la base de données
   * @async
   * @returns {Promise<void>}
   * @throws {Error} Si la récupération échoue
   * @example
   * const store = usePropertiesStore();
   * await store.fetchProperties();
   */
  async function fetchProperties(): Promise<void>;

  /**
   * Récupère une propriété par son ID
   * @async
   * @param {number} id - ID de la propriété
   * @returns {Promise<Property | undefined>}
   * @example
   * const property = await store.getPropertyById(1);
   */
  async function getPropertyById(id: number): Promise<Property | undefined>;

  /**
   * Crée une nouvelle propriété
   * @async
   * @param {Omit<Property, 'id' | 'createdAt' | 'updatedAt'>} property - Données de la propriété
   * @returns {Promise<number>} ID de la propriété créée
   * @throws {Error} Si la validation échoue
   * @example
   * const id = await store.createProperty({
   *   name: 'Appartement Paris',
   *   type: 'apartment',
   *   rent: 1200,
   *   status: 'vacant',
   * });
   */
  async function createProperty(
    property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number>;

  /**
   * Met à jour une propriété existante
   * @async
   * @param {number} id - ID de la propriété
   * @param {Partial<Property>} updates - Champs à modifier
   * @returns {Promise<void>}
   * @throws {Error} Si la propriété n'existe pas
   * @example
   * await store.updateProperty(1, { status: 'occupied' });
   */
  async function updateProperty(id: number, updates: Partial<Property>): Promise<void>;

  /**
   * Supprime une propriété
   * @async
   * @param {number} id - ID de la propriété
   * @returns {Promise<void>}
   * @throws {Error} Si la propriété a des baux actifs
   * @example
   * await store.deleteProperty(1);
   */
  async function deleteProperty(id: number): Promise<void>;

  return {
    properties,
    loading,
    vacantProperties,
    occupiedProperties,
    totalProperties,
    fetchProperties,
    getPropertyById,
    createProperty,
    updateProperty,
    deleteProperty,
  };
});
```

### Tenants Store

`features/tenants/stores/tenantsStore.ts`

```typescript
/**
 * Store de gestion des locataires
 * @store tenants
 * @description Gère l'état et les actions CRUD sur les locataires et candidats
 */
export const useTenantsStore = defineStore('tenants', () => {
  /**
   * Liste de tous les locataires et candidats
   * @type {Ref<Tenant[]>}
   * @reactive
   */
  const tenants: Ref<Tenant[]> = ref([]);

  /**
   * Locataires actifs (sous bail)
   * @computed
   * @returns {Tenant[]} Locataires avec status 'active'
   */
  const activeTenants = computed<Tenant[]>(() => tenants.value.filter(t => t.status === 'active'));

  /**
   * Candidats (en recherche de logement)
   * @computed
   * @returns {Tenant[]} Locataires avec status 'candidate'
   */
  const candidates = computed<Tenant[]>(() => tenants.value.filter(t => t.status === 'candidate'));

  /**
   * Anciens locataires
   * @computed
   * @returns {Tenant[]} Locataires avec status 'former'
   */
  const formerTenants = computed<Tenant[]>(() => tenants.value.filter(t => t.status === 'former'));

  /**
   * Charge tous les locataires depuis la base de données
   * @async
   * @returns {Promise<void>}
   */
  async function fetchTenants(): Promise<void>;

  /**
   * Crée un nouveau locataire ou candidat
   * @async
   * @param {Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>} tenant - Données du locataire
   * @returns {Promise<number>} ID du locataire créé
   * @example
   * const id = await store.createTenant({
   *   firstName: 'Jean',
   *   lastName: 'Dupont',
   *   email: 'jean@example.com',
   *   phone: '0612345678',
   *   status: 'candidate',
   * });
   */
  async function createTenant(
    tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number>;

  /**
   * Met à jour un locataire
   * @async
   * @param {number} id - ID du locataire
   * @param {Partial<Tenant>} updates - Champs à modifier
   * @returns {Promise<void>}
   * @example
   * // Convertir candidat en locataire actif
   * await store.updateTenant(1, { status: 'active' });
   */
  async function updateTenant(id: number, updates: Partial<Tenant>): Promise<void>;

  /**
   * Supprime un locataire
   * @async
   * @param {number} id - ID du locataire
   * @returns {Promise<void>}
   * @throws {Error} Si le locataire a un bail actif
   */
  async function deleteTenant(id: number): Promise<void>;

  return {
    tenants,
    activeTenants,
    candidates,
    formerTenants,
    fetchTenants,
    createTenant,
    updateTenant,
    deleteTenant,
  };
});
```

### Leases Store

`features/leases/stores/leasesStore.ts`

```typescript
/**
 * Store de gestion des baux (contrats de location)
 * @store leases
 */
export const useLeasesStore = defineStore('leases', () => {
  /**
   * Liste de tous les baux
   * @type {Ref<Lease[]>}
   * @reactive
   */
  const leases: Ref<Lease[]> = ref([]);

  /**
   * Baux actifs
   * @computed
   * @returns {Lease[]} Baux avec status 'active'
   */
  const activeLeases = computed<Lease[]>(() => leases.value.filter(l => l.status === 'active'));

  /**
   * Baux terminés
   * @computed
   * @returns {Lease[]} Baux avec status 'ended'
   */
  const endedLeases = computed<Lease[]>(() => leases.value.filter(l => l.status === 'ended'));

  /**
   * Crée un nouveau bail
   * @async
   * @param {Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>} lease - Données du bail
   * @returns {Promise<number>} ID du bail créé
   * @description Crée le bail et convertit automatiquement les candidats en locataires actifs
   * @example
   * const id = await store.createLease({
   *   propertyId: 1,
   *   tenantIds: [2, 3],
   *   startDate: '2025-12-01',
   *   rent: 1200,
   *   deposit: 2400,
   *   paymentDay: 5,
   *   type: 'residential',
   *   status: 'active',
   * });
   */
  async function createLease(lease: Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>;

  /**
   * Termine un bail
   * @async
   * @param {number} id - ID du bail
   * @param {string} endDate - Date de fin (YYYY-MM-DD)
   * @returns {Promise<void>}
   * @description Met le bail en 'ended', la propriété en 'vacant', les locataires en 'former'
   * @example
   * await store.endLease(1, '2025-11-30');
   */
  async function endLease(id: number, endDate: string): Promise<void>;

  return {
    leases,
    activeLeases,
    endedLeases,
    fetchLeases,
    createLease,
    updateLease,
    endLease,
  };
});
```

### Rents Store

`features/rents/stores/rentsStore.ts`

```typescript
/**
 * Store de gestion des loyers et paiements
 * @store rents
 */
export const useRentsStore = defineStore('rents', () => {
  /**
   * Liste de tous les loyers
   * @type {Ref<Rent[]>}
   * @reactive
   */
  const rents: Ref<Rent[]> = ref([]);

  /**
   * Loyers en attente de paiement
   * @computed
   * @returns {Rent[]} Loyers avec status 'pending'
   */
  const pendingRents = computed<Rent[]>(() => rents.value.filter(r => r.status === 'pending'));

  /**
   * Loyers payés
   * @computed
   * @returns {Rent[]} Loyers avec status 'paid'
   */
  const paidRents = computed<Rent[]>(() => rents.value.filter(r => r.status === 'paid'));

  /**
   * Loyers en retard
   * @computed
   * @returns {Rent[]} Loyers 'pending' dont le mois est passé
   */
  const lateRents = computed<Rent[]>(() => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    return rents.value.filter(r => r.status === 'pending' && r.month < currentMonth);
  });

  /**
   * Total des loyers à recevoir (en attente)
   * @computed
   * @returns {number} Somme des totalAmount des loyers pending
   */
  const totalPending = computed<number>(() =>
    pendingRents.value.reduce((sum, r) => sum + r.totalAmount, 0)
  );

  /**
   * Total des loyers reçus ce mois
   * @computed
   * @returns {number} Somme des totalAmount des loyers paid ce mois
   */
  const totalPaidThisMonth = computed<number>(() => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    return rents.value
      .filter(r => r.status === 'paid' && r.month === currentMonth)
      .reduce((sum, r) => sum + r.totalAmount, 0);
  });

  /**
   * Marque un loyer comme payé
   * @async
   * @param {number} id - ID du loyer
   * @param {string} paymentDate - Date de paiement (YYYY-MM-DD)
   * @param {PaymentMethod} paymentMethod - Méthode de paiement
   * @returns {Promise<void>}
   * @example
   * await store.markAsPaid(1, '2025-11-05', 'transfer');
   */
  async function markAsPaid(
    id: number,
    paymentDate: string,
    paymentMethod: PaymentMethod
  ): Promise<void>;

  /**
   * Génère les loyers pour un bail donné sur une période
   * @async
   * @param {number} leaseId - ID du bail
   * @param {string} startMonth - Mois de début (YYYY-MM)
   * @param {number} monthsCount - Nombre de mois à générer
   * @returns {Promise<void>}
   * @description Crée automatiquement les loyers mensuels avec status 'pending'
   * @example
   * // Générer 12 mois de loyers
   * await store.generateRentsForLease(1, '2025-12', 12);
   */
  async function generateRentsForLease(
    leaseId: number,
    startMonth: string,
    monthsCount: number
  ): Promise<void>;

  return {
    rents,
    pendingRents,
    paidRents,
    lateRents,
    totalPending,
    totalPaidThisMonth,
    fetchRents,
    markAsPaid,
    generateRentsForLease,
  };
});
```

---

## Composables API

### `db/composables/useDatabase.ts`

```typescript
/**
 * Composable pour gérer l'état de la base de données
 * @composable
 * @returns {Object} État et méthodes de la base de données
 */
export function useDatabase() {
  /**
   * État de connexion de la base de données
   * @type {Ref<boolean>}
   */
  const isOpen: Ref<boolean> = ref(false);

  /**
   * Erreur de connexion éventuelle
   * @type {Ref<Error | null>}
   */
  const error: Ref<Error | null> = ref(null);

  /**
   * Initialise la base de données et charge les données de seed si vide
   * @async
   * @returns {Promise<void>}
   * @example
   * const { initDatabase } = useDatabase();
   * await initDatabase();
   */
  async function initDatabase(): Promise<void>;

  /**
   * Ferme proprement la base de données
   * @async
   * @returns {Promise<void>}
   */
  async function closeDatabase(): Promise<void>;

  /**
   * Exporte toutes les données en JSON
   * @async
   * @returns {Promise<string>} JSON stringifié de toutes les tables
   * @example
   * const { exportData } = useDatabase();
   * const json = await exportData();
   * // Télécharger le fichier
   */
  async function exportData(): Promise<string>;

  /**
   * Importe des données depuis un JSON
   * @async
   * @param {string} jsonData - Données JSON à importer
   * @returns {Promise<void>}
   * @throws {Error} Si le format JSON est invalide
   * @example
   * const { importData } = useDatabase();
   * await importData(backupJson);
   */
  async function importData(jsonData: string): Promise<void>;

  /**
   * Vide complètement la base de données
   * @async
   * @returns {Promise<void>}
   * @warning Supprime toutes les données de manière irréversible
   */
  async function clearDatabase(): Promise<void>;

  return {
    isOpen,
    error,
    initDatabase,
    closeDatabase,
    exportData,
    importData,
    clearDatabase,
  };
}
```

---

## Shared Components API

### `shared/components/Button.vue`

```typescript
/**
 * Composant bouton réutilisable avec variants Tailwind
 * @component Button
 * @example
 * <Button variant="primary" size="md" @click="handleClick">
 *   Enregistrer
 * </Button>
 */

/**
 * Props du composant Button
 */
interface ButtonProps {
  /**
   * Variant visuel du bouton
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';

  /**
   * Taille du bouton
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Bouton désactivé
   * @default false
   */
  disabled?: boolean;

  /**
   * État de chargement (affiche un spinner)
   * @default false
   */
  loading?: boolean;

  /**
   * Bouton pleine largeur
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Icône à gauche du texte
   * @optional
   */
  icon?: string;
}

/**
 * Événements émis par le bouton
 */
interface ButtonEmits {
  /**
   * Émis lors d'un clic sur le bouton
   * @event click
   */
  (e: 'click', event: MouseEvent): void;
}
```

### `shared/components/Input.vue`

```typescript
/**
 * Composant input réutilisable avec validation
 * @component Input
 * @example
 * <Input
 *   v-model="name"
 *   label="Nom"
 *   placeholder="Entrez votre nom"
 *   :error="errors.name"
 *   required
 * />
 */

/**
 * Props du composant Input
 */
interface InputProps {
  /**
   * Valeur du champ (v-model)
   */
  modelValue: string | number;

  /**
   * Label du champ
   * @optional
   */
  label?: string;

  /**
   * Type de l'input
   * @default 'text'
   */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

  /**
   * Placeholder
   * @optional
   */
  placeholder?: string;

  /**
   * Message d'erreur de validation
   * @optional
   */
  error?: string;

  /**
   * Champ requis (affiche une astérisque)
   * @default false
   */
  required?: boolean;

  /**
   * Champ désactivé
   * @default false
   */
  disabled?: boolean;
}

/**
 * Événements émis
 */
interface InputEmits {
  /**
   * Mise à jour de la valeur (v-model)
   * @event update:modelValue
   */
  (e: 'update:modelValue', value: string | number): void;

  /**
   * Focus sur le champ
   * @event focus
   */
  (e: 'focus', event: FocusEvent): void;

  /**
   * Perte de focus
   * @event blur
   */
  (e: 'blur', event: FocusEvent): void;
}
```

### `shared/components/Modal.vue`

```typescript
/**
 * Composant modal réutilisable avec overlay
 * @component Modal
 * @example
 * <Modal
 *   :show="isOpen"
 *   title="Confirmation"
 *   @close="isOpen = false"
 * >
 *   <p>Êtes-vous sûr de vouloir continuer ?</p>
 *   <template #footer>
 *     <Button @click="handleConfirm">Confirmer</Button>
 *   </template>
 * </Modal>
 */

/**
 * Props du composant Modal
 */
interface ModalProps {
  /**
   * Affichage de la modal
   * @required
   */
  show: boolean;

  /**
   * Titre de la modal
   * @optional
   */
  title?: string;

  /**
   * Largeur maximale de la modal
   * @default 'md'
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';

  /**
   * Fermeture en cliquant sur l'overlay
   * @default true
   */
  closeOnOverlayClick?: boolean;

  /**
   * Afficher le bouton de fermeture (X)
   * @default true
   */
  showCloseButton?: boolean;
}

/**
 * Événements émis
 */
interface ModalEmits {
  /**
   * Demande de fermeture de la modal
   * @event close
   */
  (e: 'close'): void;
}

/**
 * Slots disponibles
 */
interface ModalSlots {
  /**
   * Contenu principal de la modal
   * @slot default
   */
  default(): any;

  /**
   * Footer personnalisé (boutons d'action)
   * @slot footer
   * @optional
   */
  footer(): any;
}
```

---

## Utils API

### `shared/utils/formatters.ts`

```typescript
/**
 * Formate un nombre en devise EUR
 * @param {number} amount - Montant à formater
 * @param {string} [locale='fr-FR'] - Locale pour le formatage
 * @returns {string} Montant formaté (ex: "1 200,00 €")
 * @example
 * formatCurrency(1200); // "1 200,00 €"
 * formatCurrency(1200.5); // "1 200,50 €"
 */
export function formatCurrency(amount: number, locale: string = 'fr-FR'): string;

/**
 * Formate une date au format français
 * @param {Date | string} date - Date à formater
 * @param {string} [format='short'] - Format ('short' | 'long' | 'month')
 * @returns {string} Date formatée
 * @example
 * formatDate(new Date('2025-11-27')); // "27/11/2025"
 * formatDate('2025-11-27', 'long'); // "27 novembre 2025"
 * formatDate('2025-11-27', 'month'); // "novembre 2025"
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'month' = 'short'
): string;

/**
 * Formate un numéro de téléphone français
 * @param {string} phone - Numéro brut
 * @returns {string} Numéro formaté (ex: "06 12 34 56 78")
 * @example
 * formatPhone('0612345678'); // "06 12 34 56 78"
 */
export function formatPhone(phone: string): string;

/**
 * Calcule la différence en mois entre deux dates
 * @param {Date | string} startDate - Date de début
 * @param {Date | string} endDate - Date de fin
 * @returns {number} Nombre de mois
 * @example
 * monthsDifference('2025-01-01', '2025-12-31'); // 11
 */
export function monthsDifference(startDate: Date | string, endDate: Date | string): number;
```

### `shared/utils/validators.ts`

```typescript
/**
 * Valide une adresse email
 * @param {string} email - Email à valider
 * @returns {boolean} true si valide
 * @example
 * isValidEmail('test@example.com'); // true
 * isValidEmail('invalid'); // false
 */
export function isValidEmail(email: string): boolean;

/**
 * Valide un numéro de téléphone français
 * @param {string} phone - Téléphone à valider
 * @returns {boolean} true si valide (format français)
 * @example
 * isValidPhone('0612345678'); // true
 * isValidPhone('06 12 34 56 78'); // true
 * isValidPhone('123'); // false
 */
export function isValidPhone(phone: string): boolean;

/**
 * Valide qu'un montant est positif
 * @param {number} amount - Montant à valider
 * @returns {boolean} true si > 0
 */
export function isPositiveAmount(amount: number): boolean;

/**
 * Valide une date au format YYYY-MM-DD
 * @param {string} date - Date à valider
 * @returns {boolean} true si format valide
 * @example
 * isValidDate('2025-11-27'); // true
 * isValidDate('27/11/2025'); // false
 */
export function isValidDate(date: string): boolean;
```

---

## Types principaux

### Property

```typescript
/**
 * Représente une propriété immobilière
 * @interface Property
 */
interface Property {
  /** ID unique (auto-increment) */
  id?: number;

  /** Nom du bien */
  name: string;

  /** Adresse complète */
  address: string;

  /** Type de bien */
  type: 'apartment' | 'house' | 'commercial' | 'parking' | 'other';

  /** Surface en m² */
  surface: number;

  /** Nombre de pièces */
  rooms: number;

  /** Nombre de chambres */
  bedrooms?: number;

  /** Nombre de salles de bain */
  bathrooms?: number;

  /** Loyer mensuel en € */
  rent: number;

  /** Charges en € */
  charges?: number;

  /** Dépôt de garantie en € */
  deposit?: number;

  /** Statut de disponibilité */
  status: 'vacant' | 'occupied' | 'maintenance';

  /** Description */
  description?: string;

  /** Équipements (parking, balcon, etc.) */
  features?: string[];

  /** Date de création */
  createdAt: Date;

  /** Date de dernière mise à jour */
  updatedAt: Date;
}
```

### Tenant

```typescript
/**
 * Représente un locataire ou candidat
 * @interface Tenant
 */
interface Tenant {
  /** ID unique (auto-increment) */
  id?: number;

  /** Prénom */
  firstName: string;

  /** Nom de famille */
  lastName: string;

  /** Email */
  email: string;

  /** Téléphone */
  phone: string;

  /** Statut (candidat, actif, ancien) */
  status: 'candidate' | 'active' | 'former';

  /** Date de naissance */
  dateOfBirth?: string;

  /** Profession */
  occupation?: string;

  /** Revenus mensuels en € */
  income?: number;

  /** Notes libres */
  notes?: string;

  /** IDs des documents associés */
  documents?: number[];

  /** Date de création */
  createdAt: Date;

  /** Date de mise à jour */
  updatedAt: Date;
}
```

---

Cette documentation sera mise à jour à chaque ajout ou modification d'API.
