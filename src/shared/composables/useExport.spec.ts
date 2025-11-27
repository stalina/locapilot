import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExport } from './useExport';

describe('useExport', () => {
  beforeEach(() => {
    // Mock document methods
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock HTMLAnchorElement click
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  describe('exportToJSON', () => {
    it('should export data to JSON file', async () => {
      const { exportToJSON } = useExport();
      const testData = { name: 'Test', value: 123 };

      await exportToJSON(testData, { filename: 'test.json' });

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should use default filename if not provided', async () => {
      const { exportToJSON } = useExport();
      const testData = { test: true };

      await exportToJSON(testData);

      const appendCall = (document.body.appendChild as any).mock.calls[0][0];
      expect(appendCall.download).toMatch(/^export-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('should create pretty JSON by default', async () => {
      const { exportToJSON } = useExport();
      const testData = { name: 'Test', nested: { value: 123 } };

      let blobContent = '';
      global.Blob = vi.fn().mockImplementation(content => {
        blobContent = content[0];
        return {};
      }) as any;

      await exportToJSON(testData);

      expect(blobContent).toContain('\n');
      expect(blobContent).toContain('  ');
    });

    it('should create compact JSON when pretty is false', async () => {
      const { exportToJSON } = useExport();
      const testData = { name: 'Test' };

      let blobContent = '';
      global.Blob = vi.fn().mockImplementation(content => {
        blobContent = content[0];
        return {};
      }) as any;

      await exportToJSON(testData, { pretty: false });

      expect(blobContent).toBe('{"name":"Test"}');
    });

    it('should set isExporting during export', async () => {
      const { exportToJSON, isExporting } = useExport();
      const testData = { test: true };

      expect(isExporting.value).toBe(false);

      const promise = exportToJSON(testData);
      expect(isExporting.value).toBe(true);

      await promise;
      expect(isExporting.value).toBe(false);
    });
  });

  describe('exportToCSV', () => {
    it('should export array to CSV file', async () => {
      const { exportToCSV } = useExport();
      const testData = [
        { name: 'Alice', age: 30, city: 'Paris' },
        { name: 'Bob', age: 25, city: 'Lyon' },
      ];

      await exportToCSV(testData, 'test.csv');

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should create proper CSV format with headers', async () => {
      const { exportToCSV } = useExport();
      const testData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];

      let blobContent = '';
      global.Blob = vi.fn().mockImplementation(content => {
        blobContent = content[0];
        return {};
      }) as any;

      await exportToCSV(testData);

      const lines = blobContent.split('\n');
      expect(lines[0]).toContain('name,age');
      expect(lines[1]).toContain('Alice,30');
      expect(lines[2]).toContain('Bob,25');
    });

    it('should escape commas and quotes in CSV', async () => {
      const { exportToCSV } = useExport();
      const testData = [{ name: 'Smith, John', quote: 'He said "hello"' }];

      let blobContent = '';
      global.Blob = vi.fn().mockImplementation(content => {
        blobContent = content[0];
        return {};
      }) as any;

      await exportToCSV(testData);

      expect(blobContent).toContain('"Smith, John"');
      expect(blobContent).toContain('"He said ""hello"""');
    });

    it('should handle empty values', async () => {
      const { exportToCSV } = useExport();
      const testData = [{ name: 'Alice', email: null, phone: undefined }];

      let blobContent = '';
      global.Blob = vi.fn().mockImplementation(content => {
        blobContent = content[0];
        return {};
      }) as any;

      await exportToCSV(testData);

      const lines = blobContent.split('\n');
      expect(lines[1]).toBe('Alice,,');
    });

    it('should throw error for empty data', async () => {
      const { exportToCSV } = useExport();

      await expect(exportToCSV([])).rejects.toThrow('Aucune donnée à exporter');
    });

    it('should use default filename if not provided', async () => {
      const { exportToCSV } = useExport();
      const testData = [{ test: true }];

      await exportToCSV(testData);

      const appendCall = (document.body.appendChild as any).mock.calls[0][0];
      expect(appendCall.download).toMatch(/^export-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });
});
