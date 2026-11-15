import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { SheetService } from '../../core/overlay/sheet-service';
import { ToastService } from '../../core/toast/toast-service';
import { ClienteDetalhePage } from './cliente-detalhe-page';
import { EntregarSucataSheet } from './entregar-sucata-sheet';
import { PagarCascoSheet } from './pagar-casco-sheet';
import { ReceberFiadoSheet } from './receber-fiado-sheet';

const CLIENTE_URL = '/api/clientes/v1/clientes/c-1';
const SALDOS_URL = `${CLIENTE_URL}/saldos`;
const CLIENTE = { id: 'c-1', nome: 'Maria', telefone: null, observacoes: null, enderecos: [] };
const SALDOS = { saldoCascos: 3, sucataEntregue: 2, saldoFiado: 50 };

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

const HISTORICO = (r: { url: string }) => r.url === '/api/vendas/v1/vendas';
const VENDA = {
  id: 'v-1',
  data: '2026-01-02T10:00:00',
  totalLiquido: 95,
  statusPagamento: 'PAGA',
  cascosDevolvidos: 2,
  sucataEntregue: 1,
};

async function montar(
  permissoes: string[] = ['*'],
  historico: unknown[] = [VENDA],
  opcoes: { desktop?: boolean; filtro?: string } = {},
) {
  const abrir = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: opcoes.desktop === true, breakpoints: {} }) },
      },
      { provide: SheetService, useValue: { abrir } },
      { provide: StorageService, useValue: new FakeStorage() },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const http = TestBed.inject(HttpTestingController);
  vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ClienteDetalhePage);
  fixture.componentRef.setInput('id', 'c-1');
  if (opcoes.filtro) {
    fixture.componentRef.setInput('filtro', opcoes.filtro);
  }
  fixture.detectChanges();
  await assentar(fixture);
  http.expectOne(CLIENTE_URL).flush(CLIENTE);
  http.expectOne(SALDOS_URL).flush(SALDOS);
  http.expectOne(HISTORICO).flush(historico);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    http,
    abrir,
    el,
    toasts: () =>
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message.replace(/\s/g, ' ')),
    historicoPendente: () => http.match(HISTORICO),
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(texto),
      ) as HTMLButtonElement,
    chips: () =>
      Array.from(el.querySelectorAll('.bloco')).map((c) => ({
        texto:
          `${c.querySelector('h2')?.textContent} ${c.querySelector('.bloco__valor')?.textContent}`
            .replace(/\s+/g, ' ')
            .trim(),
        classe: c.className,
      })),
  };
}

describe('ClienteDetalhePage — permissão clientes.cadastrar', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sem a chave: Editar e Adicionar endereço somem; ações financeiras continuam', async () => {
    const t = await montar([]);
    expect(t.botao('Editar')).toBeUndefined();
    expect(t.botao('Adicionar')).toBeUndefined();
    expect(t.botao('Receber fiado')).toBeTruthy();
  });

  it('com clientes.cadastrar: Editar navega para a edição e Adicionar abre a sheet de endereço', async () => {
    const t = await montar(['clientes.cadastrar']);
    t.abrir.mockReturnValue({ closed: of(undefined) });
    t.botao('Editar').click();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/clientes/c-1/editar');
    t.botao('Adicionar').click();
    expect(t.abrir).toHaveBeenCalled();
  });
});

