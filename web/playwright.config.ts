import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8080',
    viewport: { width: 390, height: 844 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
