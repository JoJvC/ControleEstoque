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
  'caixa.fechar',
];

async function criarOperador(request: APIRequestContext, suf: string, prefixo = 'Operador E2E') {
  const cargo = await criar<{ id: string }>(request, '/api/rh/v1/cargos', {
    nome: `Vendedor E2E ${suf}`,
    permissoes: PERMISSOES,
  });
  const nome = `${prefixo} ${suf}`;
  const funcionario = await criar<{ id: string }>(request, '/api/rh/v1/funcionarios', {
    nome,
    cargoId: cargo.id,
    valorDiaria: 80,
  });
  return { id: funcionario.id, nome };
}

async function criarProduto(request: APIRequestContext, suf: string, estoqueMinimo: number) {
  const marca = await criar<{ id: string }>(request, '/api/estoque/v1/marcas', {
    nome: `Marca E2E ${suf}`,
  });
  const nome = `Água E2E ${suf}`;
  const produto = await criar<{ id: string }>(request, '/api/estoque/v1/produtos', {
    tipo: 'DESCARTAVEL',
    nome,
    categoria: null,
    tamanho: '20L',
    tipoCascoId: null,
  });
  const comMarca = await criar<{ marcas: { id: string }[] }>(
    request,
    `/api/estoque/v1/produtos/${produto.id}/marcas`,
    { marcaId: marca.id, precoReferencia: 50, estoqueMinimo, tipoCascoId: null },
  );
  return { id: produto.id, produtoMarcaId: comMarca.marcas[0].id, nome };
}

// Momento 1: só quantidades; o custo é lançado depois (estoque.custos).
async function abastecer(
  request: APIRequestContext,
  funcionarioId: string,
  produtoMarcaId: string,
  quantidade: number,
) {
  await criar(request, '/api/estoque/v1/abastecimentos', {
    tipoFrete: 'PROPRIO',
    funcionarioId,
    itens: [{ produtoMarcaId, quantidade }],
    cascos: [],
  });
}

const urlCaixa = () => `/api/financeiro/v1/caixas/${hoje()}`;

/** Abre o caixa de hoje se não existir; falha se já estiver fechado. */
async function garantirCaixaAberto(request: APIRequestContext): Promise<Resumo> {
  let resumo = await request.get(urlCaixa());
  if (resumo.status() === 404) {
    await criar(request, '/api/financeiro/v1/caixas', { saldoInicial: 100 });
    resumo = await request.get(urlCaixa());
  }
  const dados = (await resumo.json()) as Resumo;
  expect(dados.caixa.status, 'caixa de hoje fechado: rode em base limpa').toBe('ABERTO');
  return dados;
}

/** PDV em uma tela: escolhe o cliente e toca no produto (1 unidade). */
async function escolherClienteEProduto(page: Page, cliente: string, produto: string) {
  await page.goto('/vendas/nova');
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(cliente);
  await page.getByRole('button', { name: new RegExp(cliente) }).click();
  await page.getByRole('textbox', { name: 'Buscar produto' }).fill(produto);
  await page.getByRole('button', { name: `Adicionar ${produto}` }).click();
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
  await expect(page.getByRole('button', { name: /^Caixa:/ })).toBeVisible();
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

test('operador → PDV em uma tela → venda com pagamento parcial → caixa', async ({
  page,
  request,
}) => {
  const suf = String(Date.now());
  const nomeCliente = `Cliente E2E ${suf}`;

  // Preparo pela API (init.sql não traz funcionário, cliente nem produto).
  const funcionario = await criarOperador(request, suf);
  await criar(request, '/api/clientes/v1/clientes', { nome: nomeCliente });
  const agua = await criarProduto(request, suf, 5);
  const tiposCasco = await (await request.get('/api/estoque/v1/tipos-casco')).json();
  await criar(request, '/api/estoque/v1/abastecimentos', {
    tipoFrete: 'PROPRIO',
    funcionarioId: funcionario.id,
    itens: [{ produtoMarcaId: agua.produtoMarcaId, quantidade: 20 }],
    cascos: [{ tipoCascoId: tiposCasco[0].id, quantidade: 10 }],
  });
  const entradasAntes = (await garantirCaixaAberto(request)).entradas;

  await selecionarOperador(page, funcionario.nome);
  const gravado = await page.evaluate(() => localStorage.getItem('ce.operador'));
  expect(JSON.parse(gravado ?? 'null').id).toBe(funcionario.id);

  // Cliente → produto
  await escolherClienteEProduto(page, nomeCliente, agua.nome);
  await expect(page.getByRole('button', { name: 'Cobrar', exact: true })).toBeEnabled();

  // Preço e desconto: Preço unitário tem de caber na viewport (regressão do overflow).
  await page.getByRole('button', { name: 'Preço e desconto' }).click();
  const sheet = page.getByRole('dialog');
  const larguraViewport = page.viewportSize()!.width;
  const campo = await sheet.getByLabel('Preço unitário').first().boundingBox();
  const host = await sheet.locator('ce-money-input').first().boundingBox();
  for (const box of [campo, host]) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(larguraViewport);
  }
  await sheet.getByRole('button', { name: /Adicionar ao carrinho|Atualizar item/ }).click();

  // Cobrar: 20 de 50 no PIX → 30 vão para fiado
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  const cobrar = page.getByRole('dialog');
  await cobrar.getByRole('group', { name: 'Formas de pagamento' }).getByText('PIX').click();
  await cobrar.getByLabel('Valor em PIX').fill('20,00');
  await expect(cobrar.getByText(/Vai para fiado/)).toBeVisible();
  await cobrar.getByRole('button', { name: /Confirmar venda/ }).click();

  await expect(page.getByRole('region', { name: 'Venda registrada' })).toBeVisible();
  await expect(page.getByText('Parcial', { exact: true })).toBeVisible();

  // Caixa
  await page.goto('/financeiro/caixa');
  await expect(page.getByText(/Aberto/).first()).toBeVisible();
  await expect(page.getByText(`Entradas ${reais(entradasAntes + 20)}`)).toBeVisible();

  const depois = (await (await request.get(urlCaixa())).json()) as Resumo;
  expect(depois.entradas).toBe(entradasAntes + 20);
});

