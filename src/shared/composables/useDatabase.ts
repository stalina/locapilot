/**
 * Composable pour accès centralisé à la base de données
 * Fournit des méthodes helpers et gestion d'erreurs
 */

import { ref } from 'vue';
import { db } from '@db/database';
import type { Property, Tenant, Lease, Rent, Document, Settings } from '@db/types';
import { useNotification } from './useNotification';

export function useDatabase() {
  const { error: showError } = useNotification();
  const isProcessing = ref(false);

  /**
   * Execute une opération de base de données avec gestion d'erreurs
   */
  const execute = async <T>(
    operation: () => Promise<T>,
    errorMessage = 'Erreur de base de données'
  ): Promise<T | null> => {
    isProcessing.value = true;
    try {
      return await operation();
    } catch (error) {
      console.error('Database error:', error);
      showError(errorMessage);
      return null;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Propriétés
   */
  const properties = {
    getAll: () =>
      execute(() => db.properties.toArray(), 'Erreur lors du chargement des propriétés'),

    getById: (id: number) =>
      execute(() => db.properties.get(id), 'Erreur lors du chargement de la propriété'),

    getByStatus: (status: Property['status']) =>
      execute(
        () => db.properties.where('status').equals(status).toArray(),
        'Erreur lors du chargement des propriétés'
      ),

    create: (property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) =>
      execute(
        () =>
          db.properties.add({
            ...property,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Property),
        'Erreur lors de la création de la propriété'
      ),

    update: (id: number, updates: Partial<Property>) =>
      execute(
        () => db.properties.update(id, { ...updates, updatedAt: new Date() }),
        'Erreur lors de la mise à jour de la propriété'
      ),

    delete: (id: number) =>
      execute(() => db.properties.delete(id), 'Erreur lors de la suppression de la propriété'),
  };

  /**
   * Locataires
   */
  const tenants = {
    getAll: () => execute(() => db.tenants.toArray(), 'Erreur lors du chargement des locataires'),

    getById: (id: number) =>
      execute(() => db.tenants.get(id), 'Erreur lors du chargement du locataire'),

    getByStatus: (status: Tenant['status']) =>
      execute(
        () => db.tenants.where('status').equals(status).toArray(),
        'Erreur lors du chargement des locataires'
      ),

    create: (tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) =>
      execute(
        () =>
          db.tenants.add({
            ...tenant,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Tenant),
        'Erreur lors de la création du locataire'
      ),

    update: (id: number, updates: Partial<Tenant>) =>
      execute(
        () => db.tenants.update(id, { ...updates, updatedAt: new Date() }),
        'Erreur lors de la mise à jour du locataire'
      ),

    delete: (id: number) =>
      execute(() => db.tenants.delete(id), 'Erreur lors de la suppression du locataire'),
  };

  /**
   * Baux
   */
  const leases = {
    getAll: () => execute(() => db.leases.toArray(), 'Erreur lors du chargement des baux'),

    getById: (id: number) => execute(() => db.leases.get(id), 'Erreur lors du chargement du bail'),

    getByProperty: (propertyId: number) =>
      execute(
        () => db.leases.where('propertyId').equals(propertyId).toArray(),
        'Erreur lors du chargement des baux'
      ),

    getByStatus: (status: Lease['status']) =>
      execute(
        () => db.leases.where('status').equals(status).toArray(),
        'Erreur lors du chargement des baux'
      ),

    create: (lease: Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>) =>
      execute(
        () =>
          db.leases.add({
            ...lease,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Lease),
        'Erreur lors de la création du bail'
      ),

    update: (id: number, updates: Partial<Lease>) =>
      execute(
        () => db.leases.update(id, { ...updates, updatedAt: new Date() }),
        'Erreur lors de la mise à jour du bail'
      ),

    delete: (id: number) =>
      execute(() => db.leases.delete(id), 'Erreur lors de la suppression du bail'),
  };

  /**
   * Loyers
   */
  const rents = {
    getAll: () => execute(() => db.rents.toArray(), 'Erreur lors du chargement des loyers'),

    getById: (id: number) => execute(() => db.rents.get(id), 'Erreur lors du chargement du loyer'),

    getByLease: (leaseId: number) =>
      execute(
        () => db.rents.where('leaseId').equals(leaseId).toArray(),
        'Erreur lors du chargement des loyers'
      ),

    getByStatus: (status: Rent['status']) =>
      execute(
        () => db.rents.where('status').equals(status).toArray(),
        'Erreur lors du chargement des loyers'
      ),

    create: (rent: Omit<Rent, 'id' | 'createdAt' | 'updatedAt'>) =>
      execute(
        () =>
          db.rents.add({
            ...rent,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Rent),
        'Erreur lors de la création du loyer'
      ),

    update: (id: number, updates: Partial<Rent>) =>
      execute(
        () => db.rents.update(id, { ...updates, updatedAt: new Date() }),
        'Erreur lors de la mise à jour du loyer'
      ),

    delete: (id: number) =>
      execute(() => db.rents.delete(id), 'Erreur lors de la suppression du loyer'),
  };

  /**
   * Documents
   */
  const documents = {
    getAll: () => execute(() => db.documents.toArray(), 'Erreur lors du chargement des documents'),

    getById: (id: number) =>
      execute(() => db.documents.get(id), 'Erreur lors du chargement du document'),

    getByType: (type: Document['type']) =>
      execute(
        () => db.documents.where('type').equals(type).toArray(),
        'Erreur lors du chargement des documents'
      ),

    getByRelatedId: (relatedId: number) =>
      execute(
        () => db.documents.where('relatedId').equals(relatedId).toArray(),
        'Erreur lors du chargement des documents'
      ),

    create: (document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) =>
      execute(
        () =>
          db.documents.add({
            ...document,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Document),
        'Erreur lors de la création du document'
      ),

    update: (id: number, updates: Partial<Document>) =>
      execute(
        () => db.documents.update(id, { ...updates, updatedAt: new Date() }),
        'Erreur lors de la mise à jour du document'
      ),

    delete: (id: number) =>
      execute(() => db.documents.delete(id), 'Erreur lors de la suppression du document'),
  };

  /**
   * Paramètres
   */
  const settings = {
    getAll: () => execute(() => db.settings.toArray(), 'Erreur lors du chargement des paramètres'),

    get: (key: string) =>
      execute(() => db.settings.get({ key }), 'Erreur lors du chargement du paramètre'),

    set: async (key: string, value: any) => {
      const existing = await settings.get(key);
      if (existing) {
        return execute(
          () => db.settings.update(existing.id!, { value, updatedAt: new Date() }),
          'Erreur lors de la mise à jour du paramètre'
        );
      } else {
        return execute(
          () => db.settings.add({ key, value, updatedAt: new Date() } as Settings),
          'Erreur lors de la création du paramètre'
        );
      }
    },

    delete: (key: string) =>
      execute(async () => {
        const setting = await db.settings.get({ key });
        if (setting?.id) {
          await db.settings.delete(setting.id);
        }
      }, 'Erreur lors de la suppression du paramètre'),
  };

  /**
   * Utilitaires
   */
  const clearAll = () =>
    execute(async () => {
      await db.properties.clear();
      await db.tenants.clear();
      await db.leases.clear();
      await db.rents.clear();
      await db.documents.clear();
      await db.settings.clear();
    }, 'Erreur lors de la suppression des données');

  const getStats = () =>
    execute(async () => {
      const [propertiesCount, tenantsCount, leasesCount, rentsCount, documentsCount] =
        await Promise.all([
          db.properties.count(),
          db.tenants.count(),
          db.leases.count(),
          db.rents.count(),
          db.documents.count(),
        ]);

      return {
        properties: propertiesCount,
        tenants: tenantsCount,
        leases: leasesCount,
        rents: rentsCount,
        documents: documentsCount,
      };
    }, 'Erreur lors du calcul des statistiques');

  return {
    isProcessing,
    properties,
    tenants,
    leases,
    rents,
    documents,
    settings,
    clearAll,
    getStats,
  };
}
