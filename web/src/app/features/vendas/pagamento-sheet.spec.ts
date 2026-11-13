import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { PagamentoSheet, PagamentoSheetDados } from './pagamento-sheet';

const URL_PAGAMENTOS = '/api/vendas/v1/vendas/v-1/pagamentos';
const URL_LISTA = '/api/vendas/v1/vendas';

async function montar() {
  const close = vi.fn();
  const dados: PagamentoSheetDados = { vendaId: 'v-1', saldo: 60 };
  await TestBed.configureTestingModule({
    imports: [PagamentoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: dados },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(PagamentoSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar'),
    ) as HTMLButtonElement;
  const digitar = async (digitos: string) => {
    const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
    campo.value = digitos;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { fixture, el, http, close, confirmar, digitar };
}

describe('PagamentoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mostra o saldo e começa com Confirmar desabilitado', async () => {
    const { el, confirmar } = await montar();
    expect((el.textContent ?? '').replace(/\s+/g, ' ')).toContain('Saldo a pagar: R$ 60,00');
    expect(confirmar().disabled).toBe(true);
  });

  it('digitar e confirmar faz o POST e fecha com a resposta', async () => {
    const { fixture, http, close, confirmar, digitar } = await montar();
    await digitar('2500');
    expect(confirmar().disabled).toBe(false);

    confirmar().click();
    const req = http.expectOne(URL_PAGAMENTOS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ forma: 'PIX', valor: 25 });
    const resposta = { id: 'v-1' };
    req.flush(resposta);
    await fixture.whenStable();
    http.expectOne((r) => r.method === 'GET' && r.url === URL_LISTA).flush([]);
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(resposta);
  });

  it('valor acima do saldo desabilita Confirmar e não envia nada', async () => {
    const { fixture, el, close, confirmar, digitar } = await montar();
    await digitar('6001');

    expect(confirmar().disabled).toBe(true);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('acima do saldo');
    confirmar().click();
    await fixture.whenStable();
    expect(close).not.toHaveBeenCalled();
  });

  it('valor igual ao saldo é aceito', async () => {
    const { confirmar, digitar } = await montar();
    await digitar('6000');
    expect(confirmar().disabled).toBe(false);
  });

  it.each([
    [422, 'PAGAMENTO_EXCEDE_SALDO', 'O valor do pagamento é maior que o saldo devedor.'],
    [409, 'CAIXA_FECHADO', 'O caixa do dia já está fechado.'],
    [400, 'PAGAMENTO_INVALIDO', 'Valor de pagamento deve ser positivo.'],
  ])('%i %s mostra a mensagem inline e não fecha', async (status, code, mensagem) => {
    const { fixture, el, http, close, confirmar, digitar } = await montar();
    await digitar('1000');

    confirmar().click();
    http
      .expectOne(URL_PAGAMENTOS)
      .flush({ code, message: 'x', traceId: 't' }, { status, statusText: 'Erro' });
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(mensagem);
    expect(close).not.toHaveBeenCalled();
    expect(confirmar().disabled).toBe(false);
  });
});
