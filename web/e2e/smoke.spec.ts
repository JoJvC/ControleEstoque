import { APIRequestContext, expect, test } from '@playwright/test';

const reais = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(valor)
    .replace(/ /g, ' ');

const hoje = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

async function criar<T>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const resposta = await request.post(url, { data });
  expect(resposta.ok(), `POST ${url}: ${resposta.status()} ${await resposta.text()}`).toBe(true);
  return (await resposta.json()) as T;
}

interface Resumo {
  caixa: { status: string };
  entradas: number;
}

test('operador → PDV → venda com pagamento parcial → caixa', async ({ page, request }) => {
  const suf = String(Date.now());
  const nomeOperador = `Operador E2E ${suf}`;
  const nomeCliente = `Cliente E2E ${suf}`;
  const nomeProduto = `Água E2E ${suf}`;

  // Preparo pela API (init.sql não traz funcionário, cliente nem produto).
  const cargo = await criar<{ id: string }>(request, '/api/rh/v1/cargos', {
    nome: `Vendedor E2E ${suf}`,
    permissoes: ['vendas.registrar'],
  });
  const funcionario = await criar<{ id: string }>(request, '/api/rh/v1/funcionarios', {
    nome: nomeOperador,
    cargoId: cargo.id,
    valorDiaria: 80,
  });
  await criar(request, '/api/clientes/v1/clientes', { nome: nomeCliente });
  const marca = await criar<{ id: string }>(request, '/api/estoque/v1/marcas', {
    nome: `Marca E2E ${suf}`,
  });
  const agua = await criar<{ id: string }>(request, '/api/estoque/v1/produtos', {
    tipo: 'AGUA',
    nome: nomeProduto,
    marcaId: marca.id,
    tamanho: '20L',
    precoReferencia: 50,
    estoqueMinimo: 5,
  });
  const cascos = await (await request.get('/api/estoque/v1/produtos?tipo=CASCO')).json();
  await criar(request, '/api/estoque/v1/abastecimentos', {
    tipoFrete: 'PROPRIO',
    custoTotal: 100,
    itens: [
      { produtoId: agua.id, quantidade: 20, custoUnitario: 30 },
      { produtoId: cascos[0].id, quantidade: 10, custoUnitario: 0 },
    ],
  });

  const urlCaixa = `/api/financeiro/v1/caixas/${hoje()}`;
  let resumo = await request.get(urlCaixa);
  if (resumo.status() === 404) {
    await criar(request, '/api/financeiro/v1/caixas', { saldoInicial: 100 });
    resumo = await request.get(urlCaixa);
  }
  const antes = (await resumo.json()) as Resumo;
  expect(antes.caixa.status, 'caixa de hoje fechado: rode em base limpa').toBe('ABERTO');
  const entradasAntes = antes.entradas;

  // Operador
  await page.goto('/operador');
  await expect(page.getByRole('heading', { name: 'Quem está operando?' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nomeOperador) }).click();
  await expect(page).toHaveURL(/\/home$/);
  const gravado = await page.evaluate(() => localStorage.getItem('ce.operador'));
  expect(JSON.parse(gravado ?? 'null').id).toBe(funcionario.id);

  // PDV
  await page.goto('/vendas/nova');
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(nomeCliente);
  await page.getByRole('button', { name: new RegExp(nomeCliente) }).click();
  await page.getByRole('button', { name: 'Avançar' }).click();

  await page.getByRole('textbox', { name: 'Buscar produto' }).fill(nomeProduto);
  await page.getByRole('button', { name: new RegExp(nomeProduto) }).click();

  // Sheet aberta: Preço unitário tem de caber na viewport (regressão do overflow).
  const sheet = page.getByRole('dialog');
  const larguraViewport = page.viewportSize()!.width;
  const campo = await sheet.getByLabel('Preço unitário').first().boundingBox();
  const host = await sheet.locator('ce-money-input').first().boundingBox();
  for (const box of [campo, host]) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(larguraViewport);
  }

  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
  await page.getByRole('button', { name: 'Avançar' }).click();

  // Cascos
  await page.getByRole('button', { name: 'Avançar' }).click();

  // Pagamento parcial: 20 de 50 → fiado
  await page.getByRole('button', { name: 'Adicionar forma de pagamento' }).click();
  await page.getByLabel('Forma de pagamento').selectOption('PIX');
  await page.getByLabel('Valor do pagamento').fill('20,00');
  await expect(page.getByText('Vai para fiado')).toBeVisible();
  await page.getByRole('button', { name: 'Avançar' }).click();

  await page.getByRole('button', { name: 'Registrar venda' }).click();
  await expect(page.getByRole('region', { name: 'Venda registrada' })).toBeVisible();
  await expect(page.getByText('PARCIAL', { exact: true })).toBeVisible();

  // Caixa
  await page.goto('/financeiro/caixa');
  await expect(page.getByText('Aberto', { exact: true })).toBeVisible();
  const entradasUi = page.locator('dl.totais dt', { hasText: 'Entradas' }).locator('+ dd');
  await expect
    .poll(async () => ((await entradasUi.textContent()) ?? '').replace(/ /g, ' ').trim())
    .toBe(reais(entradasAntes + 20));

  const depois = (await (await request.get(urlCaixa)).json()) as Resumo;
  expect(depois.entradas).toBe(entradasAntes + 20);
});
