import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { SheetService } from '../../core/overlay/sheet-service';
import { ToastService } from '../../core/toast/toast-service';
import { hojeLocal } from '../../core/util/data-local';
import { CaixaPage } from './caixa-page';
import { DespesaSheet } from './despesa-sheet';
import { FechamentoSheet } from './fechamento-sheet';

const HOJE = hojeLocal();
const BASE = '/api/financeiro/v1';
const URL_RESUMO = `${BASE}/caixas/${HOJE}`;

const CAIXA_ABERTO = {
  id: 'cx-1',
  data: HOJE,
  status: 'ABERTO',
  saldoInicial: 100,
  totalEntradas: null,
  totalSaidas: null,
  saldoFinal: null,
};
const RESUMO_ABERTO = {
  caixa: CAIXA_ABERTO,
  entradas: 250,
  totalDespesas: 30,
  saldoParcial: 320,
  despesas: [
    {
      id: 'd-1',
      tipoDespesaId: 't-1',
      tipoDespesa: 'Luz',
      valor: 30,
      descricao: 'conta de outubro',
    },
  ],
};
const RESUMO_FECHADO = {
  ...RESUMO_ABERTO,
  caixa: {
    ...CAIXA_ABERTO,
    status: 'FECHADO',
    totalEntradas: 250,
    totalSaidas: 30,
    saldoFinal: 320,
  },
};

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

async function montar(resumo: object | 404, permissoes: string[] = ['*']) {
  const abrir = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SheetService, useValue: { abrir } },
      { provide: StorageService, useValue: new FakeStorage() },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(CaixaPage);
  fixture.detectChanges();
  await assentar(fixture);
  const req = http.expectOne(URL_RESUMO);
  if (resumo === 404) {
    req.flush(
      { code: 'CAIXA_NAO_ENCONTRADO', message: 'x', traceId: 't' },
      { status: 404, statusText: 'Not Found' },
    );
  } else {
    req.flush(resumo);
  }
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    http,
    abrir,
    el,
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as
        HTMLButtonElement | undefined,
    toasts: () =>
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message),
  };
}

describe('CaixaPage', () => {
  it('sem caixa.fechar: vê a tela e o lançamento de despesa, mas não Fechar caixa', async () => {
    const { botao } = await montar(RESUMO_ABERTO, []);
    expect(botao('Lançar despesa')).toBeTruthy();
    expect(botao('Fechar caixa')).toBeUndefined();
  });

  it('com caixa.fechar o botão Fechar caixa aparece', async () => {
    const { botao } = await montar(RESUMO_ABERTO, ['caixa.fechar']);
    expect(botao('Fechar caixa')).toBeTruthy();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('nao-aberto: digitar o saldo e clicar "Abrir caixa" faz POST com hojeLocal() e depois GET', async () => {
    const { fixture, http, el, botao } = await montar(404);
    const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
    campo.value = '15000';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    botao('Abrir caixa')!.click();
    const post = http.expectOne(`${BASE}/caixas`);
    expect(post.request.body).toEqual({ data: HOJE, saldoInicial: 150 });
    post.flush(CAIXA_ABERTO, { status: 201, statusText: 'Created' });
    await assentar(fixture);
    http.expectOne(URL_RESUMO).flush(RESUMO_ABERTO);
    await assentar(fixture);
    expect(el.textContent).toContain('Aberto');
  });

  it('nao-aberto: 400 SALDO_INVALIDO aparece inline', async () => {
    const { fixture, http, el, botao } = await montar(404);
    const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
    campo.value = '100';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    botao('Abrir caixa')!.click();
    http
      .expectOne(`${BASE}/caixas`)
      .flush(
        { code: 'SALDO_INVALIDO', message: 'x', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assentar(fixture);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Saldo inicial inválido.');
  });

  it('ABERTO: mostra os valores do resumo e as despesas', async () => {
    const { el, botao } = await montar(RESUMO_ABERTO);
    const texto = (el.textContent ?? '').replace(/\s/g, ' ');
    expect(texto).toContain('Aberto');
    expect(texto).toContain('R$ 100,00');
    expect(texto).toContain('R$ 250,00');
    expect(texto).toContain('R$ 320,00');
    expect(texto).toContain('Luz — conta de outubro');
    expect(botao('Lançar despesa')).toBeTruthy();
    expect(botao('Fechar caixa')).toBeTruthy();
  });

  it('"Lançar despesa" abre DespesaSheet e, ao fechar, consulta de novo', async () => {
    const { fixture, http, abrir, botao, toasts } = await montar(RESUMO_ABERTO);
    abrir.mockReturnValue({ closed: of(true) });
    botao('Lançar despesa')!.click();
    await assentar(fixture);
    expect(abrir).toHaveBeenCalledWith(DespesaSheet, { caixaId: 'cx-1' });
    http.expectOne(URL_RESUMO).flush(RESUMO_ABERTO);
    await assentar(fixture);
    expect(toasts()).toContain('Despesa lançada.');
  });

  it('sheet de despesa cancelado também consulta de novo (CAIXA_FECHADO leva a FECHADO)', async () => {
    const { fixture, http, abrir, botao, el } = await montar(RESUMO_ABERTO);
    abrir.mockReturnValue({ closed: of(undefined) });
    botao('Lançar despesa')!.click();
    await assentar(fixture);
    http.expectOne(URL_RESUMO).flush(RESUMO_FECHADO);
    await assentar(fixture);
    expect(el.textContent).toContain('Fechado');
    expect(botao('Lançar despesa')).toBeUndefined();
  });

  it('"Fechar caixa" abre FechamentoSheet; com resultado mostra o toast e consulta de novo', async () => {
    const { fixture, http, abrir, botao, toasts } = await montar(RESUMO_ABERTO);
    abrir.mockReturnValue({ closed: of({ diariasLancadas: 2 }) });
    botao('Fechar caixa')!.click();
    await assentar(fixture);
    expect(abrir).toHaveBeenCalledWith(FechamentoSheet, {
      caixaId: 'cx-1',
      resumo: RESUMO_ABERTO,
    });
    http.expectOne(URL_RESUMO).flush(RESUMO_FECHADO);
    await assentar(fixture);
    expect(toasts()).toContain('Caixa fechado: 2 diárias lançadas.');
  });

  it('FECHADO: badge, aviso, totais finais e sem os botões de lançar e fechar', async () => {
    const { el, botao } = await montar(RESUMO_FECHADO);
    expect(el.textContent).toContain('Fechado');
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'O caixa do dia já está fechado.',
    );
    expect(el.textContent).toContain('Saldo final');
    expect(botao('Lançar despesa')).toBeUndefined();
    expect(botao('Fechar caixa')).toBeUndefined();
  });
});
