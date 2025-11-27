import { ref } from 'vue';
import { useNotification } from './useNotification';

export interface ImportOptions {
  validate?: (data: any) => boolean | Promise<boolean>;
  transform?: (data: any) => any | Promise<any>;
}

export interface ImportResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export function useImport() {
  const { success: showSuccess, error: showError } = useNotification();
  const isImporting = ref(false);

  /**
   * Import data from JSON file
   */
  const importFromJSON = async <T = any>(
    file: File,
    options: ImportOptions = {}
  ): Promise<ImportResult<T>> => {
    isImporting.value = true;

    try {
      // Validate file type
      if (!file.name.endsWith('.json')) {
        throw new Error('Le fichier doit être au format JSON');
      }

      // Read file content
      const content = await readFileAsText(file);

      // Parse JSON
      let data: T;
      try {
        data = JSON.parse(content);
      } catch {
        throw new Error('Format JSON invalide');
      }

      // Validate data if validator provided
      if (options.validate) {
        const isValid = await options.validate(data);
        if (!isValid) {
          throw new Error('Les données ne sont pas valides');
        }
      }

      // Transform data if transformer provided
      if (options.transform) {
        data = await options.transform(data);
      }

      showSuccess(`Fichier ${file.name} importé avec succès`);
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue lors de l'import";

      console.error('Import error:', error);
      showError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      isImporting.value = false;
    }
  };

  /**
   * Import data from CSV file
   */
  const importFromCSV = async (
    file: File,
    options: ImportOptions = {}
  ): Promise<ImportResult<Record<string, string>[]>> => {
    isImporting.value = true;

    try {
      // Validate file type
      if (!file.name.endsWith('.csv')) {
        throw new Error('Le fichier doit être au format CSV');
      }

      // Read file content
      const content = await readFileAsText(file);

      // Parse CSV
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        throw new Error('Le fichier CSV est vide');
      }

      // Extract headers
      const headers = parseCSVLine(lines[0]);

      // Parse data rows
      const data: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          data.push(row);
        }
      }

      // Validate data if validator provided
      if (options.validate) {
        const isValid = await options.validate(data);
        if (!isValid) {
          throw new Error('Les données ne sont pas valides');
        }
      }

      // Transform data if transformer provided
      let transformedData: any = data;
      if (options.transform) {
        transformedData = await options.transform(data);
      }

      showSuccess(`Fichier ${file.name} importé avec succès (${data.length} lignes)`);

      return {
        success: true,
        data: transformedData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue lors de l'import CSV";

      console.error('CSV import error:', error);
      showError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      isImporting.value = false;
    }
  };

  /**
   * Open file picker and import JSON
   */
  const pickAndImportJSON = async <T = any>(
    options: ImportOptions = {}
  ): Promise<ImportResult<T>> => {
    const file = await pickFile('.json');
    if (!file) {
      return {
        success: false,
        error: 'Aucun fichier sélectionné',
      };
    }
    return importFromJSON<T>(file, options);
  };

  /**
   * Open file picker and import CSV
   */
  const pickAndImportCSV = async (
    options: ImportOptions = {}
  ): Promise<ImportResult<Record<string, string>[]>> => {
    const file = await pickFile('.csv');
    if (!file) {
      return {
        success: false,
        error: 'Aucun fichier sélectionné',
      };
    }
    return importFromCSV(file, options);
  };

  return {
    isImporting,
    importFromJSON,
    importFromCSV,
    pickAndImportJSON,
    pickAndImportCSV,
  };
}

// Helper functions

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Erreur de lecture du fichier'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentValue += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of value
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Add last value
  values.push(currentValue.trim());

  return values;
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = e => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      resolve(file || null);
    };

    input.oncancel = () => resolve(null);

    input.click();
  });
}
