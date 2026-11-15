import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { LancarSheet, LancarSheetDados } from './lancar-sheet';

const URL = '/api/rh/v1/funcionarios/f1';

async function montar(tipo: LancarSheetDados['tipo'] = 'VALE') {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [LancarSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { funcionarioId: 'f1', nome: 'Ana', tipo, saldo: 300 } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(LancarSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Lançar R$'),
    ) as HTMLButtonElement;
  const digitar = async (digitos: string) => {
    const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
    campo.value = digitos;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { fixture, el, http, close, confirmar, digitar };
}

describe('LancarSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('título, nome e saldo; botão desabilitado com valor 0', async () => {
    const t = await montar();
    expect(t.el.querySelector('h2')!.textContent).toContain('Lançar vale');
    expect(t.el.textContent).toMatch(/Ana · saldo R\$\s*300,00/);
    expect(t.confirmar().disabled).toBe(true);
    await t.digitar('0');
    expect(t.confirmar().disabled).toBe(true);
    expect(t.el.querySelector('.previa')).toBeNull();
  });

  it('valor 50: prévia 300 → 250 e botão Lançar R$ 50,00', async () => {
    const t = await montar();
    await t.digitar('5000');
    expect(t.el.querySelector('.previa')!.textContent).toMatch(
      /Saldo passa de R\$\s*300,00 para R\$\s*250,00/,
    );
    expect(t.confirmar().textContent).toMatch(/Lançar R\$\s*50,00/);
    expect(t.confirmar().disabled).toBe(false);
  });

  it('vale: POST /vales com { valor, observacao } e fecha com o saldo novo', async () => {
    const t = await montar();
    await t.digitar('5000');
    const obs = t.el.querySelector('ce-input input') as HTMLInputElement;
    obs.value = '  adiantamento ';
    obs.dispatchEvent(new Event('input'));
    t.confirmar().click();
    // durante o envio o botão fica desabilitado
    t.fixture.detectChanges();
    expect(t.confirmar().disabled).toBe(true);
    const req = t.http.expectOne(`${URL}/vales`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ valor: 50, observacao: 'adiantamento' });
    req.flush({ saldoAPagar: 250 }, { status: 201, statusText: 'Created' });
    await new Promise((r) => setTimeout(r, 0));
    t.http
      .expectOne(`${URL}/conta-corrente`)
      .flush({ funcionarioId: 'f1', saldoAPagar: 250, lancamentos: [] });
    await t.fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.close).toHaveBeenCalledWith(250);
  });

  it('pagamento: POST /pagamentos e observação vazia vai como null', async () => {
    const t = await montar('PAGAMENTO');
    expect(t.el.querySelector('h2')!.textContent).toContain('Lançar pagamento');
    await t.digitar('10000');
    expect(t.el.querySelector('.previa')!.textContent).toMatch(/para R\$\s*200,00/);
    t.confirmar().click();
    const req = t.http.expectOne(`${URL}/pagamentos`);
    expect(req.request.body).toEqual({ valor: 100, observacao: null });
    req.flush({ saldoAPagar: 200 }, { status: 201, statusText: 'Created' });
    await new Promise((r) => setTimeout(r, 0));
    t.http
      .expectOne(`${URL}/conta-corrente`)
      .flush({ funcionarioId: 'f1', saldoAPagar: 200, lancamentos: [] });
    await new Promise((r) => setTimeout(r, 0));
    expect(t.close).toHaveBeenCalledWith(200);
  });

  it('422 PAGAMENTO_EXCEDE_SALDO fica na sheet com role=alert e reabilita o botão', async () => {
    const t = await montar('PAGAMENTO');
    await t.digitar('90000');
    t.confirmar().click();
    t.http
      .expectOne(`${URL}/pagamentos`)
      .flush(
        { code: 'PAGAMENTO_EXCEDE_SALDO', message: 'm', traceId: 't' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await new Promise((r) => setTimeout(r, 0));
    t.fixture.detectChanges();
    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain(
      'O valor do pagamento é maior que o saldo devedor.',
    );
    expect(t.close).not.toHaveBeenCalled();
    expect(t.confirmar().disabled).toBe(false);
  });
});
