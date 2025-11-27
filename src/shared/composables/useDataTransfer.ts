/**
 * Composable pour import/export de données avec validation Zod
 */

import { z } from 'zod';
import { useImport, type ImportOptions, type ImportResult } from './useImport';
import { useExport } from './useExport';
import {
  PropertySchema,
  TenantSchema,
  LeaseSchema,
  RentSchema,
  ExportDataSchema,
  type ExportDataValidation,
} from '@shared/utils/validation-schemas';

export function useDataTransfer() {
  const { importFromJSON } = useImport();
  const { exportToJSON } = useExport();

  /**
   * Exporte toutes les données au format JSON validé
   */
  const exportAllData = async (data: {
    properties?: any[];
    tenants?: any[];
    leases?: any[];
    rents?: any[];
    documents?: any[];
    settings?: any[];
  }) => {
    const exportData: ExportDataValidation = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {
        properties: data.properties || [],
        tenants: data.tenants || [],
        leases: data.leases || [],
        rents: data.rents || [],
        documents: data.documents || [],
        settings: data.settings || [],
      },
    };

    // Valider les données avant export
    try {
      ExportDataSchema.parse(exportData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Erreurs de validation export:', (error as z.ZodError).issues);
        throw new Error("Données invalides pour l'export");
      }
      throw error;
    }

    const fileName = `locapilot-export-${new Date().toISOString().split('T')[0]}.json`;
    return exportToJSON(exportData, { filename: fileName });
  };

  /**
   * Importe toutes les données depuis un JSON validé
   */
  const importAllData = async (file: File): Promise<ImportResult<ExportDataValidation>> => {
    const options: ImportOptions = {
      validate: async (data: any) => {
        try {
          ExportDataSchema.parse(data);
          return true;
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.error('Erreurs de validation import:', (error as z.ZodError).issues);
          }
          return false;
        }
      },
    };

    return importFromJSON<ExportDataValidation>(file, options);
  };

  /**
   * Valide un tableau de propriétés
   */
  const validateProperties = (properties: any[]): { valid: boolean; errors?: z.ZodError } => {
    try {
      z.array(PropertySchema).parse(properties);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      return { valid: false };
    }
  };

  /**
   * Valide un tableau de locataires
   */
  const validateTenants = (tenants: any[]): { valid: boolean; errors?: z.ZodError } => {
    try {
      z.array(TenantSchema).parse(tenants);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      return { valid: false };
    }
  };

  /**
   * Valide un tableau de baux
   */
  const validateLeases = (leases: any[]): { valid: boolean; errors?: z.ZodError } => {
    try {
      z.array(LeaseSchema).parse(leases);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      return { valid: false };
    }
  };

  /**
   * Valide un tableau de loyers
   */
  const validateRents = (rents: any[]): { valid: boolean; errors?: z.ZodError } => {
    try {
      z.array(RentSchema).parse(rents);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      return { valid: false };
    }
  };

  /**
   * Importe des propriétés avec validation
   */
  const importProperties = async (file: File) => {
    return importFromJSON(file, {
      validate: async (data: any) => {
        const result = validateProperties(Array.isArray(data) ? data : [data]);
        return result.valid;
      },
    });
  };

  /**
   * Importe des locataires avec validation
   */
  const importTenants = async (file: File) => {
    return importFromJSON(file, {
      validate: async (data: any) => {
        const result = validateTenants(Array.isArray(data) ? data : [data]);
        return result.valid;
      },
    });
  };

  /**
   * Importe des baux avec validation
   */
  const importLeases = async (file: File) => {
    return importFromJSON(file, {
      validate: async (data: any) => {
        const result = validateLeases(Array.isArray(data) ? data : [data]);
        return result.valid;
      },
    });
  };

  /**
   * Importe des loyers avec validation
   */
  const importRents = async (file: File) => {
    return importFromJSON(file, {
      validate: async (data: any) => {
        const result = validateRents(Array.isArray(data) ? data : [data]);
        return result.valid;
      },
    });
  };

  return {
    // Export
    exportAllData,

    // Import
    importAllData,
    importProperties,
    importTenants,
    importLeases,
    importRents,

    // Validation
    validateProperties,
    validateTenants,
    validateLeases,
    validateRents,
  };
}
