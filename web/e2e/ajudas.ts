import { APIRequestContext, expect, Page } from '@playwright/test';

export async function criar<T>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const resposta = await request.post(url, { data });
  expect(resposta.ok(), `POST ${url}: ${resposta.status()} ${await resposta.text()}`).toBe(true);
  return (await resposta.json()) as T;
}

export const reais = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(valor)
    .replace(/[  ]/g, ' ');

export const hoje = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const urlCaixa = () => `/api/financeiro/v1/caixas/${hoje()}`;

const PERMISSOES = [
  'vendas.registrar',
  'rh.gerir',
  'relatorios.ver',
  'clientes.cadastrar',
  'estoque.editar',
  'estoque.custos',
  'caixa.fechar',
];

export async function criarOperador(request: APIRequestContext, suf: string) {
  const cargo = await criar<{ id: string }>(request, '/api/rh/v1/cargos', {
    nome: `Vendedor E2E ${suf}`,
    permissoes: PERMISSOES,
  });
  const nome = `Operador E2E ${suf}`;
  const funcionario = await criar<{ id: string }>(request, '/api/rh/v1/funcionarios', {
    nome,
    cargoId: cargo.id,
    valorDiaria: 80,
  });
  return { id: funcionario.id, nome };
}

export async function selecionarOperador(page: Page, nome: string) {
  await page.goto('/operador');
  await page.getByRole('button', { name: new RegExp(nome) }).click();
  await expect(page).toHaveURL(/\/home$/);
}

/** Produto (RETORNAVEL com casco novo, ou DESCARTAVEL) com uma marca e preço de referência 50. */
export async function criarProduto(
  request: APIRequestContext,
  suf: string,
  tipo: 'RETORNAVEL' | 'DESCARTAVEL',
) {
  const marca = await criar<{ id: string }>(request, '/api/estoque/v1/marcas', {
    nome: `Marca E2E ${suf}`,
  });
  const casco =
    tipo === 'RETORNAVEL'
      ? await criar<{ id: string }>(request, '/api/estoque/v1/tipos-casco', {
          nome: `Casco E2E ${suf}`,
          precoVasilhame: 30,
          aceitaSucata: false,
        })
      : null;
  const nome = `Produto E2E ${suf}`;
  const produto = await criar<{ id: string }>(request, '/api/estoque/v1/produtos', {
    tipo,
    nome,
    categoria: null,
    tamanho: '20L',
    tipoCascoId: casco?.id ?? null,
  });
  const comMarca = await criar<{ marcas: { id: string }[] }>(
    request,
    `/api/estoque/v1/produtos/${produto.id}/marcas`,
    { marcaId: marca.id, precoReferencia: 50, estoqueMinimo: 0, tipoCascoId: null },
  );
  return {
    id: produto.id,
    produtoMarcaId: comMarca.marcas[0].id,
    nome,
    cascoNome: `Casco E2E ${suf}`,
    cascoId: casco?.id ?? null,
  };
}

/** Momento 1 do abastecimento: só quantidades. Devolve o id da carga. */
export async function abastecer(
  request: APIRequestContext,
  funcionarioId: string,
  produtoMarcaId: string,
  quantidade: number,
) {
  const carga = await criar<{ id: string }>(request, '/api/estoque/v1/abastecimentos', {
    tipoFrete: 'PROPRIO',
    funcionarioId,
    itens: [{ produtoMarcaId, quantidade }],
    cascos: [],
  });
  return carga.id;
}

export async function escolherClienteEProduto(page: Page, cliente: string, produto: string) {
  await page.goto('/vendas/nova');
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(cliente);
  await page.getByRole('button', { name: new RegExp(cliente) }).click();
  await page.getByRole('textbox', { name: 'Buscar produto' }).fill(produto);
  await page.getByRole('button', { name: `Adicionar ${produto}` }).click();
}

/** Abre o caixa de hoje se não existir; pula o teste se ele já estiver fechado. */
export async function garantirCaixaAbertoOuPular(
  request: APIRequestContext,
  teste: { skip: (condicao: boolean, motivo: string) => void },
) {
  let resumo = await request.get(urlCaixa());
  if (resumo.status() === 404) {
    await criar(request, '/api/financeiro/v1/caixas', { saldoInicial: 100 });
    resumo = await request.get(urlCaixa());
  }
  const dados = (await resumo.json()) as { caixa: { status: string } };
  teste.skip(dados.caixa.status !== 'ABERTO', 'caixa de hoje já fechado: rode em base limpa');
}
