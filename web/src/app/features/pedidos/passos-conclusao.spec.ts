import { marcaResp, produtoResp } from '../../core/api/testing';
import { vasilhameNovo } from '../vendas/carrinho';
import { itemCarrinho } from '../vendas/testing';
import {
  BloqueiosConclusao,
  ROTULO_PASSO_CONCLUSAO,
  passosDaConclusao,
  podeAvancarConclusao,
} from './passos-conclusao';

const retornavel = itemCarrinho({
  produto: produtoResp({
    tipo: 'RETORNAVEL',
    marcas: [marcaResp({ tipoCascoResolvidoId: 't-1' })],
  }),
});
const descartavel = itemCarrinho({ produto: produtoResp({ tipo: 'DESCARTAVEL' }) });

describe('passosDaConclusao', () => {
  it('sem casco: itens, perdas e pagamento', () => {
    expect(passosDaConclusao([descartavel], [])).toEqual(['itens', 'perdas', 'pagamento']);
  });

  it('com casco: itens, cascos, perdas e pagamento (o Confirmar fica no último)', () => {
    expect(passosDaConclusao([retornavel], [])).toEqual(['itens', 'cascos', 'perdas', 'pagamento']);
  });

  it('só com vasilhame comprado também tem o passo de cascos', () => {
    const tipo = {
      id: 't-1',
      nome: 'Casco',
      marcaId: null,
      marca: null,
      precoVasilhame: 30,
      aceitaSucata: true,
    };
    expect(passosDaConclusao([], [vasilhameNovo(tipo, 1)])).toEqual([
      'itens',
      'cascos',
      'perdas',
      'pagamento',
    ]);
  });

  it('rótulos: os da venda mais Perdas e quebras', () => {
    expect(ROTULO_PASSO_CONCLUSAO).toEqual({
      itens: 'Cliente e produtos',
      cascos: 'Cascos',
      perdas: 'Perdas e quebras',
      pagamento: 'Pagamento',
    });
  });
});

describe('podeAvancarConclusao', () => {
  const ok: BloqueiosConclusao = {
    carrinhoVazio: false,
    sucataExcede: false,
    itemForaDoCatalogo: false,
    perdasProntas: true,
  };

  it('tudo liberado avança em todos os passos', () => {
    for (const passo of ['itens', 'cascos', 'perdas', 'pagamento'] as const) {
      expect(podeAvancarConclusao(passo, ok)).toBe(true);
    }
  });

  it('carrinho vazio bloqueia itens, perdas e pagamento (cascos não olha o carrinho)', () => {
    const b = { ...ok, carrinhoVazio: true };
    expect(podeAvancarConclusao('itens', b)).toBe(false);
    expect(podeAvancarConclusao('perdas', b)).toBe(false);
    expect(podeAvancarConclusao('pagamento', b)).toBe(false);
    expect(podeAvancarConclusao('cascos', b)).toBe(true);
  });

  it('sucata acima do total bloqueia cascos, perdas e pagamento, mas não itens', () => {
    const b = { ...ok, sucataExcede: true };
    expect(podeAvancarConclusao('itens', b)).toBe(true);
    expect(podeAvancarConclusao('cascos', b)).toBe(false);
    expect(podeAvancarConclusao('perdas', b)).toBe(false);
    expect(podeAvancarConclusao('pagamento', b)).toBe(false);
  });

  it('perdas não prontas (ocorrência incompleta ou pedido sem funcionário) bloqueiam perdas e pagamento', () => {
    const b = { ...ok, perdasProntas: false };
    expect(podeAvancarConclusao('itens', b)).toBe(true);
    expect(podeAvancarConclusao('cascos', b)).toBe(true);
    expect(podeAvancarConclusao('perdas', b)).toBe(false);
    expect(podeAvancarConclusao('pagamento', b)).toBe(false);
  });

  it('item fora do catálogo bloqueia todos os passos', () => {
    const b = { ...ok, itemForaDoCatalogo: true };
    for (const passo of ['itens', 'cascos', 'perdas', 'pagamento'] as const) {
      expect(podeAvancarConclusao(passo, b)).toBe(false);
    }
  });
});
