import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/shared-contracts/vitest.config.ts',
      'packages/tournament-engine/vitest.config.ts',
    ],
  },
});
