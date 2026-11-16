import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { PedidosListaPage } from './pedidos-lista-page';

const PEDIDOS = '/api/vendas/v1/pedidos';
const CLIENTES = '/api/clientes/v1/clientes';
const resumo = (
  id: string,
  clienteId: string,
  status: string,
  observacao: string | null = null,
) => ({
  id,
  clienteId,
  enderecoEntregaId: null,
  status,
  observacao,
  createdAt: '2026-03-05T10:30:00Z',
  iniciadoEm: null,
  canceladoEm: null,
});
const cliente = (id: string, nome: string) => ({
  id,
  nome,
  telefone: null,
  observacoes: null,
  enderecos: [],
});

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

async function montar(permissoes: string[] = ['*']) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PedidosListaPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const pilula = (rotulo: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.pilula')).find(
      (b) => b.textContent?.trim() === rotulo,
    )!;
  const linhas = () => Array.from(el.querySelectorAll('ce-list-item'));
  const novo = () =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Novo pedido'));
  return { fixture, el, http, navegar, pilula, linhas, novo };
}

describe('PedidosListaPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('abre em Todos, lista com nome do cliente e status; linha mostra data e observação', async () => {
    const t = await montar();
    const req = t.http.expectOne((r) => r.url === PEDIDOS);
    expect(req.request.params.has('status')).toBe(false);
    req.flush([resumo('p-1', 'c-1', 'PENDENTE', 'entregar cedo')]);
    t.http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    expect(t.pilula('Todos').getAttribute('aria-pressed')).toBe('true');
    expect(t.linhas()).toHaveLength(1);
    const texto = t.linhas()[0].textContent!;
    expect(texto).toContain('Ana');
    expect(texto).toContain('Pendente');
    expect(texto).toContain('entregar cedo');
    expect(lerPadraoPagina(t.el).cabecalhos).toBe(1);
  });

  it('clique em Pendentes filtra por status e marca a pílula', async () => {
    const t = await montar();
    t.http.expectOne((r) => r.url === PEDIDOS).flush([]);
    await assentar(t.fixture);

    t.pilula('Pendentes').click();
    const req = t.http.expectOne((r) => r.url === PEDIDOS);
    expect(req.request.urlWithParams).toBe(`${PEDIDOS}?page=1&pageSize=50&status=PENDENTE`);
    req.flush([resumo('p-2', 'c-2', 'PENDENTE')]);
    t.http.expectOne(`${CLIENTES}/c-2`).flush(cliente('c-2', 'Bia'));
    await assentar(t.fixture);
    expect(t.pilula('Pendentes').getAttribute('aria-pressed')).toBe('true');
    expect(t.pilula('Todos').getAttribute('aria-pressed')).toBe('false');
    expect(t.linhas()[0].textContent).toContain('Bia');
  });

  it('vazio mostra a mensagem', async () => {
    const t = await montar();
    t.http.expectOne((r) => r.url === PEDIDOS).flush([]);
    await assentar(t.fixture);
    expect(t.el.textContent).toContain('Nenhum pedido');
  });

  it('erro mostra Tentar novamente, que recarrega', async () => {
    const t = await montar();
    t.http.expectOne((r) => r.url === PEDIDOS).flush(null, { status: 500, statusText: 'x' });
    await assentar(t.fixture);
    expect(t.el.textContent).toContain('Não foi possível carregar');
    Array.from(t.el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Tentar novamente'))!
      .click();
    t.http.expectOne((r) => r.url === PEDIDOS).flush([]);
  });

  it('clique na linha abre o detalhe', async () => {
    const t = await montar();
    t.http.expectOne((r) => r.url === PEDIDOS).flush([resumo('p-1', 'c-1', 'CONCLUIDO')]);
    t.http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    (t.linhas()[0].querySelector('.item') as HTMLElement).click();
    expect(t.navegar).toHaveBeenCalledWith('/pedidos/p-1');
  });

  it('clique em Novo pedido navega para /pedidos/novo; sem vendas.registrar o botão some', async () => {
    const t = await montar(['vendas.registrar']);
    t.http.expectOne((r) => r.url === PEDIDOS).flush([]);
    await assentar(t.fixture);
    t.novo()!.click();
    expect(t.navegar).toHaveBeenCalledWith('/pedidos/novo');

    TestBed.resetTestingModule();
    const s = await montar([]);
    s.http.expectOne((r) => r.url === PEDIDOS).flush([]);
    await assentar(s.fixture);
    expect(s.novo()).toBeUndefined();
  });
});
