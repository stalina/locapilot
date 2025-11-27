import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImport } from './useImport';

// Mock useNotification
vi.mock('./useNotification', () => ({
  useNotification: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('useImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importFromJSON', () => {
    it('should import valid JSON file', async () => {
      const { importFromJSON } = useImport();
      const jsonContent = JSON.stringify({ name: 'Test', value: 123 });
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      const result = await importFromJSON(file);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Test', value: 123 });
    });

    it('should reject non-JSON files', async () => {
      const { importFromJSON } = useImport();
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      const result = await importFromJSON(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Le fichier doit être au format JSON');
    });

    it('should handle invalid JSON', async () => {
      const { importFromJSON } = useImport();
      const file = new File(['{invalid json}'], 'test.json', { type: 'application/json' });

      const result = await importFromJSON(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Format JSON invalide');
    });

    it('should validate data when validator provided', async () => {
      const { importFromJSON } = useImport();
      const jsonContent = JSON.stringify({ name: 'Test' });
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });
      const validator = (data: any) => !!data.age;

      const result = await importFromJSON(file, { validate: validator });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Les données ne sont pas valides');
    });

    it('should transform data when transformer provided', async () => {
      const { importFromJSON } = useImport();
      const jsonContent = JSON.stringify({ name: 'test' });
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });
      const transformer = (data: any) => ({ ...data, name: data.name.toUpperCase() });

      const result = await importFromJSON(file, { transform: transformer });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'TEST' });
    });
  });

  describe('importFromCSV', () => {
    it('should import valid CSV file', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name,age\nJohn,30\nJane,25';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ]);
    });

    it('should reject non-CSV files', async () => {
      const { importFromCSV } = useImport();
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Le fichier doit être au format CSV');
    });

    it('should handle empty CSV file', async () => {
      const { importFromCSV } = useImport();
      const file = new File([''], 'test.csv', { type: 'text/csv' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Le fichier CSV est vide');
    });

    it('should handle CSV with quoted values', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name,description\n"Doe, John","He said ""hello"""';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ name: 'Doe, John', description: 'He said "hello"' }]);
    });

    it('should validate CSV data when validator provided', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name\nJohn';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const validator = (data: any) => data.every((row: any) => !!row.age);

      const result = await importFromCSV(file, { validate: validator });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Les données ne sont pas valides');
    });

    it('should transform CSV data when transformer provided', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name\njohn';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const transformer = (data: any) =>
        data.map((row: any) => ({ ...row, name: row.name.toUpperCase() }));

      const result = await importFromCSV(file, { transform: transformer });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ name: 'JOHN' }]);
    });
  });
});
