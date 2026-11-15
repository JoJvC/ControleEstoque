import { TestBed } from '@angular/core/testing';

import { CartaoVariante, HojeCartao, modeloCartao } from './hoje-cartao';

function montar(variante: CartaoVariante) {
  const f = TestBed.createComponent(HojeCartao);
  f.componentRef.setInput('variante', variante);
  f.componentRef.setInput('valor', '7');
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('HojeCartao', () => {
  it('casco aplica a borda tracejada', () => {
    const el = montar('casco');
    expect(el.querySelector('.cartao--casco')).not.toBeNull();
    expect(el.querySelector('.cartao--fiado')).toBeNull();
    expect(el.textContent).toContain('Cascos na rua');
    expect(el.textContent).toContain('7');
  });

  it('fiado não aplica', () => {
    const el = montar('fiado');
    expect(el.querySelector('.cartao--casco')).toBeNull();
    expect(el.querySelector('.cartao--fiado')).not.toBeNull();
    expect(el.textContent).toContain('Fiado a receber');
  });

  it('fiado com total > 0 fica no tom fiado', () => {
    const el = montar('fiado');
    expect(el.querySelector('.cartao--pago')).toBeNull();
  });

  it('fiado zerado fica no tom pago', () => {
    const f = TestBed.createComponent(HojeCartao);
    f.componentRef.setInput('variante', 'fiado');
    f.componentRef.setInput('valor', 'Em dia');
    f.componentRef.setInput('zerado', true);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.cartao--pago')).not.toBeNull();
    expect(el.querySelector('.cartao--fiado')).toBeNull();
    expect(el.textContent).toContain('Em dia');
  });

  it('zerado sem o dado carregado não vira tom pago', () => {
    const f = TestBed.createComponent(HojeCartao);
    f.componentRef.setInput('variante', 'fiado');
    f.componentRef.setInput('zerado', true);
    f.componentRef.setInput('status', 'error');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.cartao--pago')).toBeNull();
  });

  it('modeloCartao', () => {
    expect(modeloCartao('casco').icone).toBe('casco-na-rua');
    expect(modeloCartao('fiado').icone).toBeNull();
  });
});
