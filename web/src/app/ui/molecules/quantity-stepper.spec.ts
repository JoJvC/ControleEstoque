import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { QuantityStepper } from './quantity-stepper';

@Component({
  imports: [QuantityStepper, ReactiveFormsModule],
  template: `<ce-quantity-stepper [formControl]="control" [min]="0" [max]="5" />`,
})
class Host {
  readonly control = new FormControl(2, { nonNullable: true });
}

async function montar() {
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const [menos, mais] = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ) as HTMLButtonElement[];
  const campo = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  return { fixture, menos, mais, campo, control: fixture.componentInstance.control };
}

describe('QuantityStepper', () => {
  it('incrementa e decrementa o valor do form', async () => {
    const { fixture, menos, mais, control } = await montar();

    mais.click();
    await fixture.whenStable();
    expect(control.value).toBe(3);

    menos.click();
    menos.click();
    await fixture.whenStable();
    expect(control.value).toBe(1);
  });

  it('não desce abaixo do min: botão − desabilita', async () => {
    const { fixture, menos, control } = await montar();
    control.setValue(0);
    await fixture.whenStable();

    expect(menos.disabled).toBe(true);
    expect(control.value).toBe(0);
  });

  it('não passa do max: botão + desabilita', async () => {
    const { fixture, mais, control } = await montar();
    control.setValue(5);
    await fixture.whenStable();

    expect(mais.disabled).toBe(true);
  });

  it('digitação direta é limitada ao intervalo', async () => {
    const { fixture, campo, control } = await montar();

    campo.value = '99';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(control.value).toBe(5);
  });

  it('writeValue fora do intervalo é limitado', async () => {
    const { fixture, control, campo } = await montar();

    control.setValue(42);
    await fixture.whenStable();
    campo.dispatchEvent(new Event('blur'));

    expect(campo.value).toBe('5');
  });
});