describe('ClienteDetalhePage — saldos', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mostra os 3 blocos com os valores do GET /saldos e cores distintas', async () => {
    const t = await montar();
    const chips = t.chips();
    expect(chips).toHaveLength(3);
    expect(chips[0].texto).toContain('Cascos com ele 3');
    expect(chips[1].texto).toMatch(/^Fiado R\$\s50,00$/);
    expect(chips[2].texto).toContain('Sucata entregue 2');
    expect(chips[0].classe).toContain('bloco--casco');
    expect(chips[1].classe).toContain('bloco--fiado');
    expect(chips[2].classe).toContain('bloco--sucata');
    expect(t.el.textContent).not.toMatch(/\b5\b/); // 3 + 2: nada somado
  });

  it('cada tile mostra legenda e botão: texto fixo dos 3 rótulos e das duas legendas', async () => {
    const t = await montar();
    const tiles = Array.from(t.el.querySelectorAll('.bloco')).map((c) =>
      (c.textContent ?? '').replace(/\s+/g, ' '),
    );
    expect(tiles[0]).toContain('contagem de galões');
    expect(tiles[0]).toContain('Recolher cascos');
    expect(tiles[1]).toContain('dinheiro a receber');
    expect(tiles[1]).toContain('Receber fiado');
    expect(tiles[2]).toContain('Entregar sucata');
    expect(t.botao('Recolher cascos').disabled).toBe(false);
    expect(t.botao('Receber fiado').disabled).toBe(false);
  });

  it('Recolher cascos e Receber fiado ficam desabilitados com saldo 0; Entregar sucata não', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of({ novoSaldoCascos: 0, novoSaldoFiado: 0 }) });
    t.botao('Receber fiado').click();
    await assentar(t.fixture);
    t.http.expectOne(SALDOS_URL).flush({ saldoCascos: 0, sucataEntregue: 0, saldoFiado: 0 });
    t.historicoPendente().forEach((r) => r.flush([]));
    await assentar(t.fixture);
    expect(t.botao('Recolher cascos').disabled).toBe(true);
    expect(t.botao('Receber fiado').disabled).toBe(true);
    expect(t.botao('Entregar sucata').disabled).toBe(false);
  });

  it.each([
    ['Recolher cascos', PagarCascoSheet],
    ['Entregar sucata', EntregarSucataSheet],
    ['Receber fiado', ReceberFiadoSheet],
  ])('o botão %s abre a sheet certa com { clienteId }', async (texto, sheet) => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of(undefined) });
    t.botao(texto).click();
    await assentar(t.fixture);
    expect(t.abrir).toHaveBeenCalledWith(sheet, { clienteId: 'c-1' });
  });

  it('fechar com resposta mostra o toast e faz novo GET /saldos', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of({ novoSaldoFiado: 0 }) });
    t.botao('Receber fiado').click();
    await assentar(t.fixture);
    expect(t.toasts()).toContain('Pagamento registrado. Fiado: R$ 0,00.');
    t.http.expectOne(SALDOS_URL).flush({ ...SALDOS, saldoFiado: 0 });
    t.historicoPendente().forEach((r) => r.flush([]));
    await assentar(t.fixture);
    expect(t.chips()[1].texto).toMatch(/R\$\s0,00$/);
  });

  it('fechar sem resposta não faz GET nem toast', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of(undefined) });
    t.botao('Recolher cascos').click();
    await assentar(t.fixture);
    t.http.expectNone(SALDOS_URL);
    expect(t.toasts()).toEqual([]);
  });

  it('erro 4xx nos saldos mostra a mensagem e Tentar novamente recarrega só os saldos', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of({ novoSaldoCascos: 1 }) });
    t.botao('Recolher cascos').click();
    await assentar(t.fixture);
    t.http
      .expectOne(SALDOS_URL)
      .flush(
        { code: 'CLIENTE_NAO_ENCONTRADO', message: 'x', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    t.historicoPendente().forEach((r) => r.flush([]));
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('Cliente não encontrado.');

    t.botao('Tentar novamente').click();
    t.http.expectOne(SALDOS_URL).flush(SALDOS);
    await assentar(t.fixture);
    expect(t.chips()).toHaveLength(3);
  });

  it('sequência devolução → conversão → sucata com crédito → fiado termina com os chips do último GET /saldos', async () => {
    const t = await montar();
    const passos = [
      {
        botao: 'Recolher cascos',
        resposta: { novoSaldoCascos: 2 },
        saldos: { saldoCascos: 2, sucataEntregue: 2, saldoFiado: 50 },
      },
      {
        botao: 'Recolher cascos',
        resposta: { novoSaldoCascos: 0, novoSaldoFiado: 110 },
        saldos: { saldoCascos: 0, sucataEntregue: 2, saldoFiado: 110 },
      },
      {
        botao: 'Entregar sucata',
        resposta: { totalSucataEntregue: 5, novoSaldoFiado: 95 },
        saldos: { saldoCascos: 0, sucataEntregue: 5, saldoFiado: 95 },
      },
      {
        botao: 'Receber fiado',
        resposta: { novoSaldoFiado: 45 },
        saldos: { saldoCascos: 0, sucataEntregue: 5, saldoFiado: 45 },
      },
    ];
    for (const passo of passos) {
      t.abrir.mockReturnValue({ closed: of(passo.resposta) });
      t.botao(passo.botao).click();
      await assentar(t.fixture);
      t.http.expectOne(SALDOS_URL).flush(passo.saldos);
      t.historicoPendente().forEach((r) => r.flush([]));
      await assentar(t.fixture);
    }
    const chips = t.chips();
    expect(chips[0].texto).toContain('Cascos com ele 0');
    expect(chips[1].texto).toMatch(/^Fiado R\$\s45,00$/);
    expect(chips[2].texto).toContain('Sucata entregue 5');
    expect(t.toasts()).toHaveLength(4);
  });
});

