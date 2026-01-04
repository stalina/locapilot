import { describe, expect, it } from 'vitest';
import {
  arrayBufferToBase64,
  base64ToBlob,
  deserializeDocuments,
  serializeDocuments,
  tryParseDataUrl,
} from '@/features/settings/services/dataTransferService';

describe('dataTransferService', () => {
  it('arrayBufferToBase64/base64ToBlob round-trip preserves bytes', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);
    const b64 = arrayBufferToBase64(bytes.buffer);
    const blob = base64ToBlob(b64, 'application/octet-stream');
    const out = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });

  it('tryParseDataUrl parses data URL', () => {
    const parsed = tryParseDataUrl('data:text/plain;base64,SGVsbG8=');
    expect(parsed).toEqual({ mime: 'text/plain', b64: 'SGVsbG8=' });
  });

  it('serializeDocuments converts Blob to data URL and deserializeDocuments rebuilds Blob', async () => {
    const blob = new Blob([new Uint8Array([72, 105])], { type: 'text/plain' });

    const docs: any[] = [
      {
        id: 1,
        name: 'test.txt',
        type: 'other',
        mimeType: 'text/plain',
        size: blob.size,
        data: blob,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ];

    const serialized = await serializeDocuments(docs);
    expect(serialized[0]?.data).toMatch(/^data:text\/plain;base64,/);

    const rebuilt = deserializeDocuments(serialized as any);
    const rebuiltBlob = (rebuilt[0] as any).data as Blob;
    expect(rebuiltBlob).toBeInstanceOf(Blob);
    expect(rebuiltBlob.type).toBe('text/plain');
    expect(new TextDecoder().decode(await rebuiltBlob.arrayBuffer())).toBe('Hi');
  });
});
