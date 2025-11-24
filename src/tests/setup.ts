import { config } from '@vue/test-utils';

// Configure global test settings
config.global.stubs = {
  RouterLink: true,
  RouterView: true,
};
