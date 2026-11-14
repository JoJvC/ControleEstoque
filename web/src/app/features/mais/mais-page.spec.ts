import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { MaisPage } from './mais-page';

describe('MaisPage', () => {
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
    Array.from(el.querySelectorAll('.mais__item')).map((a) => a.textContent?.trim() ?? '');

  it('sem relatorios.ver o link Relatórios some; os de consulta ficam; com a chave aparece, sem recriar', async () => {
    const store = TestBed.inject(OperatorStore);
    store.select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Relatórios'))).toBe(false);
    expect(rotulos(el).some((t) => t.includes('Estoque'))).toBe(true);

    store.select(operadorValido(['relatorios.ver']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Relatórios'))).toBe(true);
  });

  it('link Funcionários e cargos só aparece com rh.gerir', async () => {
    const store = TestBed.inject(OperatorStore);
    store.select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Funcionários e cargos'))).toBe(false);

    store.select(operadorValido(['rh.gerir']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Funcionários e cargos'))).toBe(true);
  });

  it('link Aparência aparece para operador sem permissões', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('.mais__item')).find((a) =>
      a.textContent?.includes('Aparência'),
    );
    expect(link?.getAttribute('href')).toBe('/mais/aparencia');
  });

  it('link Caixa do dia leva a /financeiro/caixa (rota sem permissão)', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('.mais__item')).find((a) =>
      a.textContent?.includes('Caixa'),
    );
    expect(link?.getAttribute('href')).toBe('/financeiro/caixa');
  });
});
