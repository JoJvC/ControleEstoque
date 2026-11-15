import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { FakeStorage } from '../../core/permissions/testing';
import { ColorSchemeService } from '../../core/platform/color-scheme-service';
import { StorageService } from '../../core/platform/storage-service';
import { FakeColorScheme } from '../../core/theme/testing';
import { ThemeStore } from '../../core/theme/theme-store';
import { AparenciaPage } from './aparencia-page';

describe('AparenciaPage', () => {
  let storage: FakeStorage;
  let cor: FakeColorScheme;
  let navigate: ReturnType<typeof vi.fn>;
  let desktop: boolean;

  beforeEach(() => {
    storage = new FakeStorage();
    cor = new FakeColorScheme();
    navigate = vi.fn();
    desktop = false;
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useValue: storage },
        { provide: ColorSchemeService, useValue: cor },
        { provide: Router, useValue: { navigate } },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => new BehaviorSubject({ matches: desktop }) },
        },
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
    const confere = (i: number, valor: string, aplicado: string) => {
      expect(
        marcados(radios())
          .map((m, j) => m === (j === i))
          .every(Boolean),
      ).toBe(true);
      expect(storage.get('ce.tema')).toBe(valor);
      expect(cor.aplicado).toBe(aplicado);
      expect(document.activeElement).toBe(radios()[i]);
    };

    radios()[0].focus();
    tecla(radios()[0], 'ArrowRight');
    await fixture.whenStable();
    confere(1, 'oceano', 'oceano');
    expect(tabindex()).toEqual(['-1', '0', '-1', '-1', '-1']);

    tecla(radios()[1], 'ArrowLeft');
    await fixture.whenStable();
    confere(0, 'automatico', 'oceano');
    tecla(radios()[0], 'ArrowLeft');
    await fixture.whenStable();
    confere(4, 'noite', 'noite');

    tecla(radios()[4], 'ArrowDown');
    await fixture.whenStable();
    confere(0, 'automatico', 'oceano');

    tecla(radios()[0], 'End');
    await fixture.whenStable();
    confere(4, 'noite', 'noite');
    tecla(radios()[4], 'Home');
    await fixture.whenStable();
    confere(0, 'automatico', 'oceano');
  });

  it.each([
    [0, 'automatico', 'oceano'],
    [1, 'oceano', 'oceano'],
    [2, 'uva', 'uva'],
    [3, 'carvao', 'carvao'],
    [4, 'noite', 'noite'],
  ])('clique na opção %i (%s) marca só ela e grava', async (i, valor, aplicado) => {
    const { fixture, radios } = await montar();
    if (i === 0) radios()[1].click();
    radios()[i].click();
    await fixture.whenStable();
    expect(marcados(radios()).filter(Boolean)).toHaveLength(1);
    expect(marcados(radios())[i]).toBe(true);
    expect(storage.get('ce.tema')).toBe(valor);
    expect(cor.aplicado).toBe(aplicado);
  });

  it('Automático: escuro aplica noite, claro oceano, emitir troca sem nova escolha', async () => {
    cor.escuro = true;
    TestBed.inject(ThemeStore).iniciar();
    const { fixture } = await montar();
    expect(cor.aplicado).toBe('noite');
    cor.emitir(false);
    await fixture.whenStable();
    expect(cor.aplicado).toBe('oceano');
    cor.emitir(true);
    expect(cor.aplicado).toBe('noite');
  });

  it('miniatura do Automático tem duas metades; cada tema fixo tem o próprio slug', async () => {
    const { radios } = await montar();
    const previas = () =>
      radios().map((r) =>
        Array.from(r.querySelectorAll('.aparencia__metade')).map((m) =>
          m.getAttribute('data-tema'),
        ),
      );
    expect(previas()).toEqual([['oceano', 'noite'], ['oceano'], ['uva'], ['carvao'], ['noite']]);
  });

  it('cabeçalho do protótipo, voltar para /mais e texto explicativo', async () => {
    const { el } = await montar();
    const cab = el.querySelector('ce-app-header');
    expect(cab?.textContent).toContain('Aparência');
    expect(cab?.textContent).toContain('Guardado neste aparelho');
    el.querySelector<HTMLElement>('[aria-label="Voltar"]')?.click();
    expect(navigate).toHaveBeenCalledWith(['/mais']);
    expect(el.textContent).toContain('O tema troca só o topo, a ação e as superfícies.');
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it.each([
    [false, true],
    [true, false],
  ])('desktop=%s: voltar visível=%s', async (ehDesktop, visivel) => {
    desktop = ehDesktop;
    const { el } = await montar();
    expect(!!el.querySelector('[aria-label="Voltar"]')).toBe(visivel);
  });
});
