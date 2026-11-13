import { rotuloCliente, rotuloForma, rotuloProduto, rotuloStatusPagamento } from './venda-rotulos';

describe('rotuloCliente', () => {
  it('ok devolve o nome', () => {
    expect(rotuloCliente({ estado: 'ok', nome: 'Maria' })).toBe('Maria');
  });

  it('carregando devolve o placeholder', () => {
    expect(rotuloCliente({ estado: 'carregando' })).toBe('Carregando cliente…');
  });

  it('undefined devolve o placeholder', () => {
    expect(rotuloCliente(undefined)).toBe('Carregando cliente…');
  });

  it('removido devolve "Cliente removido"', () => {
    expect(rotuloCliente({ estado: 'removido' })).toBe('Cliente removido');
  });
});

describe('rotuloProduto', () => {
  it('ok devolve o nome', () => {
    expect(rotuloProduto({ estado: 'ok', nome: 'Água 20L' })).toBe('Água 20L');
  });

  it('carregando e undefined devolvem o placeholder', () => {
    expect(rotuloProduto({ estado: 'carregando' })).toBe('Carregando produto…');
    expect(rotuloProduto(undefined)).toBe('Carregando produto…');
  });

  it('removido devolve "Produto removido"', () => {
    expect(rotuloProduto({ estado: 'removido' })).toBe('Produto removido');
  });
});

describe('rotuloStatusPagamento / rotuloForma', () => {
  it('traduz status', () => {
    expect(rotuloStatusPagamento('PENDENTE')).toBe('Pendente');
    expect(rotuloStatusPagamento('PARCIAL')).toBe('Parcial');
    expect(rotuloStatusPagamento('PAGA')).toBe('Paga');
  });

  it('traduz forma de pagamento', () => {
    expect(rotuloForma('CARTAO_CREDITO')).toBe('Cartão de crédito');
    expect(rotuloForma('PIX')).toBe('PIX');
  });
});
