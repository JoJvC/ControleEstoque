import { expect, test } from '@playwright/test';
import {
  abastecer,
  criar,
  criarOperador,
  criarProduto,
  escolherClienteEProduto,
  garantirCaixaAbertoOuPular,
  reais,
  selecionarOperador,
} from './ajudas';

// Fluxos da Fase 5: marca + vasilhame, devolução travada, crédito, dois momentos, 'Sem marca'.
// Rodam contra o compose (gateway em E2E_BASE_URL) e criam os próprios dados com sufixo único.

test('venda com marca e "Pagou o vasilhame": soma o vasilhame e não empresta casco', async ({
  page,
  request,
}) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf);
  const cliente = `Cliente E2E ${suf}`;
  await criar(request, '/api/clientes/v1/clientes', { nome: cliente });
  const produto = await criarProduto(request, suf, 'RETORNAVEL');
  await abastecer(request, operador.id, produto.produtoMarcaId, 10);
  await garantirCaixaAbertoOuPular(request, test); // vender exige o caixa de hoje aberto
  await selecionarOperador(page, operador.nome);

  await escolherClienteEProduto(page, cliente, produto.nome);
  await page.getByRole('button', { name: 'Preço e desconto' }).click();
  const item = page.getByRole('dialog');
  await item.getByLabel(/Pagou o vasilhame/).check();
  await item.getByRole('button', { name: /Adicionar ao carrinho|Atualizar item/ }).click();

  // 1 × (50 + 30 do vasilhame do tipo de casco) = 80, pagos em PIX.
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  const cobrar = page.getByRole('dialog');
  await cobrar.getByRole('group', { name: 'Formas de pagamento' }).getByText('PIX').click();
  await cobrar.getByLabel('Valor em PIX').fill('80,00');
  await cobrar.getByRole('button', { name: /Confirmar venda/ }).click();

  const sucesso = page.getByRole('region', { name: 'Venda registrada' });
  await expect(sucesso).toBeVisible();
  await expect(sucesso.getByText(reais(80)).first()).toBeVisible();
  await expect(sucesso.getByText('Paga', { exact: true })).toBeVisible();
  // linha com vasilhame pago não gera débito de casco
  await expect(
    sucesso.locator('.resumo__linha', { hasText: 'Saldo de cascos do cliente' }).locator('dd'),
  ).toHaveText('0');
});

test('"Devolveu todos na hora" trava o campo do tipo no emprestado; desmarcar libera', async ({
  page,
  request,
}) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf);
  const cliente = `Cliente E2E ${suf}`;
  await criar(request, '/api/clientes/v1/clientes', { nome: cliente });
  const produto = await criarProduto(request, suf, 'RETORNAVEL');
  await abastecer(request, operador.id, produto.produtoMarcaId, 10);
  await selecionarOperador(page, operador.nome);

  await escolherClienteEProduto(page, cliente, produto.nome); // 1 un. em troca
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  const cobrar = page.getByRole('dialog');
  const casco = cobrar.getByLabel(`Cascos devolvidos de ${produto.cascoNome}`, { exact: true });
  const aTodos = cobrar.getByLabel('Devolveu todos na hora');

  await expect(casco).toBeEnabled();
  await aTodos.check();
  await expect(casco).toBeDisabled();
  await expect(casco).toHaveValue('1');
  await aTodos.uncheck();
  await expect(casco).toBeEnabled();
  await expect(casco).toHaveValue('1');
});

