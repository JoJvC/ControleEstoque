import { ProdutoResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { marcaResp, produtoResp } from '../../core/api/testing';
import {
  ItemCarrinho,
  brutoDe,
  cascosNaRua,
  rotuloCascoNaRua,
  categoriaDoProduto,
  categoriasDe,
  filtrarPorCategoria,
  itemNovo,
  mesmoItem,
  valorDoAtalho,
  fiadoDe,
  itensDaUltimaVenda,
  situacaoPagamento,
  saldoAPagar,
  excedeSaldo,
  paraCreateVendaRequest,
  rascunhoDeVenda,
  totaisDe,
  totalPagoDe,
  totalVasilhameDe,
  totalVasilhamesDe,
  vasilhameNovo,
} from './carrinho';
import { itemCarrinho } from './testing';

const TIPO_T: TipoCascoResponse = {
  id: 't-1',
  nome: 'Casco 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 30,
  aceitaSucata: true,
};
const TIPOS = [TIPO_T];

/** Produto com uma marca; `casco` é o tipo de casco resolvido da marca (null = sem casco). */
function produto(
  tipo: ProdutoResponse['tipo'],
  id = 'p-1',
  casco: string | null = tipo === 'RETORNAVEL' ? 't-1' : null,
): ProdutoResponse {
  return produtoResp({
    id,
    tipo,
    marcas: [marcaResp({ tipoCascoResolvidoId: casco })],
  });
}

function item(
  quantidade: number,
  precoUnitario: number,
  desconto: ItemCarrinho['desconto'] = null,
  tipo: ProdutoResponse['tipo'] = 'RETORNAVEL',
  extra: Partial<ItemCarrinho> = {},
): ItemCarrinho {
  return itemCarrinho({ produto: produto(tipo), quantidade, precoUnitario, desconto, ...extra });
}

describe('totaisDe', () => {
  it('sem desconto: bruto = líquido', () => {
    expect(totaisDe([item(5, 50)])).toEqual({ bruto: 250, desconto: 0, liquido: 250 });
  });

  it('desconto em valor e em percentual ficam separados do bruto', () => {
    const itens = [
      item(2, 10, { tipo: 'VALOR', valor: 5, motivo: 'cliente antigo' }),
      item(4, 10, { tipo: 'PERCENTUAL', valor: 25, motivo: 'promoção' }),
    ];
    expect(totaisDe(itens)).toEqual({ bruto: 60, desconto: 15, liquido: 45 });
  });

  it('carrinho vazio zera tudo', () => {
    expect(totaisDe([])).toEqual({ bruto: 0, desconto: 0, liquido: 0 });
  });

  it('vasilhames cobrados entram no bruto sem desconto de item; sucata entra no desconto', () => {
    const i = item(2, 10, { tipo: 'PERCENTUAL', valor: 10, motivo: 'm' });
    expect(brutoDe(i)).toBe(20);
    expect(totaisDe([i], 60, 5)).toEqual({ bruto: 80, desconto: 7, liquido: 73 });
  });
});

describe('vasilhames', () => {
  const v = (quantidade: number, modo: 'ABATER_CREDITO' | 'COMPRAR' = 'ABATER_CREDITO') => ({
    ...vasilhameNovo(TIPO_T, quantidade),
    modo,
  });

  it('vasilhame novo: preço do tipo e modo Abater do crédito', () => {
    expect(vasilhameNovo(TIPO_T, 2)).toEqual({
      tipoCascoId: 't-1',
      quantidade: 2,
      precoUnitario: 30,
      modo: 'ABATER_CREDITO',
    });
  });

  it('sem crédito cobra tudo: 2 × 30 = 60', () => {
    expect(totalVasilhameDe(v(2), 0)).toBe(60);
  });

  it('crédito 2, qtd 3: Abater cobra 1 (30,00); Comprar cobra 3 (90,00)', () => {
    expect(totalVasilhameDe(v(3), 2)).toBe(30);
    expect(totalVasilhameDe(v(3, 'COMPRAR'), 2)).toBe(90);
  });

  it('crédito maior que a quantidade abate tudo', () => {
    expect(totalVasilhameDe(v(2), 5)).toBe(0);
  });

  it('total geral soma por tipo com o crédito de cada um', () => {
    const outro = { ...v(1), tipoCascoId: 't-2', precoUnitario: 10 };
    expect(totalVasilhamesDe([v(3), outro], { 't-1': 2 })).toBe(40);
  });
});

describe('itemNovo / mesmoItem', () => {
  const agua = produto('RETORNAVEL', 'p-agua');
  const outra = { ...agua, marcas: [marcaResp({ marcaId: 'm-2', tipoCascoResolvidoId: 't-1' })] };

  it('linha nova: preço sugerido da marca', () => {
    expect(itemNovo(agua, agua.marcas[0], 3)).toEqual({
      produto: agua,
      marca: agua.marcas[0],
      quantidade: 3,
      precoUnitario: 50,
      desconto: null,
    });
  });

  it('a identidade do item é produto+marca', () => {
    const i = itemNovo(agua, agua.marcas[0], 1);
    expect(mesmoItem(i, agua, agua.marcas[0])).toBe(true);
    expect(mesmoItem(i, agua, outra.marcas[0])).toBe(false);
  });
});

describe('pagamentos', () => {
  const pix = (valor: number | null) => ({ forma: 'PIX', valor });

  it('soma ignorando linhas sem valor', () => {
    expect(totalPagoDe([pix(0.1), pix(0.2), pix(null)])).toBe(0.3);
  });

  it('fiado = líquido − pago, nunca negativo', () => {
    expect(fiadoDe(250, [pix(200)])).toBe(50);
    expect(fiadoDe(250, [])).toBe(250);
    expect(fiadoDe(250, [pix(300)])).toBe(0);
  });

  it('saldoAPagar: sem pagamento, parcial, quitado e soma de centavos', () => {
    expect(saldoAPagar(100, [])).toBe(100);
    expect(saldoAPagar(100, [{ valor: 30 }])).toBe(70);
    expect(saldoAPagar(100, [{ valor: 100 }])).toBe(0);
    expect(saldoAPagar(100, [{ valor: 120 }])).toBe(0);
    expect(saldoAPagar(0.3, [{ valor: 0.1 }, { valor: 0.2 }])).toBe(0);
    expect(saldoAPagar(1, [{ valor: 0.1 }, { valor: 0.2 }])).toBe(0.7);
  });

  it('excedeSaldo: igual ao saldo não excede; 1 centavo acima excede', () => {
    expect(excedeSaldo(70, 70)).toBe(false);
    expect(excedeSaldo(70, 70.01)).toBe(true);
    expect(excedeSaldo(0.3, 0.1 + 0.2)).toBe(false);
  });

  it('situacaoPagamento: fiado, pago, crédito e líquido 0', () => {
    expect(situacaoPagamento(250, [pix(100)])).toEqual({ tipo: 'fiado', valor: 150 });
    expect(situacaoPagamento(250, [pix(250)])).toEqual({ tipo: 'pago', valor: 0 });
    expect(situacaoPagamento(50, [pix(60)])).toEqual({ tipo: 'credito', valor: 10 });
    expect(situacaoPagamento(250, [pix(100), pix(151)])).toEqual({ tipo: 'credito', valor: 1 });
    expect(situacaoPagamento(0, [])).toEqual({ tipo: 'pago', valor: 0 });
  });
});

describe('paraCreateVendaRequest', () => {
  const base = {
    clienteId: 'c-1',
    funcionarioId: 'f-1',
    enderecoEntregaId: 'e-1',
    cascosDevolvidos: { 't-1': 3 },
    cascosNaHora: false,
    sucataEntregue: { 't-1': 1 },
    vasilhames: [],
    sucataValores: { 't-1': 5 },
  };

  it('Exemplo da F5: 5 Água de T, devolução 3, sucata 1 e PIX 200 → listas por tipo e total 250', () => {
    const itens = [item(5, 50)];
    const request = paraCreateVendaRequest(
      { ...base, itens, pagamentos: [{ forma: 'PIX', valor: 200 }] },
      TIPOS,
    );
    expect(request).toEqual({
      clienteId: 'c-1',
      funcionarioId: 'f-1',
      enderecoEntregaId: 'e-1',
      itens: [
        {
          produtoId: 'p-1',
          marcaId: 'm-1',
          quantidade: 5,
          precoUnitario: 50,
          desconto: null,
        },
      ],
      vasilhames: [],
      pagamentos: [{ forma: 'PIX', valor: 200 }],
      cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 3 }],
      sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 5 }],
      observacao: null,
    });
    expect(totaisDe(itens).liquido).toBe(250);
  });

  it('pagamentos sem valor ou zerados ficam de fora; o desconto vai no item', () => {
    const request = paraCreateVendaRequest(
      {
        ...base,
        itens: [item(5, 50, { tipo: 'VALOR', valor: 10, motivo: 'm' })],
        pagamentos: [
          { forma: 'PIX', valor: 200 },
          { forma: 'DINHEIRO', valor: null },
          { forma: 'OUTRO', valor: 0 },
        ],
      },
      TIPOS,
    );
    expect(request.pagamentos).toEqual([{ forma: 'PIX', valor: 200 }]);
    expect(request.itens[0].desconto).toEqual({ tipo: 'VALOR', valor: 10, motivo: 'm' });
    expect(Object.keys(request.itens[0]).join()).not.toMatch(/vasilhame/i);
  });

  it('vasilhames vão com tipo, quantidade, preço e modoCredito; quantidade 0 não vai', () => {
    const request = paraCreateVendaRequest(
      {
        ...base,
        itens: [item(5, 50)],
        pagamentos: [],
        vasilhames: [
          { ...vasilhameNovo(TIPO_T, 2), modo: 'COMPRAR' },
          { ...vasilhameNovo(TIPO_T, 0), tipoCascoId: 't-9' },
        ],
      },
      TIPOS,
    );
    expect(request.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 2, precoUnitario: 30, modoCredito: 'COMPRAR' },
    ]);
  });

  it('sucata sem valor digitado vai com valorUnitario 0', () => {
    const request = paraCreateVendaRequest(
      { ...base, itens: [item(5, 50)], pagamentos: [], sucataValores: {} },
      TIPOS,
    );
    expect(request.sucataEntregue).toEqual([
      { tipoCascoId: 't-1', quantidade: 1, valorUnitario: 0 },
    ]);
  });

  it('só descartável no carrinho: listas de casco e sucata vazias', () => {
    const request = paraCreateVendaRequest(
      { ...base, itens: [item(1, 5, null, 'DESCARTAVEL')], pagamentos: [] },
      TIPOS,
    );
    expect(request.cascosDevolvidos).toEqual([]);
    expect(request.sucataEntregue).toEqual([]);
  });

  it('com "na hora" a devolução é o vendido em troca, ignorando o digitado', () => {
    const request = paraCreateVendaRequest(
      { ...base, itens: [item(5, 50)], pagamentos: [], cascosNaHora: true },
      TIPOS,
    );
    expect(request.cascosDevolvidos).toEqual([{ tipoCascoId: 't-1', quantidade: 5 }]);
  });
});

