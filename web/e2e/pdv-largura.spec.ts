import { devices, expect, test } from '@playwright/test';

// Pixel 7 (412x839): a fileira de pílulas de categoria alargava o layout para 441 px.
test.use({ ...devices['Pixel 7'] });

const CATEGORIAS = ['Água', 'Gás', 'Gelo', 'Cerveja', 'Refrigerante', 'Carvão', 'Copos'];

// Layout real (a spec vitest roda em jsdom, sem layout): nada no PDV passa de 100vw.
test('PDV no celular: com 7 categorias, as pílulas rolam dentro de si e a página não vaza', async ({
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
  await page.route('**/api/estoque/v1/tipos-casco', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/estoque/v1/produtos', (r) =>
    r.fulfill({
      json: CATEGORIAS.map((categoria, i) => ({
        id: `p${i}`,
        tipo: 'DESCARTAVEL',
        nome: `Produto ${categoria}`,
        categoria,
        tamanho: null,
        tipoCascoId: null,
        estoqueGeral: 5,
        marcas: [
          {
            id: `pm${i}`,
            marcaId: 'm1',
            marcaNome: 'Indaiá',
            precoReferencia: 10,
            estoqueMinimo: 1,
            quantidade: 5,
            abaixoMinimo: false,
            fotoUrl: null,
            tipoCascoId: null,
            tipoCascoResolvidoId: null,
          },
        ],
      })),
    }),
  );

  await page.goto('/vendas/nova');
  await expect(page.getByRole('button', { name: 'Copos', exact: true })).toBeAttached();

  const medidas = await page.evaluate(() => {
    const pilulas = document.querySelector<HTMLElement>('.pilulas')!;
    return {
      largura: document.documentElement.scrollWidth,
      janela: window.innerWidth,
      pilulasCabem: pilulas.scrollWidth > pilulas.clientWidth,
    };
  });
  expect(medidas.largura).toBeLessThanOrEqual(medidas.janela);
  // a fileira é mais larga que a tela e rola por dentro
  expect(medidas.pilulasCabem).toBe(true);
});
