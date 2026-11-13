import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
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

async function montar() {
  const abrir = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SheetService, useValue: { abrir } },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ClienteDetalhePage);
  fixture.componentRef.setInput('id', 'c-1');
  fixture.detectChanges();
  await assentar(fixture);
  http.expectOne(CLIENTE_URL).flush(CLIENTE);
  http.expectOne(SALDOS_URL).flush(SALDOS);
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
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(texto),
      ) as HTMLButtonElement,
    chips: () =>
      Array.from(el.querySelectorAll('ce-saldo-chip')).map((c) => ({
        texto: `${c.querySelector('.chip__rotulo')?.textContent} ${(c.querySelector('.chip__valor')?.textContent ?? '').trim()}`,
        classe: c.querySelector('.chip')?.className ?? '',
      })),
  };
}

describe('ClienteDetalhePage — saldos', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mostra os 3 chips com os valores do GET /saldos e cores distintas', async () => {
    const t = await montar();
    const chips = t.chips();
    expect(chips).toHaveLength(3);
    expect(chips[0].texto).toBe('Cascos 3');
    expect(chips[1].texto).toBe('Sucata entregue 2');
    expect(chips[2].texto).toMatch(/^Fiado R\$\s50,00$/);
    expect(chips[0].classe).toContain('chip--warning');
    expect(chips[1].classe).toContain('chip--neutral');
    expect(chips[2].classe).toContain('chip--danger');
  });

  it.each([
    ['Pagar casco', PagarCascoSheet],
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
    await assentar(t.fixture);
    expect(t.chips()[2].texto).toMatch(/R\$\s0,00$/);
  });

  it('fechar sem resposta não faz GET nem toast', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of(undefined) });
    t.botao('Pagar casco').click();
    await assentar(t.fixture);
    t.http.expectNone(SALDOS_URL);
    expect(t.toasts()).toEqual([]);
  });

  it('erro 4xx nos saldos mostra a mensagem e Tentar novamente recarrega só os saldos', async () => {
    const t = await montar();
    t.abrir.mockReturnValue({ closed: of({ novoSaldoCascos: 1 }) });
    t.botao('Pagar casco').click();
    await assentar(t.fixture);
    t.http
      .expectOne(SALDOS_URL)
      .flush(
        { code: 'CLIENTE_NAO_ENCONTRADO', message: 'x', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
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
        botao: 'Pagar casco',
        resposta: { novoSaldoCascos: 2 },
        saldos: { saldoCascos: 2, sucataEntregue: 2, saldoFiado: 50 },
      },
      {
        botao: 'Pagar casco',
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
      await assentar(t.fixture);
    }
    const chips = t.chips();
    expect(chips[0].texto).toBe('Cascos 0');
    expect(chips[1].texto).toBe('Sucata entregue 5');
    expect(chips[2].texto).toMatch(/^Fiado R\$\s45,00$/);
    expect(t.toasts()).toHaveLength(4);
  });
});
