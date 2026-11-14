import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ColorSchemeService, provideColorScheme } from './color-scheme-service';

describe('WebColorSchemeService', () => {
  afterEach(() => document.documentElement.removeAttribute('data-tema'));

  it('applyTheme grava data-tema no <html>', () => {
    TestBed.configureTestingModule({ providers: [provideColorScheme()] });
    TestBed.inject(ColorSchemeService).applyTheme('uva');
    expect(document.documentElement.getAttribute('data-tema')).toBe('uva');
  });

  it('sem matchMedia: prefersDark é false e onChange devolve função sem lançar', () => {
    TestBed.configureTestingModule({
      providers: [provideColorScheme(), { provide: DOCUMENT, useValue: { defaultView: null } }],
    });
    const servico = TestBed.inject(ColorSchemeService);
    expect(servico.prefersDark()).toBe(false);
    const cancelar = servico.onChange(() => undefined);
    expect(typeof cancelar).toBe('function');
    expect(() => cancelar()).not.toThrow();
  });
});
