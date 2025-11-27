import { ref } from 'vue';
import { useNotification } from './useNotification';

export interface ExportOptions {
  filename?: string;
  pretty?: boolean;
}

export function useExport() {
  const { success: showSuccess, error: showError } = useNotification();
  const isExporting = ref(false);

  /**
   * Export data to JSON file
   */
  const exportToJSON = async <T = any>(data: T, options: ExportOptions = {}): Promise<void> => {
    isExporting.value = true;

    try {
      const { filename = `export-${new Date().toISOString().split('T')[0]}.json`, pretty = true } =
        options;

      // Convert data to JSON string
      const jsonString = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

      // Create blob
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess(`Fichier ${filename} téléchargé avec succès`);
    } catch (error) {
      console.error('Export error:', error);
      showError(error instanceof Error ? error.message : "Erreur lors de l'export");
      throw error;
    } finally {
      isExporting.value = false;
    }
  };

  /**
   * Export data to CSV file
   */
  const exportToCSV = async (
    data: Record<string, any>[],
    filename: string = `export-${new Date().toISOString().split('T')[0]}.csv`
  ): Promise<void> => {
    isExporting.value = true;

    try {
      if (data.length === 0) {
        throw new Error('Aucune donnée à exporter');
      }

      // Get headers from first object
      const headers = Object.keys(data[0]!);

      // Create CSV content
      const csvRows: string[] = [];

      // Add header row
      csvRows.push(headers.join(','));

      // Add data rows
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];

          // Handle special cases
          if (value === null || value === undefined) {
            return '';
          }

          // Escape commas and quotes
          const stringValue = String(value);
          if (
            stringValue.includes(',') ||
            stringValue.includes('"') ||
            stringValue.includes('\n')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }

          return stringValue;
        });
        csvRows.push(values.join(','));
      }

      const csvString = csvRows.join('\n');

      // Create blob with BOM for Excel compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess(`Fichier ${filename} téléchargé avec succès`);
    } catch (error) {
      console.error('CSV export error:', error);
      showError(error instanceof Error ? error.message : "Erreur lors de l'export CSV");
      throw error;
    } finally {
      isExporting.value = false;
    }
  };

  return {
    isExporting,
    exportToJSON,
    exportToCSV,
  };
}
