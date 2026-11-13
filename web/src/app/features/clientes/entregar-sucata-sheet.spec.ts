import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { EntregarSucataSheet } from './entregar-sucata-sheet';

const URL = '/api/clientes/v1/clientes/c-1/sucatas';

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [EntregarSucataSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { clienteId: 'c-1' } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(EntregarSucataSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar'),
    ) as HTMLButtonElement;
  const marcarConverter = async () => {
    (el.querySelector('ce-checkbox input') as HTMLInputElement).click();
    await fixture.whenStable();
  };
  const digitar = async (digitos: string) => {
    const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
    campo.value = digitos;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { fixture, el, http, close, confirmar, marcarConverter, digitar };
}

describe('EntregarSucataSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mostra o aviso fixo e não mostra o valor da conversão', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('Sucata não abate débito de casco.');
    expect(el.querySelector('ce-money-input')).toBeNull();
  });

  it('sem marcar o checkbox envia valorConversao: null e fecha com a resposta', async () => {
    const { fixture, http, close, confirmar } = await montar();
    confirmar().click();
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ quantidade: 1, valorConversao: null });
    const resposta = { totalSucataEntregue: 1, novoSaldoFiado: 0 };
    req.flush(resposta);
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(resposta);
  });

  it('marcar o checkbox exige o valor; digitar envia valorConversao', async () => {
    const { el, http, confirmar, marcarConverter, digitar } = await montar();
    await marcarConverter();
    expect(el.querySelector('ce-money-input')).not.toBeNull();
    expect(confirmar().disabled).toBe(true);

    await digitar('1500');
    expect(confirmar().disabled).toBe(false);
    confirmar().click();
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ quantidade: 1, valorConversao: 15 });
    req.flush({ totalSucataEntregue: 1, novoSaldoFiado: 15 });
  });

  it('4xx aparece inline e não fecha', async () => {
    const { fixture, el, http, close, confirmar } = await montar();
    confirmar().click();
    http
      .expectOne(URL)
      .flush(
        { code: 'QUANTIDADE_INVALIDA', message: 'x', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Quantidade inválida para a operação.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