test('Repetir última venda: PDV recarrega o item da venda anterior', async ({ page, request }) => {
  const suf = String(Date.now());
  const nomeCliente = `Cliente E2E ${suf}`;
  const funcionario = await criarOperador(request, suf);
  await criar(request, '/api/clientes/v1/clientes', { nome: nomeCliente });
  const agua = await criarProduto(request, suf, 0);
  await abastecer(request, funcionario.id, agua.produtoMarcaId, 10);
  await garantirCaixaAberto(request);
  await selecionarOperador(page, funcionario.nome);

  // Venda anterior pela UI: forma padrão sem valor, tudo para fiado.
  await escolherClienteEProduto(page, nomeCliente, agua.nome);
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Confirmar venda/ })
    .click();
  await expect(page.getByRole('region', { name: 'Venda registrada' })).toBeVisible();

  // Nova venda: com o cliente escolhido e o carrinho vazio, Repetir traz o item.
  await page.goto('/vendas/nova');
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(nomeCliente);
  await page.getByRole('button', { name: new RegExp(nomeCliente) }).click();
  await page.getByRole('button', { name: 'Repetir última venda' }).click();
  await expect(page.getByRole('button', { name: 'Preço e desconto' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cobrar', exact: true })).toBeEnabled();
  await expect(page.getByText('1 item', { exact: false }).first()).toBeVisible();
});

test('Clientes: bottom-nav → busca → detalhe com Vender e Repetir', async ({ page, request }) => {
  const suf = String(Date.now());
  const nomeCliente = `Cliente E2E ${suf}`;
  const operador = await criarOperador(request, suf);
  await criar(request, '/api/clientes/v1/clientes', { nome: nomeCliente });
  await selecionarOperador(page, operador.nome);

  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Clientes' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Clientes', exact: true }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(nomeCliente);
  await page.getByText(nomeCliente, { exact: true }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: nomeCliente, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vender', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Repetir última venda' })).toBeVisible();
});

test('reposição: Repor na Home → abastecimento com o produto → entrada', async ({
  page,
  request,
}) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf);
  const agua = await criarProduto(request, suf, 5);
  await abastecer(request, operador.id, agua.produtoMarcaId, 2); // 2 < mínimo 5
  await selecionarOperador(page, operador.nome);

  await page.getByRole('button', { name: `Repor ${agua.nome}` }).click();
  await expect(page).toHaveURL(new RegExp(`/estoque/abastecimento\\?produtoId=${agua.id}`));
  await expect(page.getByRole('heading', { level: 1, name: 'Chegou mercadoria' })).toBeVisible();
  await expect(page.getByText(agua.nome).first()).toBeVisible();

  // Só quantidade: a tela não pede custo (momento 1); o produto vem pré-filtrado.
  await page.getByRole('textbox', { name: 'Quantidade' }).first().fill('12');
  await page.getByRole('button', { name: 'Retirada nossa' }).click();
  await expect(page.getByLabel('Custo total da carga (R$)')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/estoque$/);

  const estoque = (await (await request.get('/api/estoque/v1/estoque')).json()) as {
    produtoId: string;
    quantidade: number;
    abaixoMinimo: boolean;
  }[];
  const item = estoque.find((i) => i.produtoId === agua.id);
  expect(item?.quantidade).toBeGreaterThan(2);
  expect(item?.abaixoMinimo).toBe(false);
});

