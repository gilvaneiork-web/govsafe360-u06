// Teste de FUMAÇA: só prova que Playwright + Chromium funcionam neste projeto.
// Os testes funcionais completos (CA01–CA10) chegam no Marco 6.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const PAGINA = pathToFileURL(resolve('index.html')).href;

test('página abre offline no Chromium com 8 cenários e sem erros de JavaScript', async ({ page }) => {
  const erros = [];
  const externas = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  // R08: qualquer requisição que não seja file:// é registrada e bloqueada.
  await page.route((url) => url.protocol !== 'file:', (rota) => {
    externas.push(rota.request().url());
    return rota.abort();
  });

  await page.goto(PAGINA);

  await expect(page).toHaveTitle(/GOVSAFE 360/);
  await expect(page.getByRole('note')).toContainText('Não é sistema institucional homologado');
  await expect(page.locator('#linhas tr')).toHaveCount(8);
  await expect(page.locator('#totais .card-numero')).toHaveText(['8', '2', '3', '3']);
  expect(erros, 'erros de JavaScript').toEqual([]);
  expect(externas, 'requisições externas').toEqual([]);
});
