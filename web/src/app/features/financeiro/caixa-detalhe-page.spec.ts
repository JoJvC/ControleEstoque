import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { hojeLocal } from '../../core/util/data-local';
import { CaixaDetalhePage } from './caixa-detalhe-page';
import { CaixaStore } from './caixa-store';
import { DespesaSheet } from './despesa-sheet';
import { FechamentoSheet } from './fechamento-sheet';
import { LancarDiariasSheet } from './lancar-diarias-sheet';
import { ReabrirCaixaSheet } from './reabrir-caixa-sheet';

const HOJE = hojeLocal();
const ontem = new Date();
ontem.setDate(ontem.getDate() - 1);
const ONTEM = hojeLocal(ontem);
const URL_DETALHE = '/api/financeiro/v1/caixas/cx-1/detalhe';
const URL_VENDAS = '/api/vendas/v1/vendas';
const URL_CANCELAR = `${URL_VENDAS}/v-1/cancelamento`;

function detalhe(status: 'ABERTO' | 'FECHADO', data: string, extra: object = {}) {
  return {
    id: 'cx-1',
    data,
    status,
    saldoInicial: 100,
    entradas: [],
    saidas: [],
    totaisPorForma: [{ forma: 'DINHEIRO', valor: 250 }],
    totalEntradas: 250,
    totalSaidas: 30,
    saldoFinal: 320,
    dinheiroNaGaveta: 320,
    diarias: { lancadas: [], pendentes: false },
    abertura: { por: { id: 'f1', nome: 'Maria' }, em: `${data}T08:00:00` },
    fechamento:
      status === 'FECHADO'
        ? { em: `${data}T18:00:00`, pelaSistema: false, por: { id: 'f2', nome: 'João' } }
        : null,
    ...extra,
  };
}
const VENDA = {
  id: 'v-1',
  clienteId: 'c-1',
  data: `${ONTEM}T10:30:00`,
  totalLiquido: 50,
  cupomEmitido: false,
};

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

async function montar(d: object, permissoes: string[] = ['*'], vendas: object[] = [VENDA]) {
  const abrir = vi.fn().mockReturnValue({ closed: of(true) });
  const confirmar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SheetService, useValue: { abrir, confirmar } },
      { provide: StorageService, useValue: new FakeStorage() },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const router = TestBed.inject(Router);
  const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const navegarUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(CaixaDetalhePage);
  fixture.componentRef.setInput('id', 'cx-1');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const carregarTudo = async (det: object, lista: object[]) => {
    http.expectOne(URL_DETALHE).flush(det);
    await assentar(fixture);
    const req = http.expectOne((r) => r.url === URL_VENDAS);
    expect(req.request.params.get('inicio')).toBe((det as { data: string }).data);
    expect(req.request.params.get('fim')).toBe((det as { data: string }).data);
    expect(req.request.params.get('pageSize')).toBe('200');
    req.flush(lista);
    await assentar(fixture);
  };
  await carregarTudo(d, vendas);
  if (vendas.length) {
    http.expectOne('/api/clientes/v1/clientes/c-1').flush({ id: 'c-1', nome: 'Maria Silva' });
    await assentar(fixture);
  }
  return {
    fixture,
    http,
    el,
    abrir,
    confirmar,
    navegar,
    navegarUrl,
    carregarTudo,
    texto: () => (el.textContent ?? '').replace(/\s+/g, ' '),
    botao: (t: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as
        HTMLButtonElement | undefined,
  };
}

