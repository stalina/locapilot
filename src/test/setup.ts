import { beforeEach, vi } from 'vitest';
import { config } from '@vue/test-utils';

// Mock IndexedDB for tests
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
};

global.indexedDB = indexedDB as any;

// Configure Vue Test Utils
config.global.mocks = {
  $t: (key: string) => key, // Mock i18n if needed
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
