import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Chip, ChipTom } from './chip';

@Component({
  imports: [Chip],
  template: `
    <ce-chip tom="casco">3</ce-chip>
    <ce-chip tom="sucata">1</ce-chip>
    <ce-chip tom="fiado" icone="dinheiro">R$ 40,00</ce-chip>
    <ce-chip tom="pago">R$ 10,00</ce-chip>
  `,
})
class Host {}

describe('Chip', () => {
  it('cada tom aplica a sua própria classe e mostra só o seu valor', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const chips = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.chip'),
    );
    const tons: ChipTom[] = ['casco', 'sucata', 'fiado', 'pago'];
    expect(chips.map((c) => Array.from(c.classList).find((k) => k.startsWith('chip--')))).toEqual(
      tons.map((t) => `chip--${t}`),
    );
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['3', '1', 'R$ 40,00', 'R$ 10,00']);
  });

  it('ícone é opcional', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll('.chip');
    expect(chips[0].querySelector('ce-icon')).toBeNull();
    expect(chips[2].querySelector('ce-icon')).not.toBeNull();
  });
});
