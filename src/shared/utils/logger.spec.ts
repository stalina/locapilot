import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    logger.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records an entry with level, message and ISO timestamp', () => {
    logger.info('hello');
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('hello');
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('attaches context when provided', () => {
    logger.warn('careful', { source: 'test', id: 42 });
    expect(logger.getEntries()[0].context).toEqual({ source: 'test', id: 42 });
  });

  it('omits empty context', () => {
    logger.info('no ctx', {});
    expect(logger.getEntries()[0].context).toBeUndefined();
  });

  it('serializes an Error instance into name/message/stack', () => {
    const err = new Error('boom');
    logger.error('failed', { source: 'test' }, err);
    const entry = logger.getEntries()[0];
    expect(entry.error).toBeDefined();
    expect(entry.error?.name).toBe('Error');
    expect(entry.error?.message).toBe('boom');
    expect(entry.error?.stack).toContain('boom');
  });

  it('serializes a non-Error value', () => {
    logger.error('failed', undefined, 'string failure');
    const entry = logger.getEntries()[0];
    expect(entry.error?.name).toBe('NonError');
    expect(entry.error?.message).toBe('string failure');
  });

  it('routes error level to console.error', () => {
    logger.error('boom');
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('caps the in-memory buffer at 200 entries (oldest dropped)', () => {
    for (let i = 0; i < 205; i++) {
      logger.info(`entry-${i}`);
    }
    const entries = logger.getEntries();
    expect(entries).toHaveLength(200);
    expect(entries[0].message).toBe('entry-5');
    expect(entries[199].message).toBe('entry-204');
  });

  it('clears the buffer', () => {
    logger.info('something');
    logger.clear();
    expect(logger.getEntries()).toHaveLength(0);
  });
});
