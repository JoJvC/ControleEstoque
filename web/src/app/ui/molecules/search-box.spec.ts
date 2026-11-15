import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';

import { SearchBox } from './search-box';

// Fake timers só DEPOIS de montar — whenStable() depende dos timers reais.
async function montar() {
  await TestBed.configureTestingModule({ imports: [SearchBox] }).compileComponents();
  const fixture = TestBed.createComponent(SearchBox);
  await fixture.whenStable();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const emissoes: string[] = [];
  fixture.componentInstance.buscar.subscribe((termo: string) => emissoes.push(termo));
  vi.useFakeTimers();
  return { fixture, input, emissoes };
}

function digitar(input: HTMLInputElement, texto: string): void {
  input.value = texto;
  input.dispatchEvent(new Event('input'));
}

describe('SearchBox', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('só emite depois do debounce de 300ms', async () => {
    const { input, emissoes } = await montar();

    digitar(input, 'agua');
    expect(emissoes).toEqual([]);

    vi.advanceTimersByTime(299);
    expect(emissoes).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emissoes).toEqual(['agua']);
  });

  it('digitação contínua emite apenas o último termo', async () => {
    const { input, emissoes } = await montar();

    digitar(input, 'a');
    vi.advanceTimersByTime(150);
    digitar(input, 'ag');
    vi.advanceTimersByTime(150);
    digitar(input, 'agu');
    vi.advanceTimersByTime(300);

    expect(emissoes).toEqual(['agu']);
  });

  it('limpar emite string vazia imediatamente', async () => {
    const { fixture, input, emissoes } = await montar();

    digitar(input, 'galao');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    const limpar = fixture.nativeElement.querySelector(
      'button[aria-label="Limpar busca"]',
    ) as HTMLButtonElement;
    limpar.click();

    expect(emissoes).toEqual(['galao', '']);
  });
});

describe('SearchBox (nome acessível)', () => {
  it('com rotulo, o input expõe o aria-label', async () => {
    await TestBed.configureTestingModule({ imports: [SearchBox] }).compileComponents();
    const fixture = TestBed.createComponent(SearchBox);
    fixture.componentRef.setInput('rotulo', 'Campo X');
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Campo X');
  });

  it('sem rotulo não renderiza aria-label', async () => {
    await TestBed.configureTestingModule({ imports: [SearchBox] }).compileComponents();
    const fixture = TestBed.createComponent(SearchBox);
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.hasAttribute('aria-label')).toBe(false);
  });

  it('com valor de fora, a caixa o espelha e o limpar aparece', async () => {
    // Sem fake timers (montar): o agendador do Angular não pode ficar preso neles.
    await TestBed.configureTestingModule({ imports: [SearchBox] }).compileComponents();
    const fixture = TestBed.createComponent(SearchBox);
    fixture.componentRef.setInput('valor', 'an');
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('an');
    expect(fixture.nativeElement.querySelector('button[aria-label="Limpar busca"]')).not.toBeNull();
  });

  it('o eco do termo aparado em valor não apaga o espaço digitado', async () => {
    await TestBed.configureTestingModule({ imports: [SearchBox] }).compileComponents();
    const fixture = TestBed.createComponent(SearchBox);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    digitar(input, 'ana ');
    fixture.componentRef.setInput('valor', 'ana');
    await fixture.whenStable();
    expect(input.value).toBe('ana ');
    fixture.componentRef.setInput('valor', 'bia');
    await fixture.whenStable();
    expect(input.value).toBe('bia');
  });
});
