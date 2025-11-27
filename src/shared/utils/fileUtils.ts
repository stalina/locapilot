/**
 * Utilitaires de gestion de fichiers
 * Fonctions pour validation, conversion et manipulation de fichiers
 */

/**
 * Types de fichiers supportés pour upload
 */
export type SupportedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'application/pdf'
  | 'text/plain'
  | 'text/csv'
  | 'application/json'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Extensions de fichiers valides
 */
export const VALID_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.txt',
  '.csv',
  '.json',
  '.docx',
  '.xlsx',
] as const;

/**
 * Configuration des limites de taille par type MIME
 */
export const FILE_SIZE_LIMITS: Record<SupportedMimeType, number> = {
  'image/jpeg': 5 * 1024 * 1024, // 5MB
  'image/png': 5 * 1024 * 1024, // 5MB
  'image/gif': 5 * 1024 * 1024, // 5MB
  'image/webp': 5 * 1024 * 1024, // 5MB
  'application/pdf': 10 * 1024 * 1024, // 10MB
  'text/plain': 1 * 1024 * 1024, // 1MB
  'text/csv': 2 * 1024 * 1024, // 2MB
  'application/json': 2 * 1024 * 1024, // 2MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10 * 1024 * 1024, // 10MB
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 10 * 1024 * 1024, // 10MB
};

/**
 * Erreurs de validation de fichier
 */
export class FileValidationError extends Error {
  public code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_NAME' | 'READ_ERROR' | 'EMPTY_FILE';

  constructor(
    message: string,
    code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_NAME' | 'READ_ERROR' | 'EMPTY_FILE'
  ) {
    super(message);
    this.name = 'FileValidationError';
    this.code = code;
  }
}

/**
 * Valide qu'un fichier est d'un type supporté
 */
export function isValidFileType(file: File): boolean {
  return (Object.keys(FILE_SIZE_LIMITS) as SupportedMimeType[]).includes(
    file.type as SupportedMimeType
  );
}

/**
 * Valide qu'un fichier ne dépasse pas la taille maximale autorisée
 */
export function isValidFileSize(file: File): boolean {
  const maxSize = FILE_SIZE_LIMITS[file.type as SupportedMimeType];
  return maxSize !== undefined && file.size <= maxSize;
}

/**
 * Valide un fichier (type, taille, nom)
 * @throws {FileValidationError} Si le fichier n'est pas valide
 */
export function validateFile(file: File): void {
  // Vérifier que le fichier n'est pas vide
  if (file.size === 0) {
    throw new FileValidationError('Le fichier est vide', 'EMPTY_FILE');
  }

  // Vérifier le type MIME
  if (!isValidFileType(file)) {
    throw new FileValidationError(`Type de fichier non supporté: ${file.type}`, 'INVALID_TYPE');
  }

  // Vérifier la taille
  if (!isValidFileSize(file)) {
    const maxSize = FILE_SIZE_LIMITS[file.type as SupportedMimeType];
    throw new FileValidationError(
      `Le fichier dépasse la taille maximale autorisée (${formatFileSize(maxSize)})`,
      'FILE_TOO_LARGE'
    );
  }

  // Vérifier le nom de fichier
  if (!file.name || file.name.trim().length === 0) {
    throw new FileValidationError('Nom de fichier invalide', 'INVALID_NAME');
  }
}

/**
 * Formate une taille de fichier en octets vers une chaîne lisible
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Extrait l'extension d'un nom de fichier
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Génère un nom de fichier unique avec timestamp
 */
export function generateUniqueFilename(originalFilename: string): string {
  const extension = getFileExtension(originalFilename);
  const nameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  return `${nameWithoutExt}_${timestamp}_${randomSuffix}${extension}`;
}

/**
 * Lit un fichier comme Data URL (base64)
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
      }
    };

    reader.onerror = () => {
      reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Lit un fichier comme texte
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
      }
    };

    reader.onerror = () => {
      reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
    };

    reader.readAsText(file);
  });
}

/**
 * Lit un fichier comme ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
      }
    };

    reader.onerror = () => {
      reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Télécharge un fichier depuis un Data URL
 */
export function downloadFile(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Crée un objet File depuis une Data URL
 */
export function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  if (arr.length !== 2) {
    throw new FileValidationError('Format Data URL invalide', 'INVALID_TYPE');
  }

  const mimeMatch = arr[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]!);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

/**
 * Vérifie si un fichier est une image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Vérifie si un fichier est un PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf';
}

/**
 * Vérifie si un fichier est un document texte
 */
export function isTextFile(file: File): boolean {
  return file.type === 'text/plain' || file.type === 'text/csv' || file.type === 'application/json';
}

/**
 * Crée une miniature d'une image
 */
export function createImageThumbnail(
  file: File,
  maxWidth: number = 200,
  maxHeight: number = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new FileValidationError("Le fichier n'est pas une image", 'INVALID_TYPE'));
      return;
    }

    const reader = new FileReader();

    reader.onload = e => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculer les nouvelles dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type));
      };

      img.onerror = () => {
        reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new FileValidationError('Erreur de lecture du fichier', 'READ_ERROR'));
    };

    reader.readAsDataURL(file);
  });
}
