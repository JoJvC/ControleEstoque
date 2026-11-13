import { MSG_PERIODO_INVERTIDO, periodoInvertido, periodoPadrao } from './periodo';

describe('periodoPadrao', () => {
  it('meio do mês: dia 1 até hoje', () => {
    expect(periodoPadrao(new Date(2026, 10, 13, 9, 0))).toEqual({
      inicio: '2026-11-01',
      fim: '2026-11-13',
    });
  });

  it('dia 1: início e fim iguais', () => {
    expect(periodoPadrao(new Date(2026, 10, 1, 8, 0))).toEqual({
      inicio: '2026-11-01',
      fim: '2026-11-01',
    });
  });

  it('virada de ano: 1º de janeiro e 31 de dezembro', () => {
    expect(periodoPadrao(new Date(2027, 0, 1, 10, 0))).toEqual({
      inicio: '2027-01-01',
      fim: '2027-01-01',
    });
    expect(periodoPadrao(new Date(2026, 11, 31, 10, 0))).toEqual({
      inicio: '2026-12-01',
      fim: '2026-12-31',
    });
  });

  it('perto da meia-noite usa a data local, sem deslocar para UTC', () => {
    // 23:59:59 local de 30/11 é 01/12 em UTC nos fusos a oeste de Greenwich;
    // 00:00:01 local de 01/12 é 30/11 em UTC nos fusos a leste.
    expect(periodoPadrao(new Date(2026, 10, 30, 23, 59, 59))).toEqual({
      inicio: '2026-11-01',
      fim: '2026-11-30',
    });
    expect(periodoPadrao(new Date(2026, 11, 1, 0, 0, 1))).toEqual({
      inicio: '2026-12-01',
      fim: '2026-12-01',
    });
  });
});

describe('periodoInvertido', () => {
  it('início depois do fim é inválido', () => {
    expect(periodoInvertido('2026-11-14', '2026-11-13')).toBe(true);
  });

  it('iguais, em ordem e vazios são válidos', () => {
    expect(periodoInvertido('2026-11-13', '2026-11-13')).toBe(false);
    expect(periodoInvertido('2026-11-01', '2026-11-13')).toBe(false);
    expect(periodoInvertido('', '2026-11-13')).toBe(false);
    expect(periodoInvertido('2026-11-14', '')).toBe(false);
  });

  it('a mensagem existe', () => {
    expect(MSG_PERIODO_INVERTIDO).toContain('data inicial');
  });
});