test('Caixa: Home → estado e ações; fechamento abre e é cancelado', async ({ page, request }) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf);
  await garantirCaixaAberto(request);
  await selecionarOperador(page, operador.nome);

  await page.getByRole('button', { name: /^Caixa: / }).click();
  await expect(page).toHaveURL(/\/financeiro\/caixa$/);
  await expect(page.getByText(/Aberto/).first()).toBeVisible();

  // Não fecha o caixa de verdade: o smoke tem de rodar de novo no mesmo dia.
  await expect(page.getByRole('button', { name: 'Lançar despesa' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar caixa' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Fechar o caixa' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(sheet).toBeHidden();

  const resumo = (await (await request.get(urlCaixa())).json()) as Resumo;
  expect(resumo.caixa.status).toBe('ABERTO');
});

test('Relatórios: Mais → hub → vendas por período', async ({ page, request }) => {
  const operador = await criarOperador(request, String(Date.now()));
  await selecionarOperador(page, operador.nome);

  await page.goto('/mais');
  await page
    .getByRole('navigation', { name: 'Outras áreas' })
    .getByRole('link', { name: 'Relatórios' })
    .click();
  await expect(page).toHaveURL(/\/relatorios$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Relatórios', exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: /Vendas por período/ }).click();
  await expect(page).toHaveURL(/\/relatorios\/vendas-por-periodo$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendas por período', exact: true }),
  ).toBeVisible();
  // Com venda no dia aparece "Por dia"; sem venda, o estado vazio coerente.
  await expect(
    page.getByRole('heading', { name: 'Por dia' }).or(page.getByText('Nenhuma venda no período')),
  ).toBeVisible();
});

test('troca de operador: Mais → Trocar operador → outro funcionário', async ({ page, request }) => {
  const suf = String(Date.now());
  const primeiro = await criarOperador(request, suf + 'a', 'Operador A E2E');
  const segundo = await criarOperador(request, suf + 'b', 'Operador B E2E');
  await selecionarOperador(page, primeiro.nome);

  await page.goto('/mais');
  await page.getByRole('button', { name: 'Trocar operador' }).click();
  await expect(page).toHaveURL(/\/operador$/);
  await selecionarOperador(page, segundo.nome);

  const gravado = await page.evaluate(() => localStorage.getItem('ce.operador'));
  expect(JSON.parse(gravado ?? 'null').id).toBe(segundo.id);
  await expect(page.getByRole('button', { name: 'Nova venda' })).toBeVisible();
});

test('temas: clique, seta, persistência e volta ao Automático', async ({ page, request }) => {
  const operador = await criarOperador(request, String(Date.now()));
  await selecionarOperador(page, operador.nome);
  await page.goto('/mais/aparencia');

  const raiz = page.locator('html');
  const tema = page.getByRole('radiogroup', { name: 'Tema' });
  const opcao = (nome: string) => tema.getByRole('radio', { name: new RegExp(`^${nome}`) });

  const temas: [string, string][] = [
    ['Oceano', 'oceano'],
    ['Uva', 'uva'],
    ['Carvão', 'carvao'],
    ['Noite', 'noite'],
  ];
  for (const [nome, slug] of temas) {
    await opcao(nome).click();
    await expect(opcao(nome)).toHaveAttribute('aria-checked', 'true');
    await expect(raiz).toHaveAttribute('data-tema', slug);
  }

  // Teclado: de Oceano, seta para a direita escolhe Uva.
  await opcao('Oceano').click();
  await page.keyboard.press('ArrowRight');
  await expect(opcao('Uva')).toHaveAttribute('aria-checked', 'true');
  await expect(raiz).toHaveAttribute('data-tema', 'uva');

  // Persistência
  await page.reload();
  await expect(opcao('Uva')).toHaveAttribute('aria-checked', 'true');
  await expect(raiz).toHaveAttribute('data-tema', 'uva');
  expect(await page.evaluate(() => localStorage.getItem('ce.tema'))).toContain('uva');

  // Volta ao Automático (Oceano, ou Noite se o navegador estiver em modo escuro)
  await opcao('Automático').click();
  await expect(opcao('Automático')).toHaveAttribute('aria-checked', 'true');
  await expect(raiz).toHaveAttribute('data-tema', /^(oceano|noite)$/);
});
