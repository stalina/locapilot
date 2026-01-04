import type { Document } from '@/db/types';

export type SerializedDocument = Omit<Document, 'data'> & { data: string | null };

export type ExportDataPayload = {
  properties: unknown[];
  tenants: unknown[];
  leases: unknown[];
  rents: unknown[];
  documents: SerializedDocument[];
  inventories: unknown[];
  exportedAt: string;
  version: string;
};

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
  }
  return btoa(binary);
}

export function base64ToBlob(b64: string, mime = 'application/octet-stream'): Blob {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function tryParseDataUrl(input: string): { mime: string; b64: string } | null {
  const matches = input.match(/^data:(.+);base64,(.*)$/);
  if (!matches) return null;
  return { mime: matches[1] ?? 'application/octet-stream', b64: matches[2] ?? '' };
}

export async function serializeDocuments(
  documentsRaw: Array<Partial<Document> & { data?: unknown }>
): Promise<SerializedDocument[]> {
  return Promise.all(
    documentsRaw.map(async d => {
      const copy: any = { ...d };
      try {
        const data = (d as any).data;
        if (data instanceof Blob) {
          const ab = await data.arrayBuffer();
          const b64 = arrayBufferToBase64(ab);
          copy.data = `data:${(d as any).mimeType};base64,${b64}`;
        } else if (typeof data === 'string') {
          copy.data = data;
        } else {
          copy.data = null;
        }
      } catch {
        copy.data = null;
      }
      return copy as SerializedDocument;
    })
  );
}

export function deserializeDocuments(
  documents: Array<Partial<SerializedDocument> & { data?: unknown }>
): Array<Record<string, unknown>> {
  return documents.map(d => {
    const copy: any = { ...d };

    try {
      if (typeof d.data === 'string' && d.data.startsWith('data:')) {
        const parsed = tryParseDataUrl(d.data);
        if (parsed) {
          const blob = base64ToBlob(parsed.b64, parsed.mime);
          copy.data = blob;
          copy.mimeType = parsed.mime;
          copy.size = blob.size;
        } else {
          copy.data = null;
        }
      } else {
        copy.data = null;
      }
    } catch {
      copy.data = null;
    }

    return copy;
  });
}

export function validateExportDataShape(data: any): asserts data is ExportDataPayload {
  if (!data || typeof data !== 'object') throw new Error('Format de fichier invalide');
  if (!Array.isArray(data.properties) || !Array.isArray(data.tenants)) {
    throw new Error('Format de fichier invalide');
  }
  if (!('version' in data)) {
    throw new Error('Format de fichier invalide');
  }
}
