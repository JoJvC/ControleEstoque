import { devices, expect, test } from '@playwright/test';

// Pixel 7 (412x839, isMobile, hasTouch): o cenário em que o botão apareceu coberto.
test.use({ ...devices['Pixel 7'] });

// Layout real (a spec vitest roda em jsdom, sem layout): a barra fixa não cobre o fim do formulário.
test('produto novo: com várias marcas, "Adicionar marca" recebe o clique ao rolar até o fim', async ({
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

  const caixa = (await adicionar.boundingBox())!;
  const noPonto = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('ce-button')?.textContent?.trim(),
    { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 },
  );
  expect(noPonto).toContain('Adicionar marca');

  // sem estouro horizontal (mudaria o layout viewport e a posição dos fixos) e com folga acima da barra
  const medidas = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    janela: window.innerWidth,
    topoDaBarra: document.querySelector('ce-barra-acao')!.getBoundingClientRect().top,
  }));
  expect(medidas.largura).toBeLessThanOrEqual(medidas.janela);
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(medidas.topoDaBarra);
});
