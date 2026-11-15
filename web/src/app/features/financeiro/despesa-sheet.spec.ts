import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { ToastService } from '../../core/toast/toast-service';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { DespesaSheet } from './despesa-sheet';

const BASE = '/api/financeiro/v1';
const TIPOS = [
  { id: 't-1', nome: 'Luz' },
  { id: 't-2', nome: 'Água' },
];

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [DespesaSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { caixaId: 'cx-1' } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(DespesaSheet);
  fixture.detectChanges();
  http.expectOne(`${BASE}/tipos-despesa`).flush(TIPOS);
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const botao = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    ) as HTMLButtonElement;
  const digitar = async (seletor: string, valor: string) => {
    const campo = el.querySelector(seletor) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const pilula = (nome: string) =>
    Array.from(el.querySelectorAll('[role="radio"]')).find((b) =>
      b.textContent?.includes(nome),
    ) as HTMLButtonElement;
  const escolherTipo = async (id: string) => {
    pilula(TIPOS.find((t) => t.id === id)!.nome).click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, el, http, close, botao, digitar, escolherTipo, pilula };
}

describe('DespesaSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('pílula muda o aria-checked; botão só habilita com tipo e valor > 0', async () => {
    const { fixture, el, botao, digitar, escolherTipo, pilula } = await montar();
    expect(el.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Tipo de despesa',
    );
    expect(pilula('Luz').getAttribute('aria-checked')).toBe('false');
    await digitar('ce-money-input input', '0');
    fixture.detectChanges();
    expect(botao('Lançar saída').disabled).toBe(true);
    await digitar('ce-money-input input', '4550');
    fixture.detectChanges();
    expect(botao('Lançar saída').disabled).toBe(true);
    await escolherTipo('t-1');
    expect(pilula('Luz').getAttribute('aria-checked')).toBe('true');
    expect(pilula('Água').getAttribute('aria-checked')).toBe('false');
    expect(botao('Lançar saída').disabled).toBe(false);
    expect(botao('Lançar saída').textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Lançar saída R$ 45,50',
    );
  });

  it('lançar envia {tipoDespesaId, valor, descricao}, avisa e fecha com true', async () => {
    const { fixture, http, close, botao, digitar, escolherTipo } = await montar();
    await escolherTipo('t-1');
    await digitar('ce-money-input input', '2500');
    await digitar('input[placeholder="Opcional"]', ' Conta ');
    fixture.detectChanges();
    botao('Lançar saída').click();
    await fixture.whenStable();
    const req = http.expectOne(`${BASE}/caixas/cx-1/despesas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipoDespesaId: 't-1', valor: 25, descricao: 'Conta' });
    req.flush(null, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(true);
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message.replace(/\s/g, ' ')),
    ).toContain('Despesa lançada: R$ 25,00');
  });

  it('criação rápida: POST /tipos-despesa, recarrega a lista e seleciona o novo tipo', async () => {
    const { fixture, el, http, botao, digitar } = await montar();
    await digitar('.novo-tipo input', 'Internet');
    botao('Criar tipo').click();
    const post = http.expectOne(`${BASE}/tipos-despesa`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ nome: 'Internet' });
    post.flush({ id: 't-3', nome: 'Internet' }, { status: 201, statusText: 'Created' });
    await new Promise((r) => setTimeout(r, 0));
    http.expectOne(`${BASE}/tipos-despesa`).flush([...TIPOS, { id: 't-3', nome: 'Internet' }]);
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      Array.from(el.querySelectorAll('[role="radio"]'))
        .find((b) => b.textContent?.includes('Internet'))
        ?.getAttribute('aria-checked'),
    ).toBe('true');
  });

  it.each([
    [400, 'VALOR_INVALIDO', 'Valor deve ser positivo.'],
    [422, 'TIPO_DESPESA_INEXISTENTE', 'Tipo de despesa não encontrado.'],
  ])('%i %s aparece inline, sem bloco de alerta, e não fecha', async (status, code, mensagem) => {
    const { fixture, el, http, close, botao, digitar, escolherTipo } = await montar();
    await escolherTipo('t-1');
    await digitar('ce-money-input input', '2500');
    botao('Lançar saída').click();
    http
      .expectOne(`${BASE}/caixas/cx-1/despesas`)
      .flush({ code, message: 'x', traceId: 't' }, { status, statusText: 'Erro' });
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(mensagem);
    expect(el.querySelector('.alerta')).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });

  it('409 CAIXA_FECHADO mostra o bloco de alerta e "Voltar ao caixa" fecha o sheet', async () => {
    const { fixture, el, http, close, botao, digitar, escolherTipo } = await montar();
    await escolherTipo('t-1');
    await digitar('ce-money-input input', '2500');
    botao('Lançar saída').click();
    http
      .expectOne(`${BASE}/caixas/cx-1/despesas`)
      .flush(
        { code: 'CAIXA_FECHADO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    const alerta = el.querySelector('.alerta[role="alert"]');
    expect(alerta?.textContent).toContain('O caixa do dia já está fechado.');
    expect(close).not.toHaveBeenCalled();
    botao('Voltar ao caixa').click();
    expect(close).toHaveBeenCalledWith();
  });

  it('Enter em "Novo tipo" cria o tipo e não lança a despesa', async () => {
    const { fixture, el, http, digitar } = await montar();
    await digitar('.novo-tipo input', 'Internet');
    (el.querySelector('.novo-tipo input') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    const post = http.expectOne(`${BASE}/tipos-despesa`);
    expect(post.request.method).toBe('POST');
    post.flush({ id: 't-3', nome: 'Internet' }, { status: 201, statusText: 'Created' });
    await new Promise((r) => setTimeout(r, 0));
    http.expectOne(`${BASE}/tipos-despesa`).flush(TIPOS);
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
  });
});
