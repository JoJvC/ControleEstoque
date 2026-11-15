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
const URL_CAS = '/api/clientes/v1/relatorios/cascos/total';
const URL_FIADO = '/api/financeiro/v1/relatorios/fiado/total';
const URL_EST = '/api/estoque/v1/relatorios/estoque';
const URL_VENDAS = '/api/vendas/v1/vendas';
const URL_CLIENTE = '/api/clientes/v1/clientes/c-1';
const VENDA = {
  id: 'v-1',
  clienteId: 'c-1',
  data: `${HOJE}T10:30:00`,
  totalLiquido: 50,
  statusPagamento: 'PARCIAL',
};

const RESUMO = {
  caixa: { id: 'cx-1', data: HOJE, status: 'ABERTO', saldoInicial: 100 },
  entradas: 0,
  totalDespesas: 0,
  saldoParcial: 100,
  despesas: [],
};
const FAT = {
  totalLiquido: 1234.5,
  recebido: 90,
  fiadoGerado: 40,
  porCategoria: [
    { categoria: 'GELO', quantidade: 12, totalLiquido: 120 },
    { categoria: 'CARVAO', quantidade: 3, totalLiquido: 60 },
  ],
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

async function montar(
  o: {
    caixa?: Resp;
    fat?: Resp;
    est?: Resp;
    cas?: Resp;
    fiado?: Resp;
    vendas?: Resp;
    permissoes?: string[];
    pendentes?: boolean;
  } = {},
) {
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
  const reqCaixa = http.expectOne(URL_CAIXA);
  const reqCas = http.expectOne(URL_CAS);
  const reqFiado = http.expectOne(URL_FIADO);
  const fat = http.expectOne(
    (r) => r.url === URL_FAT && r.params.get('inicio') === HOJE && r.params.get('fim') === HOJE,
  );
  const reqEst = http.expectOne(URL_EST);
  const reqVendas = http.expectOne(
    (r) =>
      r.url === URL_VENDAS &&
      r.params.get('page') === '1' &&
      r.params.get('pageSize') === '5' &&
      r.params.get('inicio') === HOJE &&
      r.params.get('fim') === HOJE &&
      !r.params.has('clienteId'),
  );
  const el = fixture.nativeElement as HTMLElement;
  if (o.pendentes) return { el, botao: () => undefined, navegar, texto: () => el.textContent };
  responder(reqCaixa, o.caixa ?? RESUMO, o.caixa === 404 ? 'CAIXA_NAO_ENCONTRADO' : undefined);
  responder(fat, o.fat ?? FAT);
  responder(reqCas, o.cas ?? { totalCascos: 7 });
  responder(reqFiado, o.fiado ?? { totalAReceber: 350 });
  responder(reqEst, o.est ?? { itens: [], alertasEstoqueMinimo: [] });
  responder(reqVendas, o.vendas ?? []);
  await assentar(fixture);
  if (o.vendas && typeof o.vendas !== 'number') {
    responder(http.expectOne(URL_CLIENTE), { id: 'c-1', nome: 'Maria Silva' });
    await assentar(fixture);
  }
  return {
    el,
    navegar,
    texto: () => el.textContent?.replace(/\s/g, ' '),
    botao: (t: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(t)),
  };
}

describe('HomePage', () => {
  it('total vendido em BRL', async () => {
    const { el } = await montar();
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('R$ 1.234,50');
  });

  it('hero, cascos e fiado exibem exatamente o que o servidor respondeu', async () => {
    const { el } = await montar();
    const saidas = Array.from(el.querySelectorAll('.hero__saida')).map((e) =>
      e.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(saidas).toEqual(['GELO12', 'CARVAO3']);
    expect(el.querySelector('.cartao--casco .cartao__valor')?.textContent?.trim()).toBe('7');
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('R$ 350,00');
  });

  it('fiado total > 0 fica no tom fiado', async () => {
    const { el } = await montar();
    expect(el.querySelector('.cartao--fiado')).not.toBeNull();
    expect(el.querySelector('.cartao--pago')).toBeNull();
  });

  it('fiado total 0 mostra "Em dia" no tom pago', async () => {
    const { el } = await montar({ fiado: { totalAReceber: 0 } });
    expect(el.querySelector('.cartao--pago')?.textContent).toContain('Em dia');
    expect(el.querySelector('.cartao--fiado')).toBeNull();
  });

  it('carregando antes de responder', async () => {
    const { el } = await montar({ pendentes: true });
    expect(el.querySelectorAll('ce-skeleton').length).toBe(5);
  });

  it('falha isolada: cascos 500, resto renderiza', async () => {
    const { el, texto } = await montar({
      cas: 500,
      est: { itens: [], alertasEstoqueMinimo: [ITEM] },
    });
    expect(el.querySelector('.cartao--casco')?.textContent).toContain('Não foi possível carregar');
    expect(texto()).toContain('Recebido R$ 90,00');
    expect(texto()).toContain('R$ 350,00');
    expect(el.textContent).toContain('Cerveja X');
  });

  it('falha isolada: fiado 500, resto renderiza', async () => {
    const { el } = await montar({ fiado: 500 });
    expect(el.querySelector('[aria-label="Fiado a receber"]')?.textContent).toContain(
      'Não foi possível carregar',
    );
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('R$ 1.234,50');
    expect(el.querySelector('.cartao--casco .cartao__valor')?.textContent?.trim()).toBe('7');
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
    const { el, texto } = await montar({
      fat: 500,
      est: { itens: [], alertasEstoqueMinimo: [ITEM] },
    });
    expect(el.textContent).toContain('Não foi possível carregar o total');
    expect(texto()).toContain('R$ 100,00');
    expect(el.textContent).toContain('Cerveja X');
  });

  it('só vendas.registrar', async () => {
    const { botao } = await montar({ permissoes: ['vendas.registrar'] });
    expect(botao('Nova venda')).toBeDefined();
  });

  it('clique em Nova venda navega', async () => {
    const { botao, navegar } = await montar();
    botao('Nova venda')!.click();
    expect(navegar).toHaveBeenCalledWith('/vendas/nova');
  });

  it('Recebido e Fiado gerado vêm da raiz do faturamento, sem somar', async () => {
    const { texto } = await montar();
    expect(texto()).toContain('Recebido R$ 90,00');
    expect(texto()).toContain('Fiado gerado R$ 40,00');
  });

  it('clique em Repor navega com rotaRepor(id)', async () => {
    const { botao, navegar } = await montar({
      est: { itens: [], alertasEstoqueMinimo: [ITEM] },
    });
    botao('Repor')!.click();
    expect(navegar).toHaveBeenCalledWith('/estoque/abastecimento?produtoId=p-1');
  });

  it('Repor oculto sem estoque.editar, lista visível', async () => {
    const { botao, el } = await montar({
      permissoes: ['vendas.registrar'],
      est: { itens: [], alertasEstoqueMinimo: [ITEM] },
    });
    expect(botao('Repor')).toBeUndefined();
    expect(el.textContent).toContain('Cerveja X');
  });

  it('falha isolada: estoque 500, faturamento, fiado e cascos renderizam', async () => {
    const { el, texto } = await montar({ est: 500 });
    expect(el.textContent).toContain('Não foi possível carregar o estoque');
    expect(texto()).toContain('Recebido R$ 90,00');
    expect(texto()).toContain('R$ 350,00');
    expect(el.querySelector('.cartao--casco .cartao__valor')?.textContent?.trim()).toBe('7');
  });

  it('caixa aberto: botão com o saldo do servidor leva a /financeiro/caixa', async () => {
    const { el, navegar } = await montar();
    const caixa = el.querySelector('.home__caixa') as HTMLElement;
    expect(caixa.textContent?.replace(/\s/g, ' ')).toContain('R$ 100,00');
    caixa.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixa');
  });

  it('caixa não aberto (404): botão mostra Fechado e ainda leva ao caixa', async () => {
    const { botao, navegar } = await montar({ caixa: 404 });
    botao('Fechado')!.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixa');
  });

  it('caixa FECHADO com resumo: mostra Fechado, sem saldo, e vai ao caixa', async () => {
    const { el, navegar } = await montar({
      caixa: { ...RESUMO, caixa: { ...RESUMO.caixa, status: 'FECHADO' } },
    });
    const b = el.querySelector('.home__caixa') as HTMLElement;
    expect(b.textContent).toContain('Fechado');
    expect(b.textContent).not.toContain('100');
    expect(b.getAttribute('aria-label')).toBe('Caixa: Fechado');
    b.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixa');
  });

  it('caixa 500: botão mostra Caixa e vai ao caixa', async () => {
    const { el, navegar } = await montar({ caixa: 500 });
    const b = el.querySelector('.home__caixa') as HTMLElement;
    expect(b.textContent?.trim()).toBe('Caixa');
    b.click();
    expect(navegar).toHaveBeenCalledWith('/financeiro/caixa');
  });

  it('vazio de últimas vendas: Fazer a primeira venda abre /vendas/nova', async () => {
    const { botao, navegar } = await montar();
    botao('Fazer a primeira venda')!.click();
    expect(navegar).toHaveBeenCalledWith('/vendas/nova');
  });

  it('não há mais Caixa de hoje nem Atalhos', async () => {
    const { texto } = await montar();
    expect(texto()).not.toContain('Caixa de hoje');
    expect(texto()).not.toContain('Ir para o caixa');
    expect(texto()).not.toContain('Atalhos');
  });

  it('cartões de cascos e fiado abrem Clientes filtrado', async () => {
    const { el, navegar } = await montar();
    (el.querySelector('.cartao--casco') as HTMLElement).click();
    expect(navegar).toHaveBeenCalledWith('/clientes?filtro=casco');
    (el.querySelector('.cartao--fiado') as HTMLElement).click();
    expect(navegar).toHaveBeenCalledWith('/clientes?filtro=fiado');
  });

  it('últimas vendas: linha com cliente, valor e status; clique abre o detalhe', async () => {
    const { el, texto, navegar } = await montar({ vendas: [VENDA] });
    expect(texto()).toContain('Maria Silva');
    expect(texto()).toContain('R$ 50,00');
    expect(texto()).toContain('Parcial');
    (el.querySelector('.ultimas__item') as HTMLElement).click();
    expect(navegar).toHaveBeenCalledWith('/vendas/detalhe/v-1');
  });

  it('últimas vendas vazio mostra o estado do protótipo', async () => {
    const { texto } = await montar();
    expect(texto()).toContain('Dia tranquilo por enquanto');
  });

  it('falha isolada: vendas 500, resto renderiza', async () => {
    const { el, texto } = await montar({ vendas: 500 });
    expect(el.textContent).toContain('Não foi possível carregar as vendas');
    expect(texto()).toContain('Recebido R$ 90,00');
  });

  it('Ver todas abre a lista de vendas', async () => {
    const { botao, navegar } = await montar();
    botao('Ver todas')!.click();
    expect(navegar).toHaveBeenCalledWith('/vendas');
  });
});