describe('rascunhoDeVenda', () => {
  const agua = produto('RETORNAVEL', 'p-agua');
  const carvao = produto('DESCARTAVEL', 'p-carvao');
  const mapa = new Map([
    [agua.id, agua],
    [carvao.id, carvao],
  ]);
  const venda: VendaDetalheResponse = {
    id: 'v-1',
    clienteId: 'c-1',
    funcionarioId: 'f-orig',
    enderecoEntregaId: 'e-1',
    data: '2026-01-02T10:00:00',
    totalBruto: 100,
    totalDesconto: 5,
    totalLiquido: 95,
    statusPagamento: 'PARCIAL',
    observacao: null,
    cupomEmitido: false,
    cupomNumero: null,
    cupomEmitidoEm: null,
    itens: [
      {
        produtoId: 'p-agua',
        marcaId: 'm-1',
        tipoCascoId: 't-1',
        quantidade: 1,
        precoUnitario: 50,
        descontoTipo: null,
        descontoValor: null,
        motivoDesconto: null,
        totalItem: 80,
      },
      {
        produtoId: 'p-carvao',
        marcaId: 'm-1',
        tipoCascoId: null,
        quantidade: 1,
        precoUnitario: 50,
        descontoTipo: 'PERCENTUAL',
        descontoValor: 10,
        motivoDesconto: null,
        totalItem: 45,
      },
    ],
    pagamentos: [
      { forma: 'DINHEIRO', valor: 30 },
      { forma: 'PIX', valor: 20 },
    ],
    vasilhames: [
      {
        tipoCascoId: 't-1',
        quantidade: 3,
        quantidadeAbatida: 2,
        precoUnitario: 30,
        modo: 'ABATER_CREDITO',
        total: 30,
      },
    ],
    cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 2 }],
    sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 5 }],
  };

  it('reconstrói a marca; desconto com motivo null vira vazio', () => {
    const { itens } = rascunhoDeVenda(venda, mapa);
    expect(itens[0]).toEqual({
      produto: agua,
      marca: agua.marcas[0],
      quantidade: 1,
      precoUnitario: 50,
      desconto: null,
    });
    expect(itens[1]).toEqual({
      produto: carvao,
      marca: carvao.marcas[0],
      quantidade: 1,
      precoUnitario: 50,
      desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
    });
  });

  it('pagamentos, cascos e sucata por tipo, vendedor e endereço vêm da venda; na hora é false', () => {
    const r = rascunhoDeVenda(venda, mapa);
    expect(r.pagamentos).toEqual([
      { forma: 'DINHEIRO', valor: 30 },
      { forma: 'PIX', valor: 20 },
    ]);
    expect(r.cascosDevolvidos).toEqual({ 't-1': 2 });
    expect(r.sucataEntregue).toEqual({ 't-1': 1 });
    expect(r.sucataValores).toEqual({ 't-1': 5 });
    expect(r.cascosNaHora).toBe(false);
    expect(r.funcionarioId).toBe('f-orig');
    expect(r.enderecoEntregaId).toBe('e-1');
    expect(r.clienteId).toBe('c-1');
  });

  it('vasilhames do detalhe voltam com tipo, quantidade, preço e modo; crédito é o abatido', () => {
    const r = rascunhoDeVenda(venda, mapa);
    expect(r.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 3, precoUnitario: 30, modo: 'ABATER_CREDITO' },
    ]);
    expect(r.creditoVasilhames).toEqual({ 't-1': 2 });
  });

  it('marca que não existe mais no produto falha em vez de montar item sem marca', () => {
    const semMarca = { ...venda, itens: [{ ...venda.itens[0], marcaId: 'm-sumiu' }] };
    expect(() => rascunhoDeVenda(semMarca, mapa)).toThrow();
  });

  it('ida e volta: paraCreateVendaRequest reproduz itens, pagamentos, cascos e sucata', () => {
    const req = paraCreateVendaRequest(rascunhoDeVenda(venda, mapa), TIPOS);
    expect(req.itens).toEqual([
      {
        produtoId: 'p-agua',
        marcaId: 'm-1',
        quantidade: 1,
        precoUnitario: 50,
        desconto: null,
      },
      {
        produtoId: 'p-carvao',
        marcaId: 'm-1',
        quantidade: 1,
        precoUnitario: 50,
        desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
      },
    ]);
    expect(req.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 3, precoUnitario: 30, modoCredito: 'ABATER_CREDITO' },
    ]);
    expect(req.pagamentos).toEqual(venda.pagamentos);
    expect(req.cascosDevolvidos).toEqual(venda.cascosDevolvidos);
    expect(req.sucataEntregue).toEqual(venda.sucataEntregue);
  });
});

