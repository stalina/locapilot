import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExport } from './useExport';

// Mock useNotification
vi.mock('./useNotification', () => ({
  useNotification: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
  })),
}));

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

    // Mock Blob constructor
    global.Blob = class MockBlob {
      constructor(
        public content: any[],
        public options?: { type?: string }
      ) {}
    } as any;
  });

  describe('exportToJSON', () => {
    it('should export data to JSON file', async () => {
      const { exportToJSON } = useExport();
      const testData = { name: 'Test', value: 123 };

      await exportToJSON(testData, { filename: 'test.json' });

      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });

    it('should use default filename if not provided', async () => {
      const { exportToJSON } = useExport();
      const testData = { name: 'Test' };

      await exportToJSON(testData);

      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
  });

  describe('exportToCSV', () => {
    it('should export array to CSV file', async () => {
      const { exportToCSV } = useExport();
      const testData = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];

      await exportToCSV(testData, 'test.csv');

      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });

    it('should throw error for empty data', async () => {
      const { exportToCSV } = useExport();

      await expect(exportToCSV([])).rejects.toThrow('Aucune donnée à exporter');
    });

    it('should use default filename if not provided', async () => {
      const { exportToCSV } = useExport();
      const testData = [{ name: 'Test' }];

      await exportToCSV(testData);

      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
  });
});
