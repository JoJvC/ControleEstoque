import { expect, test } from '@playwright/test';
import { criarOperador, garantirCaixaAbertoOuPular, selecionarOperador } from './ajudas';

// Fecha de verdade o caixa de hoje: roda no projeto 'fechamento', que depende do projeto 'chromium' (playwright.config.ts).
test('fechamento de caixa com a diária editada e confirmada', async ({ page, request }) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf); // diária cadastrada: 80
  await garantirCaixaAbertoOuPular(request, test);
  await selecionarOperador(page, operador.nome);

  await page.goto('/financeiro/caixa');
  await page
    .getByRole('region', { name: 'Ações do caixa' })
    .getByRole('button', { name: 'Fechar caixa' })
    .click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Fechar o caixa' })).toBeVisible();
  const diaria = sheet.getByLabel(`Diária de ${operador.nome}`);
  await diaria.clear();
  await diaria.pressSequentially('10000'); // ce-money-input entra em centavos
  await expect(diaria).toHaveValue('100,00');
  await sheet.getByRole('button', { name: 'Fechar caixa' }).click();
  await expect(page.getByText('Caixa fechado', { exact: true })).toBeVisible();

  const conta = await (
    await request.get(`/api/rh/v1/funcionarios/${operador.id}/conta-corrente`)
  ).json();
  expect(conta.saldoAPagar).toBe(100); // valor do fechamento, não o cadastrado
});
