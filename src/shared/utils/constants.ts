/**
 * Constantes de l'application
 */

/**
 * Statuts des propriétés
 */
export const PROPERTY_STATUS = {
  OCCUPIED: 'occupied',
  VACANT: 'vacant',
  MAINTENANCE: 'maintenance',
} as const;

export const PROPERTY_STATUS_LABELS = {
  [PROPERTY_STATUS.OCCUPIED]: 'Occupé',
  [PROPERTY_STATUS.VACANT]: 'Vacant',
  [PROPERTY_STATUS.MAINTENANCE]: 'En maintenance',
} as const;

/**
 * Types de propriétés
 */
export const PROPERTY_TYPES = {
  APARTMENT: 'apartment',
  HOUSE: 'house',
  STUDIO: 'studio',
  COMMERCIAL: 'commercial',
  PARKING: 'parking',
  OTHER: 'other',
} as const;

export const PROPERTY_TYPE_LABELS = {
  [PROPERTY_TYPES.APARTMENT]: 'Appartement',
  [PROPERTY_TYPES.HOUSE]: 'Maison',
  [PROPERTY_TYPES.STUDIO]: 'Studio',
  [PROPERTY_TYPES.COMMERCIAL]: 'Commercial',
  [PROPERTY_TYPES.PARKING]: 'Parking',
  [PROPERTY_TYPES.OTHER]: 'Autre',
} as const;

/**
 * Statuts des locataires
 */
export const TENANT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CANDIDATE: 'candidate',
  REFUSED: 'candidature-refusee',
} as const;

export const TENANT_STATUS_LABELS = {
  [TENANT_STATUS.ACTIVE]: 'Actif',
  [TENANT_STATUS.INACTIVE]: 'Inactif',
  [TENANT_STATUS.CANDIDATE]: 'Candidat',
  [TENANT_STATUS.REFUSED]: 'Candidature refusée',
} as const;

/**
 * Statuts des baux
 */
export const LEASE_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  ENDED: 'ended',
} as const;

export const LEASE_STATUS_LABELS = {
  [LEASE_STATUS.ACTIVE]: 'Actif',
  [LEASE_STATUS.PENDING]: 'En attente',
  [LEASE_STATUS.ENDED]: 'Terminé',
} as const;

/**
 * Statuts des loyers
 */
export const RENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  LATE: 'late',
  PARTIAL: 'partial',
} as const;

export const RENT_STATUS_LABELS = {
  [RENT_STATUS.PENDING]: 'En attente',
  [RENT_STATUS.PAID]: 'Payé',
  [RENT_STATUS.LATE]: 'En retard',
  [RENT_STATUS.PARTIAL]: 'Partiel',
} as const;

/**
 * Types de documents
 */
export const DOCUMENT_TYPES = {
  IDENTITY: 'identity',
  INCOME: 'income',
  CONTRACT: 'contract',
  INVENTORY: 'inventory',
  RECEIPT: 'receipt',
  OTHER: 'other',
} as const;

export const DOCUMENT_TYPE_LABELS = {
  [DOCUMENT_TYPES.IDENTITY]: "Pièce d'identité",
  [DOCUMENT_TYPES.INCOME]: 'Justificatif de revenus',
  [DOCUMENT_TYPES.CONTRACT]: 'Contrat',
  [DOCUMENT_TYPES.INVENTORY]: 'État des lieux',
  [DOCUMENT_TYPES.RECEIPT]: 'Quittance',
  [DOCUMENT_TYPES.OTHER]: 'Autre',
} as const;

/**
 * Types d'états des lieux
 */
export const INVENTORY_TYPES = {
  CHECKIN: 'checkin',
  CHECKOUT: 'checkout',
} as const;

export const INVENTORY_TYPE_LABELS = {
  [INVENTORY_TYPES.CHECKIN]: 'Entrée',
  [INVENTORY_TYPES.CHECKOUT]: 'Sortie',
} as const;

/**
 * Limites et seuils
 */
export const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGES_PER_INVENTORY: 50,
  MAX_ROOMS_PER_PROPERTY: 20,
  MIN_RENT_AMOUNT: 0,
  MAX_RENT_AMOUNT: 100000,
  MIN_DEPOSIT_AMOUNT: 0,
  MAX_DEPOSIT_AMOUNT: 100000,
  PAYMENT_DAY_MIN: 1,
  PAYMENT_DAY_MAX: 31,
} as const;

/**
 * Formats de date
 */
export const DATE_FORMATS = {
  SHORT: 'dd/MM/yyyy',
  LONG: 'd MMMM yyyy',
  WITH_TIME: 'dd/MM/yyyy HH:mm',
  ISO: 'yyyy-MM-dd',
} as const;

/**
 * Routes de l'application
 */
export const ROUTES = {
  DASHBOARD: '/',
  PROPERTIES: '/properties',
  PROPERTY_DETAIL: '/properties/:id',
  TENANTS: '/tenants',
  TENANT_DETAIL: '/tenants/:id',
  LEASES: '/leases',
  LEASE_DETAIL: '/leases/:id',
  RENTS: '/rents',
  DOCUMENTS: '/documents',
  INVENTORIES: '/inventories',
  SETTINGS: '/settings',
} as const;

/**
 * Clés de stockage local
 */
export const STORAGE_KEYS = {
  THEME: 'locapilot_theme',
  LOCALE: 'locapilot_locale',
  LAST_BACKUP: 'locapilot_last_backup',
} as const;

/**
 * Messages d'erreur
 */
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'Ce champ est obligatoire',
  INVALID_EMAIL: 'Email invalide',
  INVALID_PHONE: 'Numéro de téléphone invalide',
  INVALID_DATE: 'Date invalide',
  INVALID_NUMBER: 'Nombre invalide',
  MIN_VALUE: (min: number) => `La valeur doit être supérieure ou égale à ${min}`,
  MAX_VALUE: (max: number) => `La valeur doit être inférieure ou égale à ${max}`,
  FILE_TOO_LARGE: (maxSize: number) =>
    `Le fichier est trop volumineux (max ${maxSize / 1024 / 1024} MB)`,
  OPERATION_FAILED: 'Opération échouée. Veuillez réessayer.',
} as const;

/**
 * Messages de succès
 */
export const SUCCESS_MESSAGES = {
  CREATED: (entity: string) => `${entity} créé(e) avec succès`,
  UPDATED: (entity: string) => `${entity} modifié(e) avec succès`,
  DELETED: (entity: string) => `${entity} supprimé(e) avec succès`,
  SAVED: 'Enregistré avec succès',
  EXPORTED: 'Export réussi',
  IMPORTED: 'Import réussi',
} as const;

/**
 * Temps d'attente et délais
 */
export const DELAYS = {
  DEBOUNCE_SEARCH: 300, // ms
  TOAST_DURATION: 3000, // ms
  LOADING_MIN: 500, // ms
  AUTO_SAVE: 2000, // ms
} as const;
