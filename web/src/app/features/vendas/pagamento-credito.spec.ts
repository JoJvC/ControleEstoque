import { FORMAS } from '../../ui/organisms/pagamento-lista';
import {
  creditoNaEdicao,
  formasDaVenda,
  limitarCredito,
  limitarPagamentos,
} from './pagamento-credito';

describe('limitarCredito', () => {
  it('abaixo do disponível: o digitado', () => {
    expect(limitarCredito(20, 30, 0)).toBe(20);
  });

  it('igual ao disponível: o digitado', () => {
    expect(limitarCredito(30, 30, 0)).toBe(30);
  });

  it('acima do disponível: o disponível (80 com crédito 30 fica 30)', () => {
    expect(limitarCredito(80, 30, 0)).toBe(30);
  });

  it('com crédito já usado em outra linha: só o que sobra', () => {
    expect(limitarCredito(25, 30, 10)).toBe(20);
    expect(limitarCredito(25, 30, 30)).toBe(0);
    expect(limitarCredito(25, 30, 35)).toBe(0);
  });
});

describe('formasDaVenda', () => {
  it('sem cliente (crédito null): só as formas comuns', () => {
    expect(formasDaVenda(null)).toEqual(FORMAS);
  });

  it('crédito 0: só as formas comuns', () => {
    expect(formasDaVenda(0)).toEqual(FORMAS);
  });

  it('crédito > 0: acrescenta "Crédito do cliente" sem mexer em FORMAS', () => {
    const formas = formasDaVenda(30);
    expect(formas.at(-1)).toEqual({ value: 'CREDITO_CLIENTE', label: 'Crédito do cliente' });
    expect(formas).toHaveLength(FORMAS.length + 1);
    expect(FORMAS.some((f) => f.value === 'CREDITO_CLIENTE')).toBe(false);
  });
});

describe('limitarPagamentos', () => {
  it('limita só a linha de crédito', () => {
    const linhas = [
      { forma: 'PIX', valor: 80 },
      { forma: 'CREDITO_CLIENTE', valor: 80 },
    ];
    expect(limitarPagamentos(linhas, 30)).toEqual([
      { forma: 'PIX', valor: 80 },
      { forma: 'CREDITO_CLIENTE', valor: 30 },
    ]);
  });

  it('sem crédito disponível (null ou 0) a linha de crédito sai; as outras ficam', () => {
    const linhas = [
      { forma: 'PIX', valor: 20 },
      { forma: 'CREDITO_CLIENTE', valor: 5 },
    ];
    expect(limitarPagamentos(linhas, null)).toEqual([{ forma: 'PIX', valor: 20 }]);
    expect(limitarPagamentos(linhas, 0)).toEqual([{ forma: 'PIX', valor: 20 }]);
  });

  it('linha de crédito sem valor digitado fica quando há crédito', () => {
    expect(limitarPagamentos([{ forma: 'CREDITO_CLIENTE', valor: null }], 30)[0].valor).toBeNull();
  });
});

describe('creditoNaEdicao', () => {
  it('crédito 100, venda 80 = 20 de crédito + 60 de fiado, saldo atual 20 → teto 100', () => {
    const venda = {
      totalLiquido: 80,
      pagamentos: [{ forma: 'CREDITO_CLIENTE', valor: 20 }],
    };
    expect(creditoNaEdicao(20, venda)).toBe(100);
  });

  it('venda paga em outra forma: o estorno é só o que gerou de fiado/crédito', () => {
    const venda = {
      totalLiquido: 80,
      pagamentos: [
        { forma: 'PIX', valor: 50 },
        { forma: 'CREDITO_CLIENTE', valor: 10 },
      ],
    };
    // 10 de crédito usado + 20 de fiado gerado = 30 de estorno
    expect(creditoNaEdicao(-5, venda)).toBe(25);
  });

  it('nunca negativo', () => {
    expect(creditoNaEdicao(-100, { totalLiquido: 10, pagamentos: [] })).toBe(0);
  });
});
