import { ComponentFixture } from '@angular/core/testing';

export async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

/** Escolhe a opção de um ce-select pelo aria-label, como o usuário (change no <select>). */
export function escolher(el: HTMLElement, rotulo: string, valor: string): void {
  const campo = el.querySelector<HTMLSelectElement>(`select[aria-label="${rotulo}"]`)!;
  campo.value = valor;
  campo.dispatchEvent(new Event('change'));
}

export function clicar(el: HTMLElement, seletor: string): void {
  el.querySelector<HTMLElement>(seletor)!.click();
}

export function botaoPorRotulo(el: HTMLElement, rotulo: string): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`)!;
}
