import { TestBed } from '@angular/core/testing';

import { dataExtenso, HojeHero, modeloHero, saudacao } from './hoje-hero';

const REL = {
  totalBruto: 0,
  totalDesconto: 0,
  totalLiquido: 1234.5,
  recebido: 90,
  fiadoGerado: 40,
  porProduto: [],
  porDia: [],
  porCategoria: [
    { categoria: 'GELO', quantidade: 12, totalLiquido: 120 },
    { categoria: 'CARVAO', quantidade: 3, totalLiquido: 60 },
    { categoria: 'XYZ', quantidade: 1, totalLiquido: 5 },
  ],
};

describe('modeloHero', () => {
  it('copia o total do servidor e mapeia ícones, com fallback caixa', () => {
    const m = modeloHero(REL);
    expect(m.total).toBe(1234.5);
    expect([m.recebido, m.fiadoGerado]).toEqual([90, 40]);
    expect(m.linhas.map((l) => [l.categoria, l.quantidade, l.icone])).toEqual([
      ['GELO', 12, 'gelo'],
      ['CARVAO', 3, 'carvao'],
      ['XYZ', 1, 'caixa'],
    ]);
  });
});

describe('HojeHero', () => {
  it('mostra valor formatado e uma linha por categoria', () => {
    const f = TestBed.createComponent(HojeHero);
    f.componentRef.setInput('modelo', modeloHero(REL));
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('R$ 1.234,50');
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('Recebido R$ 90,00');
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('Fiado gerado R$ 40,00');
    expect(el.querySelectorAll('.hero__saida').length).toBe(3);
    expect(el.querySelector('.hero__saida')?.textContent).toContain('GELO');
  });

  it('carregando e erro', () => {
    const f = TestBed.createComponent(HojeHero);
    f.componentRef.setInput('status', 'loading');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('ce-skeleton')).not.toBeNull();
    f.componentRef.setInput('status', 'error');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Não foi possível');
  });
});

describe('saudacao e dataExtenso', () => {
  it('saudação por faixa de hora', () => {
    expect([
      saudacao(0),
      saudacao(5),
      saudacao(6),
      saudacao(11),
      saudacao(12),
      saudacao(17),
      saudacao(18),
      saudacao(23),
    ]).toEqual([
      'boa noite',
      'boa noite',
      'bom dia',
      'bom dia',
      'boa tarde',
      'boa tarde',
      'boa noite',
      'boa noite',
    ]);
  });

  it('data por extenso em pt-BR', () => {
    expect(dataExtenso(new Date(2026, 10, 15))).toBe('Domingo, 15 de novembro');
  });

  it('hero mostra data e saudação', () => {
    const f = TestBed.createComponent(HojeHero);
    f.componentRef.setInput('data', 'Domingo, 15 de novembro');
    f.componentRef.setInput('saudacao', 'Ana, bom dia');
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent;
    expect(t).toContain('Domingo, 15 de novembro');
    expect(t).toContain('Ana, bom dia');
  });
});
