import { ProdutoResponse } from '../../core/api/models/estoque';
import {
  ItemCarrinho,
  fiadoDe,
  pagamentoExcede,
  paraCreateVendaRequest,
  quantidadeAgua,
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
