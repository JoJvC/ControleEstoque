import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { hojeLocal } from '../../core/util/data-local';
import { HomePage } from './home-page';

const HOJE = hojeLocal();
const URL_CAIXA = `/api/financeiro/v1/caixas/${HOJE}`;
const URL_FAT = '/api/vendas/v1/relatorios/faturamento';
const URL_EST = '/api/estoque/v1/relatorios/estoque';

const RESUMO = {
  caixa: { id: 'cx-1', data: HOJE, status: 'ABERTO', saldoInicial: 100 },
  entradas: 0,
  totalDespesas: 0,
  saldoParcial: 100,
  despesas: [],
};
const ITEM = { produtoId: 'p-1', nome: 'Cerveja X', quantidade: 2, estoqueMinimo: 5 };

type Resp = object | number;

function responder(req: TestRequest, r: Resp, code?: string) {
  if (typeof r === 'number') {
    req.flush({ code: code ?? 'ERRO', message: 'x', traceId: 't' }, { status: r, statusText: 'x' });
  } else {
    req.flush(r);
  }
}

async function assentar(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  await fixture.whenStable();
}

async function montar(o: { caixa?: Resp; fat?: Resp; est?: Resp; permissoes?: string[] } = {}) {
  TestBed.configureTestingModule({
    providers: [
      { provide: StorageService, useValue: new FakeStorage() },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(o.permissoes ?? ['*']));
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  await assentar(fixture);
  responder(http.expectOne(URL_CAIXA), o.caixa ?? RESUMO, 'CAIXA_NAO_ENCONTRADO');
  const fat = http.expectOne(
    (r) => r.url === URL_FAT && r.params.get('inicio') === HOJE && r.params.get('fim') === HOJE,
  );
  responder(fat, o.fat ?? { totalLiquido: 1234.5 });
  responder(http.expectOne(URL_EST), o.est ?? { itens: [], alertasEstoqueMinimo: [] });
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    navegar,
    botao: (t: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(t)),
  };
}

describe('HomePage', () => {
  it('caixa aberto', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('Caixa aberto');
  });

  it('caixa não aberto (404)', async () => {
    const { el } = await montar({ caixa: 404 });
    expect(el.textContent).toContain('Caixa não aberto');
  });

  it('total vendido em BRL', async () => {
    const { el } = await montar();
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('R$ 1.234,50');
  });

  it('alertas vazios', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('Nenhum produto abaixo do mínimo');
  });

  it('alertas com itens', async () => {
    const { el } = await montar({ est: { itens: [], alertasEstoqueMinimo: [ITEM] } });
    expect(el.textContent).toContain('Cerveja X');
  });

  it('falha isolada: faturamento 500, resto renderiza', async () => {
    const { el } = await montar({ fat: 500, est: { itens: [], alertasEstoqueMinimo: [ITEM] } });
    expect(el.textContent).toContain('Não foi possível carregar o total');
    expect(el.textContent).toContain('Caixa aberto');
    expect(el.textContent).toContain('Cerveja X');
  });

  it('atalhos sem permissão', async () => {
    const { botao } = await montar({ permissoes: [] });
    expect(botao('Nova venda')).toBeUndefined();
    expect(botao('Relatórios')).toBeUndefined();
    expect(botao('Ver relatório de estoque')).toBeUndefined();
  });

  it('só vendas.registrar', async () => {
    const { botao } = await montar({ permissoes: ['vendas.registrar'] });
    expect(botao('Nova venda')).toBeDefined();
    expect(botao('Relatórios')).toBeUndefined();
    expect(botao('Ver relatório de estoque')).toBeUndefined();
  });

  it('todas as permissões', async () => {
    const { botao } = await montar({ permissoes: ['*'] });
    expect(botao('Nova venda')).toBeDefined();
    expect(botao('Relatórios')).toBeDefined();
  });

  it('clique em Nova venda navega', async () => {
    const { botao, navegar } = await montar();
    botao('Nova venda')!.click();
    expect(navegar).toHaveBeenCalledWith('/vendas/nova');
  });

  it('clique em Ver relatório de estoque navega', async () => {
    const { botao, navegar } = await montar();
    botao('Ver relatório de estoque')!.click();
    expect(navegar).toHaveBeenCalledWith('/relatorios/estoque');
  });
});
