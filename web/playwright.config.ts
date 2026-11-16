import { defineConfig } from '@playwright/test';

const FECHAMENTO = /fechamento\.spec\.ts$/;

export default defineConfig({
  testDir: './e2e',
  // um worker, em ordem: os testes compartilham o caixa de hoje
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8080',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    { name: 'chromium', testIgnore: FECHAMENTO, use: { browserName: 'chromium' } },
    // fecha o caixa de hoje: só roda depois de todos os outros
    {
      name: 'fechamento',
      testMatch: FECHAMENTO,
      dependencies: ['chromium'],
      use: { browserName: 'chromium' },
    },
  ],
});
