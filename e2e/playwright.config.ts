import { defineConfig, devices } from '@playwright/test';

const webBaseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const apiHealthUrl = process.env.E2E_API_HEALTH_URL ?? 'http://127.0.0.1:3000/health';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'bash scripts/e2e-api.sh',
      url: apiHealthUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @clandestino/web dev --host 127.0.0.1 --port 5173',
      url: webBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '..',
    },
  ],
});
