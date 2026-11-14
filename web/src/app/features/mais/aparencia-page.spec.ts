import { TestBed } from '@angular/core/testing';

import { FakeStorage } from '../../core/permissions/testing';
import { ColorSchemeService } from '../../core/platform/color-scheme-service';
import { StorageService } from '../../core/platform/storage-service';
import { FakeColorScheme } from '../../core/theme/testing';
import { ThemeStore } from '../../core/theme/theme-store';
import { AparenciaPage } from './aparencia-page';

describe('AparenciaPage', () => {
  let storage: FakeStorage;
  let cor: FakeColorScheme;

  beforeEach(() => {
    storage = new FakeStorage();
    cor = new FakeColorScheme();
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useValue: storage },
        { provide: ColorSchemeService, useValue: cor },
      ],
    });
  });

  async function montar() {
    const fixture = TestBed.createComponent(AparenciaPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const radios = () => Array.from(el.querySelectorAll<HTMLElement>('[role="radio"]'));
    return { fixture, el, radios };
  }

  const marcados = (radios: HTMLElement[]) =>
    radios.map((r) => r.getAttribute('aria-checked') === 'true');
  const tecla = (alvo: HTMLElement, key: string) =>
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  it('renderiza 5 opções na ordem, sem placeholder', async () => {
    const { el, radios } = await montar();
    expect(radios().map((r) => r.querySelector('.aparencia__nome')?.textContent?.trim())).toEqual([
      'Automático',
      'Oceano',
      'Uva',
      'Carvão',
      'Noite',
    ]);
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
    expect(el.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Tema');
    expect(marcados(radios())).toEqual([true, false, false, false, false]);
  });

  it('clique em Uva marca só ele, aplica e grava', async () => {
    const { fixture, radios } = await montar();
    radios()[2].click();
    await fixture.whenStable();
    expect(marcados(radios())).toEqual([false, false, true, false, false]);
    expect(cor.aplicado).toBe('uva');
    expect(storage.get('ce.tema')).toBe('uva');
  });

  it('teclado: setas, volta nas pontas, Home e End; tabindex roving', async () => {
    const { fixture, radios } = await montar();
    const tabindex = () => radios().map((r) => r.getAttribute('tabindex'));
    expect(tabindex()).toEqual(['0', '-1', '-1', '-1', '-1']);

    radios()[0].focus();
    tecla(radios()[0], 'ArrowRight');
    await fixture.whenStable();
    expect(storage.get('ce.tema')).toBe('oceano');
    expect(document.activeElement).toBe(radios()[1]);
    expect(tabindex()).toEqual(['-1', '0', '-1', '-1', '-1']);

    tecla(radios()[1], 'ArrowLeft');
    tecla(radios()[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(storage.get('ce.tema')).toBe('noite');
    expect(document.activeElement).toBe(radios()[4]);

    tecla(radios()[4], 'ArrowDown');
    await fixture.whenStable();
    expect(storage.get('ce.tema')).toBe('automatico');

    tecla(radios()[0], 'End');
    await fixture.whenStable();
    expect(storage.get('ce.tema')).toBe('noite');
    tecla(radios()[4], 'Home');
    await fixture.whenStable();
    expect(storage.get('ce.tema')).toBe('automatico');
    expect(document.activeElement).toBe(radios()[0]);
  });

  it('miniaturas têm o data-tema da opção; a do Automático segue o dublê', async () => {
    cor.escuro = true;
    TestBed.inject(ThemeStore).iniciar();
    const { fixture, radios } = await montar();
    const previas = () =>
      radios().map((r) => r.querySelector('.aparencia__previa')?.getAttribute('data-tema'));
    expect(previas()).toEqual(['noite', 'oceano', 'uva', 'carvao', 'noite']);

    cor.emitir(false);
    await fixture.whenStable();
    expect(previas()[0]).toBe('oceano');

    cor.emitir(true);
    radios()[2].click(); // escolha fixa: o Automático ainda mostra o do aparelho
    await fixture.whenStable();
    expect(previas()[0]).toBe('noite');
  });
});
