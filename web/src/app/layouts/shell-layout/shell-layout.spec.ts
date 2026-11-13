import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ShellLayout } from './shell-layout';

describe('ShellLayout — bottom-nav', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
        { provide: StorageService, useValue: new FakeStorage() },
      ],
    });
  });

  const rotulos = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.nav__item')).map((a) => a.textContent?.trim() ?? '');

  it('Vender só aparece com vendas.registrar; atualiza sem recriar o componente', async () => {
    const store = TestBed.inject(OperatorStore);
    store.select(operadorValido([]));
    const fixture = TestBed.createComponent(ShellLayout);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Vender'))).toBe(false);
    expect(rotulos(el).some((t) => t.includes('Clientes'))).toBe(true);

    store.select(operadorValido(['vendas.registrar']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Vender'))).toBe(true);

    store.select(operadorValido(['clientes.cadastrar']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Vender'))).toBe(false);
    TestBed.inject(HttpTestingController).match(() => true);
  });
});
