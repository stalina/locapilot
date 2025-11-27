import { beforeEach, vi } from 'vitest';
import { config } from '@vue/test-utils';
import 'fake-indexeddb/auto';

// fake-indexeddb provides a full IndexedDB implementation

// Configure Vue Test Utils
config.global.mocks = {
  $t: (key: string) => key, // Mock i18n if needed
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
