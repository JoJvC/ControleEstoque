import { DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { BaixaCascoSheet } from './baixa-casco-sheet';

const FUNCIONARIOS = [
  {
    id: 'f1',
    nome: 'Maria',
    telefone: null,
    cargoId: 'c1',
    cargo: null,
    valorDiaria: 0,
    ativo: true,
  },
  {
    id: 'f2',
    nome: 'Inativo',
    telefone: null,
    cargoId: 'c1',
    cargo: null,
    valorDiaria: 0,
    ativo: false,
  },
];

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [BaixaCascoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(BaixaCascoSheet);
  fixture.detectChanges();
  http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    close,
    http,
    confirmar: () =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Registrar'),
      ) as HTMLButtonElement,
  };
}

describe('BaixaCascoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza só os funcionários ativos como responsáveis', async () => {
    const t = await montar();
    expect(t.el.textContent).toContain('Maria');
    expect(t.el.textContent).not.toContain('Inativo');
  });

  it('sem responsável: não chama a API e mostra o erro', async () => {
    const t = await montar();

    t.confirmar().click();
    await t.fixture.whenStable();
    t.fixture.detectChanges();

    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain('ao menos um funcionário');
  });

  it('com responsável: Confirmar envia a baixa e fecha com true', async () => {
    const t = await montar();
    const caixa = t.el.querySelector('ce-checkbox input') as HTMLInputElement;
    caixa.click();
    await t.fixture.whenStable();

    t.confirmar().click();
    const req = t.http.expectOne('/api/estoque/v1/estoque/cascos/baixas');
    expect(req.request.body).toEqual({ quantidade: 1, motivo: null, responsaveisIds: ['f1'] });
    req.flush({ id: 'b1' });
    await t.fixture.whenStable();
    t.http.expectOne('/api/estoque/v1/estoque').flush([]);
    await t.fixture.whenStable();
    expect(t.close).toHaveBeenCalledWith(true);
  });
});
