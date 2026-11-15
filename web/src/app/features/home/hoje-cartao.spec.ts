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

  it('modeloCartao', () => {
    expect(modeloCartao('casco').icone).toBe('casco-na-rua');
    expect(modeloCartao('fiado').icone).toBeNull();
  });
});
