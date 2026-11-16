import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { ReceberFiadoSheet } from './receber-fiado-sheet';

const URL = '/api/financeiro/v1/clientes/c-1/fiado/pagamentos';

async function montar() {
  const close = vi.fn();
  const backdropClick = new Subject<MouseEvent>();
  const keydownEvents = new Subject<KeyboardEvent>();
  await TestBed.configureTestingModule({
    imports: [ReceberFiadoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { clienteId: 'c-1' } },
      { provide: DialogRef, useValue: { close, backdropClick, keydownEvents } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ReceberFiadoSheet);
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
  const escolherForma = async (valor: string) => {
    const select = el.querySelector('ce-select select') as HTMLSelectElement;
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  return { fixture, el, http, close, backdropClick, confirmar, digitar, escolherForma };
}

describe('ReceberFiadoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('começa com Confirmar desabilitado (valor vazio)', async () => {
    const { confirmar } = await montar();
    expect(confirmar().disabled).toBe(true);
  });

  it('envia { valor, forma } à Financeiro e mostra o resultado; Fechar devolve a resposta', async () => {
    const { fixture, el, http, close, confirmar, digitar, escolherForma } = await montar();
    await digitar('5000');
    await escolherForma('PIX');
    confirmar().click();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ valor: 50, forma: 'PIX' });
    const resposta = {
      novoSaldoFiado: 20,
      novoSaldo: -20,
      vendasAbatidas: [
        {
          vendaId: 'v-1',
          data: '2026-11-01T10:00:00',
          valorAbatido: 30,
          novoStatus: 'PAGA',
          restante: 0,
        },
        {
          vendaId: 'v-2',
          data: '2026-11-05T10:00:00',
          valorAbatido: 20,
          novoStatus: 'PARCIAL',
          restante: 20,
        },
      ],
      valorEmCredito: 5,
    };
    req.flush(resposta);
    await fixture.whenStable();
    expect(close).not.toHaveBeenCalled();
    expect(el.querySelector('form')).toBeNull();
    const linhas = Array.from(el.querySelectorAll('.resumo li')).map((li) =>
      li.textContent!.replace(/\s/g, ' '),
    );
    expect(linhas).toEqual([
      '01/11 — quitada (R$ 30,00)',
      '05/11 — abatida R$ 20,00, resta R$ 20,00',
      'R$ 5,00 virou crédito',
    ]);
    expect(el.textContent!.replace(/\s/g, ' ')).toContain('Fiado agora: R$ 20,00');
    const fechar = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Fechar'),
    ) as HTMLButtonElement;
    fechar.click();
    expect(close).toHaveBeenCalledWith(resposta);
  });

  it('depois do sucesso, clique fora também devolve a resposta', async () => {
    const { fixture, http, close, backdropClick, confirmar, digitar } = await montar();
    await digitar('100');
    confirmar().click();
    const resposta = { novoSaldoFiado: 0, novoSaldo: 0, vendasAbatidas: [], valorEmCredito: 0 };
    http.expectOne(URL).flush(resposta);
    await fixture.whenStable();
    backdropClick.next(new MouseEvent('click'));
    expect(close).toHaveBeenCalledWith(resposta);
  });

  it('forma padrão é DINHEIRO', async () => {
    const { http, confirmar, digitar } = await montar();
    await digitar('100');
    confirmar().click();
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ valor: 1, forma: 'DINHEIRO' });
    req.flush({ novoSaldoFiado: 0, novoSaldo: 0, vendasAbatidas: [], valorEmCredito: 0 });
  });

  it.each([
    [422, 'PAGAMENTO_EXCEDE_SALDO', 'O valor do pagamento é maior que o saldo devedor.'],
    [409, 'CAIXA_FECHADO', 'O caixa do dia já está fechado.'],
    [400, 'VALOR_INVALIDO', 'Valor deve ser positivo.'],
  ])('%i %s aparece inline e não fecha', async (status, code, mensagem) => {
    const { fixture, el, http, close, confirmar, digitar } = await montar();
    await digitar('5000');
    confirmar().click();
    http
      .expectOne(URL)
      .flush(
        { code, message: 'Valor deve ser positivo.', traceId: 't' },
        { status, statusText: 'Erro' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(mensagem);
    expect(close).not.toHaveBeenCalled();
    expect(confirmar().disabled).toBe(false);
  });
});
