import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { PagarCascoSheet } from './pagar-casco-sheet';

const BASE = '/api/clientes/v1/clientes/c-1/cascos';

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [PagarCascoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { clienteId: 'c-1' } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(PagarCascoSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const botao = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    ) as HTMLButtonElement;
  const digitar = async (digitos: string) => {
    const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
    campo.value = digitos;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const modoConversao = async () => {
    botao('Conversão em valor').click();
    await fixture.whenStable();
  };
  return { fixture, el, http, close, botao, digitar, modoConversao };
}

describe('PagarCascoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('começa em devolução, sem valor unitário, com Confirmar habilitado', async () => {
    const { el, botao } = await montar();
    expect(botao('Devolução física').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('ce-money-input')).toBeNull();
    expect(botao('Confirmar').disabled).toBe(false);
  });

  it('devolução: Confirmar envia { quantidade } e fecha com a resposta', async () => {
    const { fixture, http, close, botao } = await montar();
    botao('Confirmar').click();
    const req = http.expectOne(`${BASE}/devolucoes`);
    expect(req.request.body).toEqual({ quantidade: 1 });
    req.flush({ novoSaldoCascos: 4 });
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith({ novoSaldoCascos: 4 });
  });

  it('clicar em Conversão em valor mostra o valor unitário e desabilita Confirmar com valor vazio', async () => {
    const { el, botao, modoConversao } = await montar();
    await modoConversao();
    expect(botao('Conversão em valor').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('ce-money-input')).not.toBeNull();
    expect(botao('Confirmar').disabled).toBe(true);
  });

  it('conversão: digitar e Confirmar envia { quantidade, valorUnitario }', async () => {
    const { fixture, http, close, botao, digitar, modoConversao } = await montar();
    await modoConversao();
    await digitar('3000');
    expect(botao('Confirmar').disabled).toBe(false);
    botao('Confirmar').click();
    const req = http.expectOne(`${BASE}/conversoes`);
    expect(req.request.body).toEqual({ quantidade: 1, valorUnitario: 30 });
    const resposta = { novoSaldoCascos: 0, novoSaldoFiado: 30 };
    req.flush(resposta);
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(resposta);
  });

  it('422 CONVERSAO_MAIOR_QUE_SALDO aparece inline e não fecha', async () => {
    const { fixture, el, http, close, botao, digitar, modoConversao } = await montar();
    await modoConversao();
    await digitar('3000');
    botao('Confirmar').click();
    http
      .expectOne(`${BASE}/conversoes`)
      .flush(
        { code: 'CONVERSAO_MAIOR_QUE_SALDO', message: 'x', traceId: 't' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Quantidade maior que o saldo de cascos do cliente.',
    );
    expect(close).not.toHaveBeenCalled();
    expect(botao('Confirmar').disabled).toBe(false);
  });
});