describe('ClienteDetalhePage — design Depósito', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('desenha 3 galões tracejados (saldo 3) sem excedente', async () => {
    const t = await montar();
    expect(t.el.querySelectorAll('.bloco--casco ce-icon.galao')).toHaveLength(3);
    expect(t.el.querySelector('.galoes__excedente')).toBeNull();
  });

  it('saldo 13: 10 galões e "+3"', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of({ novoSaldoCascos: 13 }) });
    t.botao('Recolher cascos').click();
    await assentar(t.fixture);
    t.http.expectOne(SALDOS_URL).flush({ ...SALDOS, saldoCascos: 13 });
    t.historicoPendente().forEach((r) => r.flush([]));
    await assentar(t.fixture);
    expect(t.el.querySelectorAll('.bloco--casco ce-icon.galao')).toHaveLength(10);
    expect(t.el.querySelector('.galoes__excedente')?.textContent).toBe('+3');
  });

  it('saldo 0: sem galões e "Nenhum casco com ele"', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of({ novoSaldoCascos: 0 }) });
    t.botao('Recolher cascos').click();
    await assentar(t.fixture);
    t.http.expectOne(SALDOS_URL).flush({ ...SALDOS, saldoCascos: 0 });
    t.historicoPendente().forEach((r) => r.flush([]));
    await assentar(t.fixture);
    expect(t.el.querySelectorAll('ce-icon.galao')).toHaveLength(0);
    expect(t.el.querySelector('.bloco--casco')?.textContent).toContain('Nenhum casco com ele');
  });

  it('fechar Recolher cascos e Receber fiado recarrega saldos e histórico', async () => {
    const t = await montar();
    for (const texto of ['Recolher cascos', 'Receber fiado']) {
      t.abrir.mockReturnValue({ closed: of({ novoSaldoCascos: 1, novoSaldoFiado: 1 }) });
      t.botao(texto).click();
      await assentar(t.fixture);
      t.http.expectOne(SALDOS_URL).flush(SALDOS);
      t.http.expectOne(HISTORICO).flush([]);
      await assentar(t.fixture);
    }
  });

  it('Vender navega para /vendas/nova com ?cliente; sem vendas.registrar não aparece', async () => {
    const t = await montar();
    t.botao('Vender').click();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/vendas/nova'], {
      queryParams: { cliente: 'c-1' },
    });
    TestBed.resetTestingModule();
    const sem = await montar(['clientes.cadastrar']);
    expect(sem.botao('Vender')).toBeUndefined();
  });

  it('celular: a barra tem Vender e Repetir; Repetir navega com cliente e repetirUltima', async () => {
    const t = await montar();
    const barra = t.el.querySelector('ce-barra-acao')!;
    expect(barra.textContent).toContain('Vender');
    barra.querySelector<HTMLButtonElement>('button[aria-label="Repetir última venda"]')!.click();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/vendas/nova'], {
      queryParams: { cliente: 'c-1', repetirUltima: '1' },
    });
    expect(t.el.querySelector('button[aria-label="Voltar"]')).not.toBeNull();
  });

  it('celular sem vendas.registrar: a barra não tem Vender nem Repetir', async () => {
    const t = await montar(['clientes.cadastrar']);
    expect(t.el.querySelector('button[aria-label="Repetir última venda"]')).toBeNull();
  });

  it('desktop: sem barra e sem Voltar; Vender no cabeçalho, sem Repetir', async () => {
    const t = await montar(['*'], [VENDA], { desktop: true });
    expect(t.el.querySelector('ce-barra-acao')).toBeNull();
    expect(t.el.querySelector('button[aria-label="Voltar"]')).toBeNull();
    expect(t.el.querySelector('button[aria-label="Repetir última venda"]')).toBeNull();
    expect(t.el.querySelector('ce-app-header')!.textContent).toContain('Vender');
    t.botao('Vender').click();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/vendas/nova'], {
      queryParams: { cliente: 'c-1' },
    });
  });

  it('trocar o id recarrega cliente, saldos e vendas', async () => {
    const t = await montar();
    t.fixture.componentRef.setInput('id', 'c-2');
    t.fixture.detectChanges();
    await assentar(t.fixture);
    t.http.expectOne('/api/clientes/v1/clientes/c-2').flush({ ...CLIENTE, id: 'c-2', nome: 'Ana' });
    t.http.expectOne('/api/clientes/v1/clientes/c-2/saldos').flush(SALDOS);
    t.http.expectOne(HISTORICO).flush([]);
    await assentar(t.fixture);
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Ana');
  });

  it('Voltar leva à lista com o chip de origem; sem filtro, a /clientes', async () => {
    const t = await montar(['*'], [VENDA], { filtro: 'fiado' });
    t.el.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]')!.click();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/clientes?filtro=fiado');
    TestBed.resetTestingModule();
    const sem = await montar();
    sem.el.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]')!.click();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/clientes');
  });

  it('histórico lista a venda, mostra chips separados e o clique navega', async () => {
    const t = await montar();
    const item = t.el.querySelector<HTMLButtonElement>('.venda')!;
    expect(item.textContent).toContain('Paga');
    expect(item.textContent).not.toContain('PAGA');
    expect(item.textContent).toContain('Cascos devolvidos 2');
    expect(item.textContent).toContain('Sucata 1');
    expect(item.textContent).not.toMatch(/\b3\b/);
    item.click();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/vendas/detalhe/v-1');
  });

  it('histórico vazio mostra "Sem vendas registradas"', async () => {
    const t = await montar(['*'], []);
    expect(t.el.textContent).toContain('Sem vendas registradas');
  });

  it('histórico com erro mostra Tentar novamente que recarrega', async () => {
    const t = await montar(['*'], []);
    t.fixture.componentInstance['carregarHistorico']();
    t.http.expectOne(HISTORICO).flush(null, { status: 500, statusText: 'x' });
    await assentar(t.fixture);
    expect(t.el.textContent).toContain('Não foi possível carregar o histórico.');
    const tentar = Array.from(t.el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    tentar[tentar.length - 1].click();
    t.http.expectOne(HISTORICO).flush([]);
    await assentar(t.fixture);
    expect(t.el.textContent).toContain('Sem vendas registradas');
  });
});
