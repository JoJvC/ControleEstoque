import { APIRequestContext, expect, Page, test } from '@playwright/test';

const reais = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(valor)
    .replace(/[\u00a0\u202f]/g, ' ');

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

const PERMISSOES = [
  'vendas.registrar',
  'rh.gerir',
  'relatorios.ver',
  'clientes.cadastrar',
  'estoque.editar',
];

async function criarOperador(request: APIRequestContext, suf: string) {
  const cargo = await criar<{ id: string }>(request, '/api/rh/v1/cargos', {
    nome: `Vendedor E2E ${suf}`,
    permissoes: PERMISSOES,
  });
  const funcionario = await criar<{ id: string }>(request, '/api/rh/v1/funcionarios', {
    nome: `Operador E2E ${suf}`,
    cargoId: cargo.id,
    valorDiaria: 80,
  });
  return { id: funcionario.id, nome: `Operador E2E ${suf}` };
}

async function selecionarOperador(page: Page, nome: string) {
  await page.goto('/operador');
  await expect(page.getByRole('heading', { name: 'Quem está operando?' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nome) }).click();
  await expect(page).toHaveURL(/\/home$/);
}

interface Resumo {
  caixa: { status: string };
  entradas: number;
}

test('seleção de operador: guard → escolha → home', async ({ page, request }) => {
  const operador = await criarOperador(request, String(Date.now()));

  await page.goto('/home');
  await expect(page).toHaveURL(/\/operador$/);
  await selecionarOperador(page, operador.nome);

  const gravado = await page.evaluate(() => localStorage.getItem('ce.operador'));
  expect(JSON.parse(gravado ?? 'null').id).toBe(operador.id);
  await expect(page.getByRole('button', { name: 'Nova venda' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Caixa de hoje' })).toBeVisible();
});

test('navegação pelas telas no design Depósito', async ({ page, request }) => {
  const operador = await criarOperador(request, String(Date.now()));
  await selecionarOperador(page, operador.nome);

  const h1 = (nome: string) =>
    expect(page.getByRole('heading', { level: 1, name: nome, exact: true })).toBeVisible();

  const telas: [string, string, string?][] = [
    ['/rh', 'Funcionários e cargos'],
    ['/rh/funcionarios', 'Funcionários', 'Novo funcionário'],
    ['/rh/cargos', 'Cargos', 'Novo cargo'],
    ['/clientes', 'Clientes'],
    ['/produtos', 'Produtos'],
    ['/marcas', 'Marcas'],
    ['/estoque', 'Estoque'],
    ['/financeiro/caixa', 'Caixa do dia'],
    ['/vendas', 'Vendas'],
    ['/relatorios', 'Relatórios'],
    ['/relatorios/vendas-por-periodo', 'Vendas por período'],
    ['/mais', 'Mais'],
  ];
  for (const [rota, titulo, botao] of telas) {
    await page.goto(rota);
    await h1(titulo);
    if (botao) {
      await expect(page.getByRole('button', { name: botao, exact: true })).toBeVisible();
    }
  }

  await page.goto('/mais');
  await expect(page.getByRole('navigation', { name: 'Outras áreas' })).toBeVisible();
  await page.goto('/mais/aparencia');
  await expect(page.getByRole('radio', { name: /Automático/ })).toBeVisible();
});

test('operador → PDV → venda com pagamento parcial → caixa', async ({ page, request }) => {
  const suf = String(Date.now());
  const nomeCliente = `Cliente E2E ${suf}`;
  const nomeProduto = `Água E2E ${suf}`;

  // Preparo pela API (init.sql não traz funcionário, cliente nem produto).
  const funcionario = await criarOperador(request, suf);
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
  await selecionarOperador(page, funcionario.nome);
  const gravado = await page.evaluate(() => localStorage.getItem('ce.operador'));
  expect(JSON.parse(gravado ?? 'null').id).toBe(funcionario.id);

  // PDV
  await page.goto('/vendas/nova');
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(nomeCliente);
  await page.getByRole('button', { name: new RegExp(nomeCliente) }).click();
  await page.getByRole('button', { name: 'Avançar' }).click();

  await page.getByRole('textbox', { name: 'Buscar produto' }).fill(nomeProduto);
  const linhaProduto = page.locator('ce-produto-linha').filter({ hasText: nomeProduto });
  await linhaProduto.getByRole('button', { name: `Aumentar ${nomeProduto}` }).click();
  await linhaProduto.getByRole('button', { name: 'preço e desconto' }).click();

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

  await page.getByRole('button', { name: /Adicionar ao carrinho|Atualizar item/ }).click();
  await page.getByRole('button', { name: 'Avançar' }).click();

  // Cascos
  await page.getByRole('button', { name: 'Avançar' }).click();

  // Pagamento parcial: 20 de 50 → fiado
  await page.getByRole('button', { name: 'Adicionar forma de pagamento' }).click();
  await page
    .getByRole('radiogroup', { name: 'Forma de pagamento' })
    .getByRole('radio', { name: 'PIX' })
    .click();
  await page.getByLabel('Valor do pagamento').fill('20,00');
  await expect(page.getByText('Vai para fiado')).toBeVisible();
  await page.getByRole('button', { name: 'Avançar' }).click();

  await page.getByRole('button', { name: 'Registrar venda' }).click();
  await expect(page.getByRole('region', { name: 'Venda registrada' })).toBeVisible();
  await expect(page.getByText('Parcial', { exact: true })).toBeVisible();

  // Caixa
  await page.goto('/financeiro/caixa');
  await expect(page.getByText('Aberto', { exact: true })).toBeVisible();
  const entradasUi = page.locator('dl.totais dt', { hasText: 'Entradas' }).locator('+ dd');
  await expect
    .poll(async () =>
      ((await entradasUi.textContent()) ?? '').replace(/[\u00a0\u202f]/g, ' ').trim(),
    )
    .toBe(reais(entradasAntes + 20));

  const depois = (await (await request.get(urlCaixa)).json()) as Resumo;
  expect(depois.entradas).toBe(entradasAntes + 20);
});
