import { avisoFechadoPeloSistema } from './aviso-fechado-pelo-sistema';

describe('avisoFechadoPeloSistema', () => {
  it('lista vazia não tem aviso', () => {
    expect(avisoFechadoPeloSistema([])).toBeNull();
  });

  it('um caixa: texto com dd/mm e link para o detalhe', () => {
    expect(avisoFechadoPeloSistema([{ id: 'cx-1', data: '2026-11-15' }])).toEqual({
      texto: 'Caixa de 15/11 fechado pelo sistema à meia-noite. Diárias pendentes.',
      rota: '/financeiro/caixas/cx-1',
    });
  });

  it('vários caixas: texto com a quantidade e link para a lista', () => {
    const aviso = avisoFechadoPeloSistema([
      { id: 'cx-1', data: '2026-11-14' },
      { id: 'cx-2', data: '2026-11-15' },
    ]);
    expect(aviso?.texto).toContain('2 caixas');
    expect(aviso?.rota).toBe('/financeiro/caixas');
  });
});