describe('CaixaDetalhePage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('fechamento e reabertura', () => {
    it('pelaSistema: "Fechado pelo sistema à meia-noite"; senão, o nome de quem fechou', async () => {
      const a = await montar(
        detalhe('FECHADO', ONTEM, {
          fechamento: { em: `${ONTEM}T23:59:00`, pelaSistema: true, por: null },
        }),
      );
      expect(a.texto()).toContain('Fechado pelo sistema à meia-noite');
      TestBed.resetTestingModule();
      const b = await montar(detalhe('FECHADO', ONTEM));
      expect(b.texto()).toContain('Fechado por João');
      expect(b.texto()).not.toContain('pelo sistema');
    });

    it('Reabrir caixa: não aparece sem caixa.reabrir nem em caixa ABERTO', async () => {
      const sem = await montar(detalhe('FECHADO', ONTEM), ['vendas.registrar']);
      expect(sem.botao('Reabrir caixa')).toBeUndefined();
      TestBed.resetTestingModule();
      const aberto = await montar(detalhe('ABERTO', HOJE), ['caixa.reabrir']);
      expect(aberto.botao('Reabrir caixa')).toBeUndefined();
    });

    it('Reabrir caixa abre o sheet com o id e, fechando com true, busca o detalhe de novo', async () => {
      const t = await montar(detalhe('FECHADO', ONTEM), ['caixa.reabrir']);
      t.botao('Reabrir caixa')!.click();
      await assentar(t.fixture);
      expect(t.abrir).toHaveBeenCalledWith(ReabrirCaixaSheet, { caixaId: 'cx-1' });
      await t.carregarTudo(detalhe('ABERTO', ONTEM), []);
      expect(t.texto()).toContain('Caixa reaberto');
    });

    it('Lançar diárias só aparece com pelaSistema e pendentes; clicar abre o sheet e recarrega', async () => {
      const pelaSistema = { em: `${ONTEM}T23:59:00`, pelaSistema: true, por: null };
      const semPendentes = await montar(detalhe('FECHADO', ONTEM, { fechamento: pelaSistema }));
      expect(semPendentes.botao('Lançar diárias')).toBeUndefined();
      TestBed.resetTestingModule();
      const aMao = await montar(
        detalhe('FECHADO', ONTEM, { diarias: { lancadas: [], pendentes: true } }),
      );
      expect(aMao.botao('Lançar diárias')).toBeUndefined();
      TestBed.resetTestingModule();
      const t = await montar(
        detalhe('FECHADO', ONTEM, {
          fechamento: pelaSistema,
          diarias: { lancadas: [], pendentes: true },
        }),
      );
      t.botao('Lançar diárias')!.click();
      await assentar(t.fixture);
      expect(t.abrir).toHaveBeenCalledWith(LancarDiariasSheet, { caixaId: 'cx-1' });
      await t.carregarTudo(detalhe('FECHADO', ONTEM, { fechamento: pelaSistema }), []);
    });
  });

  describe('caixa reaberto', () => {
    it('(a) Nova venda neste caixa navega para /vendas/nova com caixa e dataCaixa', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM));
      t.botao('Nova venda neste caixa')!.click();
      expect(t.navegar).toHaveBeenCalledWith(['/vendas/nova'], {
        queryParams: { caixa: 'cx-1', dataCaixa: ONTEM },
      });
    });

    it('(c) Lançar despesa abre o DespesaSheet com { caixaId } e o fechamento do sheet recarrega', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM));
      t.botao('Lançar despesa')!.click();
      await assentar(t.fixture);
      expect(t.abrir).toHaveBeenCalledWith(DespesaSheet, { caixaId: 'cx-1' });
      await t.carregarTudo(detalhe('ABERTO', ONTEM), []);
    });

    it('(d) Fechar caixa busca o resumo da data e abre o FechamentoSheet; o CaixaStore não muda', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM));
      const resumo = { caixa: { id: 'cx-1', data: ONTEM }, saldoParcial: 320, despesas: [] };
      t.botao('Fechar caixa')!.click();
      t.http.expectOne(`/api/financeiro/v1/caixas/${ONTEM}`).flush(resumo);
      await assentar(t.fixture);
      expect(t.abrir).toHaveBeenCalledWith(FechamentoSheet, { caixaId: 'cx-1', resumo });
      expect(TestBed.inject(CaixaStore).resumo()).toBeNull();
      await t.carregarTudo(detalhe('FECHADO', ONTEM), []);
      expect(t.botao('Fechar caixa')).toBeUndefined();
    });

    it('os três botões não aparecem nos modos fechado e hoje', async () => {
      for (const [i, d] of [detalhe('FECHADO', ONTEM), detalhe('ABERTO', HOJE)].entries()) {
        if (i > 0) TestBed.resetTestingModule();
        const t = await montar(d);
        expect(t.botao('Nova venda neste caixa')).toBeUndefined();
        expect(t.botao('Lançar despesa')).toBeUndefined();
        expect(t.botao('Fechar caixa')).toBeUndefined();
      }
    });
  });

  describe('vendas do caixa', () => {
    it('lista hora, cliente e total; Editar navega para /vendas/editar/:id', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM));
      expect(t.texto()).toContain('10:30 · Maria Silva');
      expect(t.texto()).toContain('R$ 50,00');
      t.botao('Editar')!.click();
      expect(t.navegarUrl).toHaveBeenCalledWith('/vendas/editar/v-1');
    });

    it('Editar some com cupom emitido', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM), ['*'], [{ ...VENDA, cupomEmitido: true }]);
      expect(t.botao('Editar')).toBeUndefined();
      expect(t.botao('Cancelar')).toBeTruthy();
    });

    it('Cancelar não aparece sem vendas.cancelar nem no modo fechado', async () => {
      const sem = await montar(detalhe('ABERTO', ONTEM), ['vendas.editar']);
      expect(sem.botao('Cancelar')).toBeUndefined();
      expect(sem.botao('Editar')).toBeTruthy();
      TestBed.resetTestingModule();
      const fechado = await montar(detalhe('FECHADO', ONTEM), ['*']);
      expect(fechado.botao('Cancelar')).toBeUndefined();
      expect(fechado.botao('Editar')).toBeUndefined();
      expect(fechado.texto()).toContain('Maria Silva');
    });

    it('Cancelar com a confirmação negada não faz POST', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM));
      t.confirmar.mockResolvedValue(false);
      t.botao('Cancelar')!.click();
      await assentar(t.fixture);
      expect(t.confirmar).toHaveBeenCalledWith(expect.objectContaining({ perigo: true }));
      t.http.expectNone(URL_CANCELAR);
    });

    it('Cancelar confirmado faz POST com { funcionarioId } e busca detalhe e vendas de novo', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM));
      t.confirmar.mockResolvedValue(true);
      t.botao('Cancelar')!.click();
      await assentar(t.fixture);
      const req = t.http.expectOne(URL_CANCELAR);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ funcionarioId: 'f1' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      await assentar(t.fixture);
      await t.carregarTudo(detalhe('ABERTO', ONTEM), []);
      expect(t.texto()).toContain('Nenhuma venda neste dia.');
    });

    it('409 CAIXA_FECHADO mostra a mensagem inline', async () => {
      const t = await montar(detalhe('ABERTO', ONTEM));
      t.confirmar.mockResolvedValue(true);
      t.botao('Cancelar')!.click();
      await assentar(t.fixture);
      t.http
        .expectOne(URL_CANCELAR)
        .flush(
          { code: 'CAIXA_FECHADO', message: 'x', traceId: 't' },
          { status: 409, statusText: 'Conflict' },
        );
      await assentar(t.fixture);
      expect(t.el.querySelector('[role="alert"]')?.textContent).toContain(
        'O caixa do dia já está fechado.',
      );
    });

    it('no modo hoje, Cancelar também aparece e funciona', async () => {
      const t = await montar(detalhe('ABERTO', HOJE));
      t.confirmar.mockResolvedValue(true);
      t.botao('Cancelar')!.click();
      await assentar(t.fixture);
      t.http.expectOne(URL_CANCELAR).flush(null, { status: 204, statusText: 'No Content' });
      await assentar(t.fixture);
      await t.carregarTudo(detalhe('ABERTO', HOJE), []);
    });
  });
});