describe('rotuloCascoNaRua', () => {
  it('singular, plural e devolução a mais', () => {
    expect(rotuloCascoNaRua(1, 0, 'Ana')).toBe('Fica 1 casco na rua com Ana');
    expect(rotuloCascoNaRua(2, 0, 'Ana')).toBe('Ficam 2 cascos na rua com Ana');
    expect(rotuloCascoNaRua(0, 0, 'Ana')).toBe('Ficam 0 cascos na rua com Ana');
    expect(rotuloCascoNaRua(0, 3, 'Ana')).toBe('Devolveu 3 a mais');
    expect(rotuloCascoNaRua(1, 0, null)).toBe('Fica 1 casco na rua');
    expect(rotuloCascoNaRua(2, 0, null)).toBe('Ficam 2 cascos na rua');
  });
});

describe('cascosNaRua', () => {
  it('água menos devolvidos, nunca negativo', () => {
    expect(cascosNaRua(5, 3)).toBe(2);
    expect(cascosNaRua(5, 5)).toBe(0);
    expect(cascosNaRua(2, 7)).toBe(0);
    expect(cascosNaRua(0, 0)).toBe(0);
  });
});

describe('valorDoAtalho', () => {
  const pagos = (...valores: (number | null)[]) =>
    valores.map((valor) => ({ forma: 'PIX', valor }));

  it('total 250 com 100 já pagos: Tudo 150, Metade 75', () => {
    expect(valorDoAtalho('tudo', 250, pagos(100))).toBe(150);
    expect(valorDoAtalho('metade', 250, pagos(100))).toBe(75);
  });

  it('sem pagamentos: Tudo é o total', () => {
    expect(valorDoAtalho('tudo', 250, [])).toBe(250);
  });

  it('Metade trunca no centavo', () => {
    expect(valorDoAtalho('metade', 0.05, [])).toBe(0.02);
    expect(valorDoAtalho('metade', 10.01, [])).toBe(5);
  });

  it('a própria linha não conta como já paga; restante nunca é negativo', () => {
    expect(valorDoAtalho('tudo', 250, pagos(100, 50), 1)).toBe(150);
    expect(valorDoAtalho('tudo', 100, pagos(150))).toBe(0);
    expect(valorDoAtalho('tudo', 100, pagos(null))).toBe(100);
  });
});

