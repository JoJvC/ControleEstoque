import { devices, expect, test } from '@playwright/test';

// Pixel 7 (412x839, isMobile, hasTouch): o cenário em que o botão apareceu coberto.
test.use({ ...devices['Pixel 7'] });

// Layout real (a spec vitest roda em jsdom, sem layout): o Salvar do cabeçalho segue visível ao
// rolar e o menu inferior não cobre o fim do formulário.
test('produto novo: com várias marcas, o Salvar do cabeçalho fica visível e o fim do formulário não fica sob o menu', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ce.operador',
      JSON.stringify({
        id: 'f1',
        nome: 'Maria',
        cargoId: 'c1',
        cargoNome: 'Gerente',
        permissoes: ['*'],
      }),
    ),
  );
  await page.route('**/api/estoque/v1/marcas', (r) =>
    r.fulfill({ json: [{ id: 'm1', nome: 'Indaiá' }] }),
  );
  await page.route('**/api/estoque/v1/tipos-casco', (r) => r.fulfill({ json: [] }));

  await page.goto('/produtos/novo');
  const adicionar = page.getByRole('button', { name: 'Adicionar marca' });
  for (let i = 0; i < 4; i++) {
    await adicionar.click();
  }
  // a linha inicial + 4 adicionadas; o clique volta antes do último card renderizar
  await expect(page.getByRole('button', { name: 'Remover' })).toHaveCount(5);
  // rola até o fim de fato (a altura ainda pode crescer com fontes e cards)
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return (
          Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight
        );
      }),
    )
    .toBe(true);

  const salvar = page.getByRole('button', { name: 'Salvar' });
  await expect(salvar).toBeVisible();
  const caixaSalvar = (await salvar.boundingBox())!;
  const salvarNoPonto = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('ce-button')?.textContent?.trim(),
    { x: caixaSalvar.x + caixaSalvar.width / 2, y: caixaSalvar.y + caixaSalvar.height / 2 },
  );
  expect(salvarNoPonto).toContain('Salvar');

  const caixa = (await adicionar.boundingBox())!;
  const noPonto = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('ce-button')?.textContent?.trim(),
    { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 },
  );
  expect(noPonto).toContain('Adicionar marca');

  // sem estouro horizontal e com folga acima do menu inferior
  const medidas = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    janela: window.innerWidth,
    topoDoMenu: document.querySelector('ce-bottom-nav')!.getBoundingClientRect().top,
  }));
  expect(medidas.largura).toBeLessThanOrEqual(medidas.janela);
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(medidas.topoDoMenu);
});
