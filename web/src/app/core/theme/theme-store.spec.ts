import { TestBed } from '@angular/core/testing';

import { FakeStorage } from '../permissions/testing';
import { ColorSchemeService } from '../platform/color-scheme-service';
import { StorageService } from '../platform/storage-service';
import { FakeColorScheme } from './testing';
import { TemaEscolha, ThemeStore, lerEscolha, resolverTema } from './theme-store';

describe('lerEscolha', () => {
  it('ausente ou inválido vira automatico', () => {
    expect(lerEscolha(null)).toBe('automatico');
    expect(lerEscolha(undefined)).toBe('automatico');
    expect(lerEscolha('rosa')).toBe('automatico');
    expect(lerEscolha(3)).toBe('automatico');
  });

  it('valores válidos passam', () => {
    for (const e of ['automatico', 'oceano', 'uva', 'carvao', 'noite'] as TemaEscolha[]) {
      expect(lerEscolha(e)).toBe(e);
    }
  });
});

describe('resolverTema', () => {
  it('automático segue o aparelho; fixo devolve ele mesmo', () => {
    expect(resolverTema('automatico', false)).toBe('oceano');
    expect(resolverTema('automatico', true)).toBe('noite');
    expect(resolverTema('uva', false)).toBe('uva');
    expect(resolverTema('uva', true)).toBe('uva');
    expect(resolverTema('carvao', true)).toBe('carvao');
    expect(resolverTema('oceano', true)).toBe('oceano');
  });
});

describe('ThemeStore', () => {
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

  it('escolher grava em ce.tema e aplica', () => {
    const store = TestBed.inject(ThemeStore);
    store.iniciar();
    store.escolher('uva');
    expect(storage.get('ce.tema')).toBe('uva');
    expect(cor.aplicado).toBe('uva');
    expect(store.escolha()).toBe('uva');
    expect(store.aplicado()).toBe('uva');
  });

  it('automático: claro aplica oceano, escuro aplica noite', () => {
    TestBed.inject(ThemeStore).iniciar();
    expect(cor.aplicado).toBe('oceano');

    TestBed.resetTestingModule();
    cor = new FakeColorScheme();
    cor.escuro = true;
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useValue: new FakeStorage() },
        { provide: ColorSchemeService, useValue: cor },
      ],
    });
    TestBed.inject(ThemeStore).iniciar();
    expect(cor.aplicado).toBe('noite');
  });

  it('automático acompanha a troca do aparelho sem recarregar', () => {
    const store = TestBed.inject(ThemeStore);
    store.iniciar();
    expect(cor.aplicado).toBe('oceano');
    cor.emitir(true);
    expect(cor.aplicado).toBe('noite');
    expect(store.aplicado()).toBe('noite');
    cor.emitir(false);
    expect(cor.aplicado).toBe('oceano');
  });

  it('escolha fixa ignora a troca do aparelho', () => {
    const store = TestBed.inject(ThemeStore);
    store.iniciar();
    store.escolher('uva');
    cor.emitir(true);
    expect(cor.aplicado).toBe('uva');
    expect(store.aplicado()).toBe('uva');
  });

  it('restaura a escolha salva ao iniciar', () => {
    storage.set('ce.tema', 'carvao');
    TestBed.inject(ThemeStore).iniciar();
    expect(cor.aplicado).toBe('carvao');
  });

  it('storage vazio ou inválido aplica pelo automático', () => {
    storage.set('ce.tema', 'rosa');
    const store = TestBed.inject(ThemeStore);
    store.iniciar();
    expect(store.escolha()).toBe('automatico');
    expect(cor.aplicado).toBe('oceano');
  });
});
