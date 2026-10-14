import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MoneyInput } from './money-input';

@Component({
  imports: [MoneyInput, ReactiveFormsModule],
  template: `<ce-money-input [formControl]="control" />`,
})
class Host {
  readonly control = new FormControl<number | null>(null);
}

async function montar() {
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  return { fixture, input, control: fixture.componentInstance.control };
}

function digitar(input: HTMLInputElement, texto: string): void {
  input.value = texto;
  input.dispatchEvent(new Event('input'));
}

describe('MoneyInput', () => {
  it('dígitos preenchem centavos: "1234" → 12,34 reais', async () => {
    const { input, control } = await montar();

    digitar(input, '1234');

    expect(control.value).toBe(12.34);
    expect(input.value).toBe('12,34');
  });

  it('um dígito vale um centavo: "7" → 0,07', async () => {
    const { input, control } = await montar();

    digitar(input, '7');

    expect(control.value).toBe(0.07);
    expect(input.value).toBe('0,07');
  });

  it('ignora caracteres não numéricos', async () => {
    const { input, control } = await montar();

    digitar(input, 'R$ 1a5,0x0');

    expect(control.value).toBe(15);
    expect(input.value).toBe('15,00');
  });

  it('milhares são formatados com ponto', async () => {
    const { input, control } = await montar();

    digitar(input, '123456789');

    expect(control.value).toBe(1234567.89);
    expect(input.value).toBe('1.234.567,89');
  });

  it('campo vazio vira null', async () => {
    const { input, control } = await montar();
    digitar(input, '500');

    digitar(input, '');

    expect(control.value).toBeNull();
    expect(input.value).toBe('');
  });

  it('writeValue formata valor vindo do form', async () => {
    const { fixture, input, control } = await montar();

    control.setValue(50);
    await fixture.whenStable();

    expect(input.value).toBe('50,00');
  });
});
