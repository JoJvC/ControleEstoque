import { EstoqueItemResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { VendaDetalheResponse } from '../../core/api/models/vendas';
import {
  ItemCarrinho,
  cascosNaRua,
  rotuloCascoNaRua,
  categoriaDoProduto,
  categoriasDe,
  filtrarPorCategoria,
  produtosComEstoque,
  valorDoAtalho,
  fiadoDe,
  itensDaUltimaVenda,
  pagamentoExcede,
  saldoAPagar,
  excedeSaldo,
  paraCreateVendaRequest,
  quantidadeAgua,
  rascunhoDeVenda,
  temAgua,
  totaisDe,
  totalPagoDe,
} from './carrinho';

function produto(tipo: ProdutoResponse['tipo'], id = 'p-1'): ProdutoResponse {
  return {
    id,
    tipo,
    nome: 'Produto',
    marcaId: null,
    marca: null,
    categoria: null,
    tamanho: null,
    fotoUrl: null,
    precoReferencia: 50,
    estoqueMinimo: 0,
  };
}

function item(
  quantidade: number,
  precoUnitario: number,
  desconto: ItemCarrinho['desconto'] = null,
  tipo: ProdutoResponse['tipo'] = 'AGUA',
): ItemCarrinho {
  return { produto: produto(tipo), quantidade, precoUnitario, desconto };
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

  it('pagamentoExcede só quando pago > líquido', () => {
    expect(pagamentoExcede(250, [pix(250)])).toBe(false);
    expect(pagamentoExcede(250, [pix(250.01)])).toBe(true);
    expect(pagamentoExcede(250, [pix(100), pix(151)])).toBe(true);
  });
});

describe('temAgua / quantidadeAgua', () => {
  it('detecta item de ÁGUA e soma só a quantidade de água', () => {
    const itens = [item(2, 5, null, 'DESCARTAVEL'), item(3, 50), item(2, 50)];
    expect(temAgua(itens)).toBe(true);
    expect(quantidadeAgua(itens)).toBe(5);
  });

  it('sem ÁGUA', () => {
    expect(temAgua([item(1, 5, null, 'DESCARTAVEL')])).toBe(false);
    expect(temAgua([])).toBe(false);
  });
});

describe('paraCreateVendaRequest', () => {
  const base = {
    clienteId: 'c-1',
    funcionarioId: 'f-1',
    enderecoEntregaId: 'e-1',
    cascosDevolvidos: 3,
    cascosDevolvidosNaHora: true,
    sucataEntregue: 1,
  };

  it('monta o corpo com itens, pagamentos válidos e cascos', () => {
    const request = paraCreateVendaRequest({
      ...base,
      itens: [item(5, 50, { tipo: 'VALOR', valor: 10, motivo: 'm' })],
      pagamentos: [
        { forma: 'PIX', valor: 200 },
        { forma: 'DINHEIRO', valor: null },
        { forma: 'OUTRO', valor: 0 },
      ],
    });
    expect(request).toEqual({
      clienteId: 'c-1',
      funcionarioId: 'f-1',
      enderecoEntregaId: 'e-1',
      itens: [
        {
          produtoId: 'p-1',
          quantidade: 5,
          precoUnitario: 50,
          desconto: { tipo: 'VALOR', valor: 10, motivo: 'm' },
        },
      ],
      pagamentos: [{ forma: 'PIX', valor: 200 }],
      cascosDevolvidos: 3,
      cascosDevolvidosNaHora: true,
      sucataEntregue: 1,
      observacao: null,
    });
  });

  it('sem ÁGUA, casco e sucata vão zerados', () => {
    const request = paraCreateVendaRequest({
      ...base,
      itens: [item(1, 5, null, 'DESCARTAVEL')],
      pagamentos: [],
    });
    expect(request.cascosDevolvidos).toBe(0);
    expect(request.cascosDevolvidosNaHora).toBe(false);
    expect(request.sucataEntregue).toBe(0);
  });
});