describe('categorias e filtro', () => {
  const com = (id: string, categoria: string | null) => ({
    ...produto('DESCARTAVEL', id),
    categoria,
  });
  const lista = [com('a', 'Gelo'), com('b', 'Copos'), com('c', 'Gelo'), com('d', null)];
  const linhas = lista.map((p) => ({ produto: p, marca: p.marcas[0] }));

  it('categoriaDoProduto: a categoria cadastrada, sem pílula "Água" para retornável', () => {
    const tipo = (t: ProdutoResponse['tipo'], categoria: string | null) => ({
      ...produto(t),
      categoria,
    });
    expect(categoriaDoProduto(tipo('RETORNAVEL', null))).toBeNull();
    expect(categoriaDoProduto(tipo('RETORNAVEL', 'Água'))).toBe('Água');
    expect(categoriaDoProduto(tipo('DESCARTAVEL', 'Gelo'))).toBe('Gelo');
    expect(categoriaDoProduto(tipo('DESCARTAVEL', null))).toBeNull();
  });

  it('categoriasDe: distintas, sem vazio, em ordem', () => {
    expect(categoriasDe(lista)).toEqual(['Copos', 'Gelo']);
    expect(categoriasDe([{ ...produto('RETORNAVEL', 'x'), categoria: null }])).toEqual([]);
  });

  it('filtrarPorCategoria: null é Todas', () => {
    expect(filtrarPorCategoria(linhas, null)).toHaveLength(4);
    expect(filtrarPorCategoria(linhas, 'Gelo').map((l) => l.produto.id)).toEqual(['a', 'c']);
    expect(filtrarPorCategoria(linhas, 'Inexistente')).toEqual([]);
  });
});

