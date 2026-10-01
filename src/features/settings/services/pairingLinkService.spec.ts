import { describe, it, expect, vi } from 'vitest';
import { toDataURL } from 'qrcode';
import {
  PAIRING_FRAGMENT_KEY,
  PAIRING_PIN_KEY,
  buildPairingUrl,
  generatePairingQrDataUrl,
  isValidSessionId,
  parsePairingFragment,
} from './pairingLinkService';
import { generateSessionId } from './peerSyncService';

// Spy on the bundled QR library while keeping its real implementation, so the
// wrapper is checked both for its arguments and for producing a real PNG.
vi.mock('qrcode', async importOriginal => {
  const actual = await importOriginal<typeof import('qrcode')>();
  return { ...actual, toDataURL: vi.fn(actual.toDataURL) };
});

const SESSION_ID = 'LP7K4MQ2XB';
const PIN = '482913';

describe('pairingLinkService', () => {
  describe('constants', () => {
    it('uses the "p2p" and "pin" fragment keys', () => {
      expect(PAIRING_FRAGMENT_KEY).toBe('p2p');
      expect(PAIRING_PIN_KEY).toBe('pin');
    });
  });

  describe('isValidSessionId', () => {
    it('accepts ids produced by generateSessionId()', () => {
      for (let i = 0; i < 50; i++) {
        expect(isValidSessionId(generateSessionId())).toBe(true);
      }
    });

    it('accepts a well-formed id', () => {
      expect(isValidSessionId(SESSION_ID)).toBe(true);
    });

    it('rejects a wrong prefix', () => {
      expect(isValidSessionId('XX7K4MQ2XB')).toBe(false);
      expect(isValidSessionId('7K4MQ2XB')).toBe(false);
    });

    it('rejects a wrong length', () => {
      expect(isValidSessionId('LP7K4MQ2X')).toBe(false); // 7 chars after the prefix
      expect(isValidSessionId('LP7K4MQ2XBZ')).toBe(false); // 9 chars after the prefix
      expect(isValidSessionId('LP')).toBe(false);
      expect(isValidSessionId('')).toBe(false);
    });

    it.each(['0', 'O', '1', 'I', 'L', 'U'])('rejects the ambiguous character "%s"', char => {
      expect(isValidSessionId(`LP7K4MQ2X${char}`)).toBe(false);
    });

    it('rejects a non-normalised id (lower case, separators)', () => {
      expect(isValidSessionId('lp7k4mq2xb')).toBe(false);
      expect(isValidSessionId('LP7K-4MQ2')).toBe(false);
    });
  });

  describe('buildPairingUrl', () => {
    it('puts the session id and PIN in the fragment of the app root (base "/")', () => {
      const url = buildPairingUrl(SESSION_ID, PIN, 'http://localhost:5173/');
      expect(url).toBe('http://localhost:5173/#p2p=LP7K4MQ2XB&pin=482913');
    });

    it('keeps the deployment base path (base "/locapilot/")', () => {
      const url = buildPairingUrl(SESSION_ID, PIN, 'https://stalina.github.io/locapilot/');
      expect(url).toBe('https://stalina.github.io/locapilot/#p2p=LP7K4MQ2XB&pin=482913');

      const parsed = new URL(url);
      expect(parsed.origin).toBe('https://stalina.github.io');
      expect(parsed.pathname).toBe('/locapilot/');
    });

    it('never uses a query string', () => {
      const url = buildPairingUrl(SESSION_ID, PIN, 'https://stalina.github.io/locapilot/');
      const parsed = new URL(url);
      expect(url).not.toContain('?');
      expect(parsed.search).toBe('');
      expect(parsed.hash).toBe('#p2p=LP7K4MQ2XB&pin=482913');
    });

    it('round-trips through parsePairingFragment', () => {
      const id = generateSessionId();
      const url = buildPairingUrl(id, PIN, 'https://stalina.github.io/locapilot/');
      expect(parsePairingFragment(new URL(url).hash)).toEqual({
        status: 'ok',
        sessionId: id,
        pin: PIN,
      });
    });
  });

  describe('parsePairingFragment', () => {
    it.each(['', '#', '#section', '#foo=bar', '#pin=482913', '#p2pfoo=LP7K4MQ2XB'])(
      'returns "none" when the hash has no p2p key (%j)',
      hash => {
        expect(parsePairingFragment(hash)).toEqual({ status: 'none' });
      }
    );

    it('returns "ok" with the session id and PIN', () => {
      expect(parsePairingFragment('#p2p=LP7K4MQ2XB&pin=482913')).toEqual({
        status: 'ok',
        sessionId: SESSION_ID,
        pin: PIN,
      });
    });

    it('accepts a hash without the leading "#"', () => {
      expect(parsePairingFragment('p2p=LP7K4MQ2XB&pin=482913')).toEqual({
        status: 'ok',
        sessionId: SESSION_ID,
        pin: PIN,
      });
    });

    it('accepts the keys in any order', () => {
      expect(parsePairingFragment('#pin=482913&p2p=LP7K4MQ2XB')).toEqual({
        status: 'ok',
        sessionId: SESSION_ID,
        pin: PIN,
      });
    });

    it('normalises a lower-case, dashed session id', () => {
      expect(parsePairingFragment('#p2p=lp7k-4mq2-xb&pin=482913')).toEqual({
        status: 'ok',
        sessionId: SESSION_ID,
        pin: PIN,
      });
    });

    it('normalises a session id with spaces (encoded "+" or "%20")', () => {
      expect(parsePairingFragment('#p2p=LP7K+4MQ2+XB&pin=482913')).toMatchObject({
        status: 'ok',
        sessionId: SESSION_ID,
      });
      expect(parsePairingFragment('#p2p=LP7K%204MQ2%20XB&pin=482913')).toMatchObject({
        status: 'ok',
        sessionId: SESSION_ID,
      });
    });

    it.each([
      ['a wrong prefix', '#p2p=XX7K4MQ2XB&pin=482913'],
      ['a missing prefix', '#p2p=7K4MQ2XB&pin=482913'],
      ['a too short id', '#p2p=LP7K4MQ2X&pin=482913'],
      ['a too long id', '#p2p=LP7K4MQ2XBZ&pin=482913'],
      ['an empty id', '#p2p=&pin=482913'],
      ['a garbage id', '#p2p=BAD&pin=123456'],
      ['the ambiguous char 0', '#p2p=LP7K4MQ2X0&pin=482913'],
      ['the ambiguous char O', '#p2p=LP7K4MQ2XO&pin=482913'],
      ['the ambiguous char 1', '#p2p=LP7K4MQ2X1&pin=482913'],
      ['the ambiguous char I', '#p2p=LP7K4MQ2XI&pin=482913'],
      ['the ambiguous char L', '#p2p=LP7K4MQ2XL&pin=482913'],
      ['the ambiguous char U', '#p2p=LP7K4MQ2XU&pin=482913'],
    ])('returns "invalid" for %s', (_label, hash) => {
      expect(parsePairingFragment(hash)).toEqual({ status: 'invalid' });
    });

    it.each([
      ['a missing PIN', '#p2p=LP7K4MQ2XB'],
      ['an empty PIN', '#p2p=LP7K4MQ2XB&pin='],
      ['a 5-digit PIN', '#p2p=LP7K4MQ2XB&pin=12345'],
      ['a 7-digit PIN', '#p2p=LP7K4MQ2XB&pin=1234567'],
      ['a non-numeric PIN', '#p2p=LP7K4MQ2XB&pin=12a456'],
      ['a PIN with spaces', '#p2p=LP7K4MQ2XB&pin=123+456'],
    ])('returns "ok" with pin null for %s', (_label, hash) => {
      expect(parsePairingFragment(hash)).toEqual({
        status: 'ok',
        sessionId: SESSION_ID,
        pin: null,
      });
    });
  });

  describe('generatePairingQrDataUrl', () => {
    it('renders the link locally as a PNG data URL with the expected options', async () => {
      const link = buildPairingUrl(SESSION_ID, PIN, 'https://stalina.github.io/locapilot/');

      const dataUrl = await generatePairingQrDataUrl(link);

      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
      // `qrcode` decorates the options object in place (e.g. adds `color`).
      expect(toDataURL).toHaveBeenCalledWith(
        link,
        expect.objectContaining({ errorCorrectionLevel: 'M', margin: 2, width: 220 })
      );
    });

    it('propagates a library failure to the caller', async () => {
      // Far beyond the capacity of a QR code: the real library rejects.
      await expect(generatePairingQrDataUrl('x'.repeat(5000))).rejects.toThrow(/too big/i);
    });
  });
});