describe('rascunhoDeVenda', () => {
  const agua = produto('AGUA', 'p-agua');
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
        quantidade: 1,
        precoUnitario: 50,
        descontoTipo: null,
        descontoValor: null,
        motivoDesconto: null,
        totalItem: 50,
      },
      {
        produtoId: 'p-carvao',
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
    cascosDevolvidos: 2,
    sucataEntregue: 1,
  };

  it('item sem desconto e item com desconto (motivo null vira vazio)', () => {
    const { itens } = rascunhoDeVenda(venda, mapa);
    expect(itens[0]).toEqual({ produto: agua, quantidade: 1, precoUnitario: 50, desconto: null });
    expect(itens[1]).toEqual({
      produto: carvao,
      quantidade: 1,
      precoUnitario: 50,
      desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
    });
  });

  it('pagamentos, cascos, sucata, vendedor e endereço vêm da venda; na hora é false', () => {
    const r = rascunhoDeVenda(venda, mapa);
    expect(r.pagamentos).toEqual([
      { forma: 'DINHEIRO', valor: 30 },
      { forma: 'PIX', valor: 20 },
    ]);
    expect(r.cascosDevolvidos).toBe(2);
    expect(r.sucataEntregue).toBe(1);
    expect(r.cascosDevolvidosNaHora).toBe(false);
    expect(r.funcionarioId).toBe('f-orig');
    expect(r.enderecoEntregaId).toBe('e-1');
    expect(r.clienteId).toBe('c-1');
  });

  it('ida e volta: paraCreateVendaRequest reproduz itens, pagamentos, cascos e sucata', () => {
    const req = paraCreateVendaRequest(rascunhoDeVenda(venda, mapa));
    expect(req.itens).toEqual([
      { produtoId: 'p-agua', quantidade: 1, precoUnitario: 50, desconto: null },
      {
        produtoId: 'p-carvao',
        quantidade: 1,
        precoUnitario: 50,
        desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
      },
    ]);
    expect(req.pagamentos).toEqual(venda.pagamentos);
    expect(req.cascosDevolvidos).toBe(2);
    expect(req.sucataEntregue).toBe(1);
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

  it('categoriaDoProduto: Água para AGUA e GALAO_COMPLETO; categoria só em DESCARTAVEL; resto sem pílula', () => {
    const tipo = (t: ProdutoResponse['tipo'], categoria: string | null) => ({
      ...produto(t),
      categoria,
    });
    expect(categoriaDoProduto(tipo('AGUA', null))).toBe('Água');
    expect(categoriaDoProduto(tipo('AGUA', 'Outra'))).toBe('Água');
    expect(categoriaDoProduto(tipo('GALAO_COMPLETO', null))).toBe('Água');
    expect(categoriaDoProduto(tipo('DESCARTAVEL', 'Gelo'))).toBe('Gelo');
    expect(categoriaDoProduto(tipo('DESCARTAVEL', null))).toBeNull();
    expect(categoriaDoProduto(tipo('CASCO', 'Gelo'))).toBeNull();
    expect(categoriaDoProduto(tipo('SUCATA', 'Gelo'))).toBeNull();
  });

  it('água sem categoria ganha a pílula Água e é filtrada por ela', () => {
    const mix = [
      { ...produto('AGUA', 'x'), categoria: null },
      { ...produto('GALAO_COMPLETO', 'y'), categoria: null },
      { ...produto('CASCO', 'z'), categoria: 'Gelo' },
      com('g', 'Gelo'),
    ];
    expect(categoriasDe(mix)).toEqual(['Água', 'Gelo']);
    expect(filtrarPorCategoria(mix, 'Água').map((p) => p.id)).toEqual(['x', 'y']);
    expect(filtrarPorCategoria(mix, 'Gelo').map((p) => p.id)).toEqual(['g']);
    expect(filtrarPorCategoria(mix, null)).toHaveLength(4);
  });

  it('categoriasDe: distintas, sem vazio, em ordem', () => {
    expect(categoriasDe(lista)).toEqual(['Copos', 'Gelo']);
  });

  it('filtrarPorCategoria: null é Todas', () => {
    expect(filtrarPorCategoria(lista, null)).toHaveLength(4);
    expect(filtrarPorCategoria(lista, 'Gelo').map((p) => p.id)).toEqual(['a', 'c']);
    expect(filtrarPorCategoria(lista, 'Inexistente')).toEqual([]);
  });
});

describe('produtosComEstoque', () => {
  it('cruza pelo produtoId; ausente vira null', () => {
    const estoque = [{ produtoId: 'p-1', quantidade: 12 }] as EstoqueItemResponse[];
    const r = produtosComEstoque([produto('AGUA', 'p-1'), produto('AGUA', 'p-2')], estoque);
    expect(r.map((x) => x.estoque)).toEqual([12, null]);
    expect(produtosComEstoque([produto('AGUA', 'p-1')], [])[0].estoque).toBeNull();
  });
});

describe('itensDaUltimaVenda', () => {
  const agua = { ...produto('AGUA', 'p-agua'), precoReferencia: 14 };
  const gelo = { ...produto('DESCARTAVEL', 'p-gelo'), precoReferencia: 8 };
  const catalogo = new Map([
    [agua.id, agua],
    [gelo.id, gelo],
  ]);
  const itemVenda = (produtoId: string, quantidade: number, precoUnitario: number) => ({
    produtoId,
    quantidade,
    precoUnitario,
    descontoTipo: 'PERCENTUAL' as const,
    descontoValor: 10,
    motivoDesconto: 'antigo',
    totalItem: 0,
  });
  const venda = (itens: VendaDetalheResponse['itens']): VendaDetalheResponse => ({
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
    pagamentos: [{ forma: 'PIX', valor: 99 }],
    cascosDevolvidos: 3,
    sucataEntregue: 2,
  });

  it('converte produto e quantidade; desconto, pagamentos, cascos e sucata não são copiados', () => {
    const r = itensDaUltimaVenda(
      venda([itemVenda('p-agua', 2, 14), itemVenda('p-gelo', 1, 8)]),
      catalogo,
    );
    expect(r).toEqual({
      itens: [
        { produto: agua, quantidade: 2, precoUnitario: 14, desconto: null },
        { produto: gelo, quantidade: 1, precoUnitario: 8, desconto: null },
      ],
      pulados: 0,
    });
    expect(totaisDe(r.itens)).toEqual({ bruto: 36, desconto: 0, liquido: 36 });
  });

  it('o preço é o precoReferencia de hoje, não o da venda antiga', () => {
    const r = itensDaUltimaVenda(venda([itemVenda('p-agua', 1, 12)]), catalogo);
    expect(r.itens[0].precoUnitario).toBe(14);
  });

  it('produto fora do catálogo é pulado e contado', () => {
    const r = itensDaUltimaVenda(
      venda([itemVenda('p-agua', 2, 12), itemVenda('p-gas', 1, 90)]),
      catalogo,
    );
    expect(r.itens.map((i) => i.produto.id)).toEqual(['p-agua']);
    expect(r.pulados).toBe(1);
  });
});
