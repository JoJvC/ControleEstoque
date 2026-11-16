import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { SheetService } from '../../core/overlay/sheet-service';
import { ToastService } from '../../core/toast/toast-service';
import { hojeLocal } from '../../core/util/data-local';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
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

async function montar(
  resumo: object | 404 | 'pendente',
  permissoes: string[] = ['*'],
  desktop = false,
) {
  const abrir = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SheetService, useValue: { abrir } },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => new BehaviorSubject({ matches: desktop }) },
      },
      { provide: StorageService, useValue: new FakeStorage() },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(CaixaPage);
  fixture.detectChanges();
  await assentar(fixture);
  const req = http.expectOne(URL_RESUMO);
  if (resumo === 'pendente') {
    // sem resposta ainda
  } else if (resumo === 404) {
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
    req,
    fixture,
    http,
    abrir,
    navegar,
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

  const norm = (t: string | null) => (t ?? '').replace(/\s+/g, ' ');

  it('ABERTO: chip, rótulo, 3 chips, Entradas e Saídas', async () => {
    const { el } = await montar(RESUMO_ABERTO);
    const texto = norm(el.textContent);
    expect(texto).toContain('Aberto');
    expect(texto).toContain('Saldo do caixa agora');
    expect(texto).toContain('R$ 320,00');
    const chips = Array.from(el.querySelectorAll('.destaque__chips .chip-topo')).map((c) =>
      norm(c.textContent),
    );
    expect(chips).toEqual(['Abertura R$ 100,00', 'Entradas R$ 250,00', 'Saídas R$ 30,00']);
    expect(texto).toContain('Entradas');
    expect(texto).toContain('+ R$ 250,00');
    expect(texto).toContain('Luz');
    expect(texto).toContain('conta de outubro');
    expect(texto).toContain('− R$ 30,00');
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('ABERTO: Fechar caixa no cabeçalho, Lançar despesa no destaque, sem barra de ação', async () => {
    const { el, botao } = await montar(RESUMO_ABERTO);
    expect(lerPadraoPagina(el)).toEqual({
      cabecalhos: 1,
      voltar: true,
      acoes: ['', 'Caixas anteriores', 'Vendas do dia', 'Fechar caixa'],
      barras: 0,
      cancelar: 0,
    });
    expect(el.querySelector('ce-app-header .destaque')?.contains(botao('Lançar despesa')!)).toBe(
      true,
    );
    expect(el.querySelector('header.cabecalho')?.contains(botao('Lançar despesa')!)).toBe(false);
  });

  it('carregando: mostra o skeleton', async () => {
    const { el, req } = await montar('pendente');
    expect(el.querySelector('ce-skeleton')).toBeTruthy();
    req.flush(RESUMO_ABERTO);
  });

  it('listas vazias: textos de vazio', async () => {
    const { el } = await montar({
      ...RESUMO_ABERTO,
      entradas: 0,
      totalDespesas: 0,
      despesas: [],
    });
    expect(el.textContent).toContain('Nenhuma entrada hoje.');
    expect(el.textContent).toContain('Nenhuma saída hoje.');
  });

  it('nao-aberto: clicar sem valor mostra "Informe o saldo inicial."', async () => {
    const { fixture, el, botao } = await montar(404);
    expect(el.textContent).toContain('O caixa de hoje ainda não foi aberto.');
    botao('Abrir caixa')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Informe o saldo inicial.');
  });

  it('nao-aberto: 409 CAIXA_JA_EXISTE recarrega o resumo', async () => {
    const { fixture, http, el, botao } = await montar(404);
    const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
    campo.value = '100';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    botao('Abrir caixa')!.click();
    http
      .expectOne(`${BASE}/caixas`)
      .flush(
        { code: 'CAIXA_JA_EXISTE', message: 'x', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar(fixture);
    http.expectOne(URL_RESUMO).flush(RESUMO_ABERTO);
    await assentar(fixture);
    expect(el.textContent).toContain('Saldo do caixa agora');
  });

  it('celular: voltar aparece', async () => {
    const { el } = await montar(RESUMO_ABERTO, ['*'], false);
    expect(el.querySelector('[aria-label="Voltar"]')).toBeTruthy();
  });

  it('desktop: voltar continua e as duas seções ficam no contêiner de grade', async () => {
    const { el } = await montar(RESUMO_ABERTO, ['*'], true);
    expect(lerPadraoPagina(el).voltar).toBe(true);
    expect(el.querySelectorAll('.secoes > section').length).toBe(2);
  });

  it('clicar em Fechar caixa no cabeçalho abre o sheet de fechamento', async () => {
    const { fixture, http, abrir, el } = await montar(RESUMO_ABERTO);
    abrir.mockReturnValue({ closed: of(undefined) });
    const btn = Array.from(el.querySelectorAll('ce-app-header .cabecalho__acoes button')).find(
      (b) => b.textContent?.includes('Fechar caixa'),
    ) as HTMLButtonElement;
    btn.click();
    await assentar(fixture);
    expect(abrir).toHaveBeenCalledWith(FechamentoSheet, expect.anything());
    http.expectOne(URL_RESUMO).flush(RESUMO_ABERTO);
  });

  it('"Lançar despesa" abre DespesaSheet e, ao fechar, consulta de novo', async () => {
    const { fixture, http, abrir, botao } = await montar(RESUMO_ABERTO);
    abrir.mockReturnValue({ closed: of(true) });
    botao('Lançar despesa')!.click();
    await assentar(fixture);
    expect(abrir).toHaveBeenCalledWith(DespesaSheet, { caixaId: 'cx-1' });
    http.expectOne(URL_RESUMO).flush(RESUMO_ABERTO);
    await assentar(fixture);
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

  it('"Fechar caixa" abre FechamentoSheet e, ao fechar, consulta de novo', async () => {
    const { fixture, http, abrir, botao, el } = await montar(RESUMO_ABERTO);
    abrir.mockReturnValue({ closed: of({ diariasLancadas: 2 }) });
    botao('Fechar caixa')!.click();
    await assentar(fixture);
    expect(abrir).toHaveBeenCalledWith(FechamentoSheet, {
      caixaId: 'cx-1',
      resumo: RESUMO_ABERTO,
    });
    http.expectOne(URL_RESUMO).flush(RESUMO_FECHADO);
    await assentar(fixture);
    expect(el.textContent).toContain('Saldo no fechamento');
  });

  it('a ação "Caixas anteriores" navega para /financeiro/caixas', async () => {
    const { botao, navegar } = await montar(RESUMO_ABERTO);
    botao('Caixas anteriores')!.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixas');
  });

  it('a ação "Vendas do dia" navega para o detalhe do caixa de hoje', async () => {
    const { botao, navegar } = await montar(RESUMO_ABERTO);
    botao('Vendas do dia')!.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixas/cx-1');
  });

  it('caixa fechado pelo sistema com diárias pendentes: aviso e o clique leva ao detalhe', async () => {
    const { el, botao, navegar } = await montar({
      ...RESUMO_ABERTO,
      caixasComDiariasPendentes: [{ id: 'cx-0', data: '2026-11-15' }],
    });
    expect(norm(el.textContent)).toContain(
      'Caixa de 15/11 fechado pelo sistema à meia-noite. Diárias pendentes.',
    );
    botao('Lançar diárias')!.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixas/cx-0');
  });

  it('vários caixas pendentes: o aviso leva à lista de caixas', async () => {
    const { botao, navegar } = await montar({
      ...RESUMO_ABERTO,
      caixasComDiariasPendentes: [
        { id: 'cx-0', data: '2026-11-14' },
        { id: 'cx-2', data: '2026-11-15' },
      ],
    });
    botao('Lançar diárias')!.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixas');
  });

  it('sem caixas pendentes: não há aviso', async () => {
    const { el, botao } = await montar({ ...RESUMO_ABERTO, caixasComDiariasPendentes: [] });
    expect(norm(el.textContent)).not.toContain('fechado pelo sistema');
    expect(botao('Lançar diárias')).toBeUndefined();
  });

  it('FECHADO: chip, rótulo, cartão Caixa fechado e sem ações no cabeçalho', async () => {
    const { el, botao } = await montar(RESUMO_FECHADO);
    const texto = norm(el.textContent);
    expect(texto).toContain('Fechado');
    expect(texto).toContain('Saldo no fechamento');
    expect(el.querySelector('.alerta__titulo')?.textContent?.trim()).toBe('Caixa fechado');
    expect(norm(el.querySelector('[role="status"]')?.textContent ?? '')).toContain('R$ 320,00');
    expect(lerPadraoPagina(el).acoes).toEqual(['', 'Caixas anteriores', 'Vendas do dia']);
    expect(botao('Lançar despesa')).toBeUndefined();
  });
});
