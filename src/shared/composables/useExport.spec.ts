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
    (globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    (globalThis as any).URL.revokeObjectURL = vi.fn();

    // Mock HTMLAnchorElement click
    HTMLAnchorElement.prototype.click = vi.fn();

    // Mock Blob constructor
    (globalThis as any).Blob = class MockBlob {
      content: any[];
      options?: { type?: string };

      constructor(content: any[], options?: { type?: string }) {
        this.content = content;
        this.options = options;
      }
    };
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

  describe('exportCSVContent', () => {
    it('downloads the given content as is, with a UTF-8 BOM and the given filename', async () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL');
      const { exportCSVContent, isExporting } = useExport();
      let downloaded = '';
      vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        downloaded = this.download;
      });

      await exportCSVContent('Ligne;Total\r\n211;9600', 'recapitulatif-fiscal-2025.csv');

      expect(downloaded).toBe('recapitulatif-fiscal-2025.csv');
      const blob = createObjectURL.mock.calls[0]?.[0] as unknown as {
        content: string[];
        options?: { type?: string };
      };
      expect(blob.content).toEqual(['﻿Ligne;Total\r\n211;9600']);
      expect(blob.options?.type).toBe('text/csv;charset=utf-8;');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      expect(isExporting.value).toBe(false);
    });

    it('rethrows a download failure and resets the exporting flag', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
        throw new Error('quota');
      });
      const { exportCSVContent, isExporting } = useExport();

      await expect(exportCSVContent('a;b', 'x.csv')).rejects.toThrow('quota');
      expect(isExporting.value).toBe(false);
    });
  });
});
