// Configuração do Playwright Test — GOVSAFE 360.
// Testes E2E: tests/e2e/*.spec.mjs (não confundir com os testes Node *.test.mjs).
// Artefatos (ignorados pelo Git — ver .gitignore):
//   evidencias/playwright-resultados/  → traces, prints e vídeos de falhas
//   evidencias/relatorio-html/         → relatório HTML (npm run test:e2e:report)
// Navegador: Chromium do Playwright, no cache do usuário (%LOCALAPPDATA%\ms-playwright).
// Ainda sem webServer: o servidor/build será definido no Marco 6.
import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  outputDir: 'evidencias/playwright-resultados',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'evidencias/relatorio-html', open: 'never' }]
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
