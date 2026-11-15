import { LancamentoResponse } from '../../core/api/models/rh';
import { saldoPorLancamento, saldoPrevisto } from './conta-corrente-saldo';

const l = (id: string, tipo: LancamentoResponse['tipo'], valor: number, data: string) => ({
  id,
  tipo,
  valor,
  data,
  observacao: null,
});

describe('saldoPorLancamento', () => {
  it('lista vazia', () => {
    expect(saldoPorLancamento([], 300)).toEqual([]);
  });

  it('ordena por data desc e encadeia o saldo a partir da âncora', () => {
    const pagamento = l('p', 'PAGAMENTO', 100, '2026-11-10T09:00:00');
    const vale = l('v', 'VALE', 50, '2026-11-14T09:00:00');
    const linhas = saldoPorLancamento([pagamento, vale], 300);
    expect(linhas.map((x) => x.lancamento.id)).toEqual(['v', 'p']);
    expect(linhas.map((x) => x.delta)).toEqual([-50, -100]);
    expect(linhas.map((x) => x.saldoApos)).toEqual([300, 350]);
  });

  it('diária soma, vale e pagamento subtraem', () => {
    const linhas = saldoPorLancamento(
      [
        l('d', 'DIARIA', 100, '2026-11-01T00:00:00'),
        l('v', 'VALE', 30, '2026-11-02T00:00:00'),
        l('p', 'PAGAMENTO', 20, '2026-11-03T00:00:00'),
      ],
      50,
    );
    expect(linhas.map((x) => x.delta)).toEqual([-20, -30, 100]);
    expect(linhas.map((x) => x.saldoApos)).toEqual([50, 70, 100]);
  });

  it('não altera o array recebido', () => {
    const a = [l('a', 'VALE', 1, '2026-11-01T00:00:00'), l('b', 'VALE', 1, '2026-11-02T00:00:00')];
    saldoPorLancamento(a, 0);
    expect(a.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('saldoPrevisto', () => {
  it('vale de 50 sobre 300 → 250', () => {
    expect(saldoPrevisto(300, 'VALE', 50)).toBe(250);
  });
  it('pagamento subtrai, diária soma', () => {
    expect(saldoPrevisto(300, 'PAGAMENTO', 100)).toBe(200);
    expect(saldoPrevisto(300, 'DIARIA', 100)).toBe(400);
  });
});
