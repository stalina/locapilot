import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImport } from './useImport';

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
      expect(result.error).toContain('JSON');
    });

    it('should handle invalid JSON', async () => {
      const { importFromJSON } = useImport();
      const file = new File(['{ invalid json'], 'test.json', { type: 'application/json' });

      const result = await importFromJSON(file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalide');
    });

    it('should validate data when validator provided', async () => {
      const { importFromJSON } = useImport();
      const jsonContent = JSON.stringify({ value: 'test' });
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      const validator = vi.fn().mockResolvedValue(false);
      const result = await importFromJSON(file, { validate: validator });

      expect(validator).toHaveBeenCalledWith({ value: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('valides');
    });

    it('should transform data when transformer provided', async () => {
      const { importFromJSON } = useImport();
      const jsonContent = JSON.stringify({ value: 10 });
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      const transformer = vi.fn().mockResolvedValue({ value: 20 });
      const result = await importFromJSON(file, { transform: transformer });

      expect(transformer).toHaveBeenCalledWith({ value: 10 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 20 });
    });

    it('should set isImporting during import', async () => {
      const { importFromJSON, isImporting } = useImport();
      const jsonContent = JSON.stringify({ test: true });
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      expect(isImporting.value).toBe(false);

      const promise = importFromJSON(file);
      expect(isImporting.value).toBe(true);

      await promise;
      expect(isImporting.value).toBe(false);
    });
  });

  describe('importFromCSV', () => {
    it('should import valid CSV file', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name,age\nAlice,30\nBob,25';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toEqual({ name: 'Alice', age: '30' });
      expect(result.data?.[1]).toEqual({ name: 'Bob', age: '25' });
    });

    it('should reject non-CSV files', async () => {
      const { importFromCSV } = useImport();
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSV');
    });

    it('should handle empty CSV file', async () => {
      const { importFromCSV } = useImport();
      const file = new File([''], 'test.csv', { type: 'text/csv' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('vide');
    });

    it('should parse quoted values correctly', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name,description\n"Smith, John","He said ""hello"""';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const result = await importFromCSV(file);

      expect(result.success).toBe(true);
      expect(result.data?.[0]).toEqual({
        name: 'Smith, John',
        description: 'He said "hello"',
      });
    });

    it('should validate CSV data when validator provided', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name,age\nAlice,30';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const validator = vi.fn().mockResolvedValue(false);
      const result = await importFromCSV(file, { validate: validator });

      expect(validator).toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should transform CSV data when transformer provided', async () => {
      const { importFromCSV } = useImport();
      const csvContent = 'name,age\nAlice,30';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const transformer = vi
        .fn()
        .mockImplementation(data => data.map((row: any) => ({ ...row, age: parseInt(row.age) })));
      const result = await importFromCSV(file, { transform: transformer });

      expect(transformer).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data?.[0].age).toBe(30);
    });
  });
});
