import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateFile,
  formatFileSize,
  getFileExtension,
  generateUniqueFilename,
  isValidFileType,
  isValidFileSize,
  isImageFile,
  isPDFFile,
  isTextFile,
  FileValidationError,
  readFileAsText,
  readFileAsDataURL,
  downloadFile,
  dataURLtoFile,
  createImageThumbnail,
  VALID_EXTENSIONS,
  FILE_SIZE_LIMITS,
} from '../fileUtils';

describe('fileUtils', () => {
  describe('FileValidationError', () => {
    it('should create error with correct properties', () => {
      const error = new FileValidationError('Test error', 'INVALID_TYPE');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FileValidationError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('INVALID_TYPE');
    });
  });

  describe('isValidFileType', () => {
    it('should return true for supported image types', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(isValidFileType(file)).toBe(true);
    });

    it('should return true for PDF', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(isValidFileType(file)).toBe(true);
    });

    it('should return false for unsupported types', () => {
      const file = new File([''], 'test.exe', { type: 'application/x-msdownload' });
      expect(isValidFileType(file)).toBe(false);
    });
  });

  describe('isValidFileSize', () => {
    it('should return true for valid image size', () => {
      const content = 'a'.repeat(1024 * 1024); // 1MB
      const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
      expect(isValidFileSize(file)).toBe(true);
    });

    it('should return false for oversized image', () => {
      const content = 'a'.repeat(6 * 1024 * 1024); // 6MB
      const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
      expect(isValidFileSize(file)).toBe(false);
    });

    it('should return false for unsupported type', () => {
      const file = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
      expect(isValidFileSize(file)).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('should throw for empty file', () => {
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      expect(() => validateFile(file)).toThrow(FileValidationError);
      expect(() => validateFile(file)).toThrow('Le fichier est vide');
    });

    it('should throw for unsupported type', () => {
      const file = new File(['content'], 'test.exe', {
        type: 'application/x-msdownload',
      });
      expect(() => validateFile(file)).toThrow(FileValidationError);
      expect(() => validateFile(file)).toThrow('Type de fichier non supporté');
    });

    it('should throw for oversized file', () => {
      const content = 'a'.repeat(11 * 1024 * 1024); // 11MB (PDF limit is 10MB)
      const file = new File([content], 'test.pdf', { type: 'application/pdf' });
      expect(() => validateFile(file)).toThrow(FileValidationError);
      expect(() => validateFile(file)).toThrow('dépasse la taille maximale');
    });

    it('should throw for invalid filename', () => {
      const file = new File(['content'], '', { type: 'image/jpeg' });
      Object.defineProperty(file, 'name', { value: '' });
      expect(() => validateFile(file)).toThrow(FileValidationError);
    });

    it('should not throw for valid file', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      expect(() => validateFile(file)).not.toThrow();
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension with dot', () => {
      expect(getFileExtension('document.pdf')).toBe('.pdf');
      expect(getFileExtension('image.jpg')).toBe('.jpg');
    });

    it('should handle multiple dots', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('.gz');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('README')).toBe('');
    });

    it('should convert to lowercase', () => {
      expect(getFileExtension('Image.JPG')).toBe('.jpg');
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate unique filename with timestamp', () => {
      const filename = generateUniqueFilename('document.pdf');
      expect(filename).toMatch(/^document_\d+_[a-z0-9]{6}\.pdf$/);
    });

    it('should preserve extension', () => {
      const filename = generateUniqueFilename('image.jpg');
      expect(filename).toContain('.jpg');
    });

    it('should generate different names for same input', () => {
      const name1 = generateUniqueFilename('test.txt');
      const name2 = generateUniqueFilename('test.txt');
      expect(name1).not.toBe(name2);
    });
  });

  describe('readFileAsText', () => {
    it('should read text file', async () => {
      const content = 'Hello, world!';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const result = await readFileAsText(file);
      expect(result).toBe(content);
    });

    it('should handle UTF-8 content', async () => {
      const content = 'Héllo wörld! 你好';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const result = await readFileAsText(file);
      expect(result).toBe(content);
    });
  });

  describe('readFileAsDataURL', () => {
    it('should read file as data URL', async () => {
      const content = 'test content';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:text\/plain;base64,/);
    });

    it('should handle binary content', async () => {
      const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      const file = new File([buffer], 'test.jpg', { type: 'image/jpeg' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe('downloadFile', () => {
    beforeEach(() => {
      // Mock DOM methods
      document.createElement = vi.fn().mockReturnValue({
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      });
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
    });

    it('should create and trigger download link', () => {
      const dataUrl = 'data:text/plain;base64,SGVsbG8=';
      const filename = 'test.txt';
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };

      document.createElement = vi.fn().mockReturnValue(mockLink);

      downloadFile(dataUrl, filename);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe(dataUrl);
      expect(mockLink.download).toBe(filename);
      expect(mockLink.style.display).toBe('none');
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });
  });

  describe('dataURLtoFile', () => {
    it('should convert data URL to File', () => {
      const dataUrl = 'data:text/plain;base64,SGVsbG8=';
      const filename = 'test.txt';
      const file = dataURLtoFile(dataUrl, filename);

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe(filename);
      expect(file.type).toBe('text/plain');
    });

    it('should handle image data URL', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQ';
      const filename = 'image.jpg';
      const file = dataURLtoFile(dataUrl, filename);

      expect(file.type).toBe('image/jpeg');
      expect(file.name).toBe(filename);
    });

    it('should throw for invalid data URL', () => {
      const invalidUrl = 'not-a-data-url';
      expect(() => dataURLtoFile(invalidUrl, 'test.txt')).toThrow(FileValidationError);
    });
  });

  describe('isImageFile', () => {
    it('should return true for image types', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(isImageFile(file)).toBe(true);
    });

    it('should return false for non-image types', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(isImageFile(file)).toBe(false);
    });
  });

  describe('isPDFFile', () => {
    it('should return true for PDF', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(isPDFFile(file)).toBe(true);
    });

    it('should return false for non-PDF', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(isPDFFile(file)).toBe(false);
    });
  });

  describe('isTextFile', () => {
    it('should return true for text files', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      expect(isTextFile(file)).toBe(true);
    });

    it('should return true for CSV', () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      expect(isTextFile(file)).toBe(true);
    });

    it('should return true for JSON', () => {
      const file = new File([''], 'test.json', { type: 'application/json' });
      expect(isTextFile(file)).toBe(true);
    });

    it('should return false for binary files', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(isTextFile(file)).toBe(false);
    });
  });

  describe('createImageThumbnail', () => {
    it('should throw for non-image files', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      await expect(createImageThumbnail(file)).rejects.toThrow(FileValidationError);
    });

    // Note: Full image thumbnail tests would require mocking canvas/image APIs
    // which is complex in JSDOM environment. The function is tested via E2E.
  });

  describe('constants', () => {
    it('should export valid extensions', () => {
      expect(VALID_EXTENSIONS).toContain('.jpg');
      expect(VALID_EXTENSIONS).toContain('.pdf');
      expect(VALID_EXTENSIONS).toContain('.txt');
    });

    it('should export file size limits', () => {
      expect(FILE_SIZE_LIMITS['image/jpeg']).toBe(5 * 1024 * 1024);
      expect(FILE_SIZE_LIMITS['application/pdf']).toBe(10 * 1024 * 1024);
    });
  });
});