describe('itensDaUltimaVenda', () => {
  const agua = produtoResp({
    id: 'p-agua',
    marcas: [marcaResp({ precoReferencia: 14, tipoCascoResolvidoId: 't-1' })],
  });
  const gelo = produtoResp({
    id: 'p-gelo',
    tipo: 'DESCARTAVEL',
    marcas: [marcaResp({ precoReferencia: 8 })],
  });
  const catalogo = new Map([
    [agua.id, agua],
    [gelo.id, gelo],
  ]);
  const itemVenda = (
    produtoId: string,
    quantidade: number,
    precoUnitario: number,
    marcaId = 'm-1',
  ) => ({
    produtoId,
    marcaId,
    tipoCascoId: null,
    quantidade,
    precoUnitario,
    descontoTipo: 'PERCENTUAL' as const,
    descontoValor: 10,
    motivoDesconto: 'antigo',
    totalItem: 0,
  });
  const venda = (
    itens: VendaDetalheResponse['itens'],
    vasilhames: VendaDetalheResponse['vasilhames'] = [],
  ): VendaDetalheResponse => ({
    id: 'v-0',
    clienteId: 'c-1',
    funcionarioId: 'f-1',
    enderecoEntregaId: null,
    data: '2026-01-02T10:00:00',
    totalBruto: 0,
    totalDesconto: 0,
    totalLiquido: 0,
    statusPagamento: 'PAGA',
    observacao: null,
    cupomEmitido: false,
    cupomNumero: null,
    cupomEmitidoEm: null,
    itens,
    vasilhames,
    pagamentos: [{ forma: 'PIX', valor: 99 }],
    cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 3 }],
    sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 2, valorUnitario: 4 }],
  });

  it('converte produto e quantidade; desconto, pagamentos, cascos e sucata não são copiados', () => {
    const r = itensDaUltimaVenda(
      venda([itemVenda('p-agua', 2, 14), itemVenda('p-gelo', 1, 8)]),
      catalogo,
      TIPOS,
    );
    expect(r).toEqual({
      itens: [itemNovo(agua, agua.marcas[0], 2), itemNovo(gelo, gelo.marcas[0], 1)],
      vasilhames: [],
      pulados: 0,
    });
    expect(totaisDe(r.itens)).toEqual({ bruto: 36, desconto: 0, liquido: 36 });
  });

  it('o preço é o precoReferencia de hoje, não o da venda antiga', () => {
    const r = itensDaUltimaVenda(venda([itemVenda('p-agua', 1, 12)]), catalogo, TIPOS);
    expect(r.itens[0].precoUnitario).toBe(14);
  });

  it('produto fora do catálogo é pulado e contado', () => {
    const r = itensDaUltimaVenda(
      venda([itemVenda('p-agua', 2, 12), itemVenda('p-gas', 1, 90)]),
      catalogo,
      TIPOS,
    );
    expect(r.itens.map((i) => i.produto.id)).toEqual(['p-agua']);
    expect(r.pulados).toBe(1);
  });

  it('leva marcaId; linha cuja marca não existe mais é descartada', () => {
    const r = itensDaUltimaVenda(
      venda([itemVenda('p-agua', 2, 12, 'm-1'), itemVenda('p-gelo', 1, 8, 'm-sumiu')]),
      catalogo,
      TIPOS,
    );
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].marca.marcaId).toBe('m-1');
    expect(r.pulados).toBe(1);
  });

  it('copia os vasilhames com tipo, quantidade e preço da venda; o modo volta para Abater', () => {
    const r = itensDaUltimaVenda(
      venda(
        [],
        [
          {
            tipoCascoId: 't-1',
            quantidade: 2,
            quantidadeAbatida: 0,
            precoUnitario: 25,
            modo: 'COMPRAR',
            total: 50,
          },
          {
            tipoCascoId: 't-sumiu',
            quantidade: 1,
            quantidadeAbatida: 0,
            precoUnitario: 25,
            modo: 'COMPRAR',
            total: 25,
          },
        ],
      ),
      catalogo,
      TIPOS,
    );
    expect(r.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 2, precoUnitario: 25, modo: 'ABATER_CREDITO' },
    ]);
    expect(r.itens).toEqual([]);
    expect(r.pulados).toBe(1);
  });
});
