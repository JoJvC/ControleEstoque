import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { ToastService } from '../../core/toast/toast-service';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { FechamentoSheet } from './fechamento-sheet';

const URL = '/api/financeiro/v1/caixas/cx-1/fechamento';
const RESUMO = {
  caixa: {
    id: 'cx-1',
    data: '2026-11-13',
    status: 'ABERTO',
    saldoInicial: 100,
    totalEntradas: null,
    totalSaidas: null,
    saldoFinal: null,
  },
  entradas: 250,
  totalDespesas: 30,
  saldoParcial: 320,
  despesas: [],
};
const func = (id: string, nome: string, ativo: boolean, valorDiaria = 80) => ({
  id,
  nome,
  telefone: null,
  cargoId: 'c-1',
  cargo: 'Entregador',
  valorDiaria,
  ativo,
});

async function montar(lista: 'ok' | 'pendente' | 500 = 'ok') {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [FechamentoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { caixaId: 'cx-1', resumo: RESUMO } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(FechamentoSheet);
  fixture.detectChanges();
  const reqLista = http.expectOne('/api/rh/v1/funcionarios');
  if (lista === 'ok') {
    reqLista.flush([
      func('f-1', 'Ana', true),
      func('f-2', 'Bia', true, 0),
      func('f-3', 'Caio', true),
      func('f-4', 'Davi', false),
    ]);
  } else if (lista === 500) {
    reqLista.flush(
      { code: 'ERRO', message: 'x', traceId: 't' },
      { status: 500, statusText: 'Erro' },
    );
  }
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const caixas = () =>
    Array.from(el.querySelectorAll('ce-checkbox input[type="checkbox"]')) as HTMLInputElement[];
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Fechar caixa',
    ) as HTMLButtonElement;
  return { fixture, el, http, close, caixas, confirmar };
}

describe('FechamentoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const norm = (t: string | null) => (t ?? '').replace(/\s+/g, ' ');

  it('lista só ativos com diária, todos marcados, com o saldo do servidor', async () => {
    const { el, caixas } = await montar();
    expect(caixas().length).toBe(2);
    expect(caixas().every((c) => c.checked)).toBe(true);
    expect(el.textContent).not.toContain('Davi');
    expect(el.textContent).not.toContain('Bia');
    const texto = norm(el.textContent);
    expect(texto).toContain('Saldo do caixa agora (servidor)');
    expect(texto).toContain('R$ 320,00');
    expect(texto).toContain('− R$ 160,00 (2)');
    expect(texto).toContain('O resumo final vem do servidor ao confirmar.');
  });

  it('cada linha mostra nome, cargo e "R$ diária"', async () => {
    const { el } = await montar();
    const itens = Array.from(el.querySelectorAll('ce-checkbox')).map((c) =>
      norm(c.textContent).trim(),
    );
    expect(itens[0]).toContain('Ana · Entregador · R$ 80,00 diária');
  });

  it('clicar numa caixa atualiza total e contagem; confirmar envia só os marcados e avisa', async () => {
    const { fixture, el, http, close, caixas, confirmar } = await montar();
    caixas()[1].click();
    await fixture.whenStable();
    expect(norm(el.textContent)).toContain('− R$ 80,00 (1)');
    confirmar().click();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ diarias: [{ funcionarioId: 'f-1' }] });
    const resposta = { caixaId: 'cx-1', diariasLancadas: 1, saldoFinal: 240 };
    req.flush(resposta);
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(resposta);
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => norm(t.message)),
    ).toContain('Caixa fechado. Saldo final R$ 240,00');
  });

  it('400 FUNCIONARIO_DUPLICADO mostra role=alert com Tentar de novo e Voltar ao caixa', async () => {
    const { fixture, el, http, close, confirmar } = await montar();
    confirmar().click();
    http
      .expectOne(URL)
      .flush(
        { code: 'FUNCIONARIO_DUPLICADO', message: 'x', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(el.querySelector('p[role="alert"]')).toBeTruthy();
    const textos = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(textos).toContain('Tentar de novo');
    expect(textos).toContain('Voltar ao caixa');
    expect(close).not.toHaveBeenCalled();
  });

  it('409 CAIXA_JA_FECHADO mostra o bloco de alerta e "Voltar ao caixa" fecha', async () => {
    const { fixture, el, http, close, confirmar } = await montar();
    confirmar().click();
    http
      .expectOne(URL)
      .flush(
        { code: 'CAIXA_JA_FECHADO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'O caixa do dia já está fechado.',
    );
    expect(el.querySelector('.alerta[role="alert"]')).toBeTruthy();
    expect(close).not.toHaveBeenCalled();
    (
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Voltar ao caixa'),
      ) as HTMLButtonElement
    ).click();
    expect(close).toHaveBeenCalledWith();
  });

  it('com a lista de funcionários pendente, Confirmar fechamento fica desabilitado e não envia', async () => {
    const { confirmar } = await montar('pendente');
    expect(confirmar().disabled).toBe(true);
    confirmar().click();
  });

  it('com a lista falhando (500), mostra alerta, não envia e Tentar de novo recarrega', async () => {
    const { fixture, el, http, confirmar } = await montar(500);
    expect(confirmar().disabled).toBe(true);
    confirmar().click();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível');
    const tentar = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tentar de novo'),
    ) as HTMLButtonElement;
    tentar.click();
    http.expectOne('/api/rh/v1/funcionarios').flush([func('f-1', 'Ana', true)]);
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
    expect(confirmar().disabled).toBe(false);
  });
});
