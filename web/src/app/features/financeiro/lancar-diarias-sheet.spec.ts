import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { ToastService } from '../../core/toast/toast-service';
import { LancarDiariasSheet } from './lancar-diarias-sheet';

const URL = '/api/financeiro/v1/caixas/cx-1/diarias';
const func = (id: string, nome: string, valorDiaria = 80) => ({
  id,
  nome,
  telefone: null,
  cargoId: 'c-1',
  cargo: 'Entregador',
  valorDiaria,
  ativo: true,
});

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [LancarDiariasSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { caixaId: 'cx-1' } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(LancarDiariasSheet);
  fixture.detectChanges();
  http.expectOne('/api/rh/v1/funcionarios').flush([func('f-1', 'Ana'), func('f-2', 'Bia')]);
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const confirmar = () =>
    (
      Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Lançar diárias',
      ) as HTMLButtonElement
    ).click();
  const digitar = async (campo: HTMLInputElement, digitos: string) => {
    campo.value = digitos;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const valores = () =>
    Array.from(el.querySelectorAll('ce-money-input input')) as HTMLInputElement[];
  return { fixture, el, http, close, confirmar, digitar, valores };
}

describe('LancarDiariasSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('confirmar envia o valor editado e deixa nulo o que ficou no padrão', async () => {
    const { fixture, http, close, confirmar, digitar, valores } = await montar();
    await digitar(valores()[0], '10000');
    confirmar();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      diarias: [
        { funcionarioId: 'f-1', valor: 100 },
        { funcionarioId: 'f-2', valor: null },
      ],
    });
    req.flush({ caixaId: 'cx-1', data: '2026-11-15', diariasLancadas: 2 });
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(true);
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message),
    ).toContain('Diárias lançadas: 2');
  });

  it('409 DIARIAS_JA_LANCADAS mostra a mensagem e não fecha', async () => {
    const { fixture, el, http, close, confirmar } = await montar();
    confirmar();
    http
      .expectOne(URL)
      .flush(
        { code: 'DIARIAS_JA_LANCADAS', message: 'x', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'As diárias deste caixa já foram lançadas.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