test('crédito do cliente como forma de pagamento (saldo montado por pagamento a maior)', async ({
  page,
  request,
}) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf);
  const nomeCliente = `Cliente E2E ${suf}`;
  const cliente = await criar<{ id: string }>(request, '/api/clientes/v1/clientes', {
    nome: nomeCliente,
  });
  const produto = await criarProduto(request, suf, 'DESCARTAVEL');
  await abastecer(request, operador.id, produto.produtoMarcaId, 10);
  await garantirCaixaAbertoOuPular(request, test); // o pagamento avulso entra no caixa de hoje
  // Pagamento sem dívida: o valor inteiro vira crédito do cliente.
  await criar(request, `/api/financeiro/v1/clientes/${cliente.id}/fiado/pagamentos`, {
    valor: 100,
    forma: 'PIX',
  });
  await selecionarOperador(page, operador.nome);

  await escolherClienteEProduto(page, nomeCliente, produto.nome); // 50
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  const cobrar = page.getByRole('dialog');
  await cobrar
    .getByRole('group', { name: 'Formas de pagamento' })
    .getByText('Crédito do cliente')
    .click();
  await cobrar.getByLabel('Valor em Crédito do cliente').fill('50,00');
  await cobrar.getByRole('button', { name: /Confirmar venda/ }).click();

  await expect(page.getByRole('region', { name: 'Venda registrada' })).toBeVisible();
  await expect(page.getByText('Paga', { exact: true })).toBeVisible();
  const saldos = await (await request.get(`/api/clientes/v1/clientes/${cliente.id}/saldos`)).json();
  expect(saldos.creditoDisponivel).toBe(50);
});

test('Chegou mercadoria em dois momentos: só quantidade, depois custo 0 sai dos pendentes', async ({
  page,
  request,
}) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf);
  const produto = await criarProduto(request, suf, 'DESCARTAVEL');
  const cargaId = await abastecer(request, operador.id, produto.produtoMarcaId, 5); // momento 1
  const pendentes = async () =>
    (await (
      await request.get(
        `/api/estoque/v1/abastecimentos/custos-pendentes?funcionarioId=${operador.id}`,
      )
    ).json()) as { id: string }[];
  expect((await pendentes()).some((c) => c.id === cargaId)).toBe(true);

  await selecionarOperador(page, operador.nome);
  await page.goto(`/estoque/abastecimento/${cargaId}/custos`); // momento 2
  await expect(page).toHaveURL(new RegExp(`/estoque/abastecimento/${cargaId}/custos$`));
  await expect(page.getByText('Total da carga', { exact: true })).toBeVisible();
  // um campo por linha da carga (o rótulo traz o nome do produto + marca e o '*')
  await page.locator('.linha ce-money-input input').first().fill('0');
  await page.locator('ce-form-field', { hasText: 'Frete (R$)' }).locator('input').fill('0');
  await page.getByRole('button', { name: 'Salvar custos' }).click();
  await expect(page.getByText('Custos salvos')).toBeVisible();

  const detalhe = await (
    await request.get(`/api/estoque/v1/abastecimentos/${cargaId}?funcionarioId=${operador.id}`)
  ).json();
  expect(detalhe.custoPendente).toBe(false);
  expect(detalhe.custoTotal).toBe(0);
  expect((await pendentes()).some((c) => c.id === cargaId)).toBe(false);
});

test('cadastro de produto com "Sem marca" grava na marca Genérica', async ({ page, request }) => {
  const suf = String(Date.now());
  const operador = await criarOperador(request, suf);
  await selecionarOperador(page, operador.nome);

  await page.goto('/produtos/novo'); // abre Descartável com a linha "Sem marca"
  const nome = `Carvão E2E ${suf}`;
  await page.getByRole('textbox', { name: 'Nome' }).fill(nome);
  await page.getByLabel('Preço de referência').fill('10,00'); // preço é obrigatório; mínimo já vem 0
  await page.getByRole('button', { name: 'Cadastrar produto' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/produtos\/novo$/);

  const produtos = (await (await request.get('/api/estoque/v1/produtos')).json()) as {
    nome: string;
    marcas: { marcaNome: string }[];
  }[];
  const criado = produtos.find((p) => p.nome === nome);
  expect(criado?.marcas.map((m) => m.marcaNome)).toEqual([expect.stringMatching(/gen[eé]rica/i)]);
});
