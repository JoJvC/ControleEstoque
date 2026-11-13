import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
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
  const escolherTipo = async (valor: string) => {
    const select = el.querySelector('ce-select select') as HTMLSelectElement;
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  return { fixture, el, http, close, botao, digitar, escolherTipo };
}

describe('DespesaSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('escolher tipo, digitar valor e lançar faz POST e fecha com true', async () => {
    const { fixture, http, close, botao, digitar, escolherTipo } = await montar();
    await escolherTipo('t-1');
    await digitar('ce-money-input input', '2500');
    botao('Lançar despesa').click();
    await fixture.whenStable();
    const req = http.expectOne(`${BASE}/caixas/cx-1/despesas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipoDespesaId: 't-1', valor: 25, descricao: null });
    req.flush(null, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('sem tipo: nenhuma requisição e mostra a mensagem de obrigatório', async () => {
    const { fixture, el, close, botao, digitar } = await montar();
    await digitar('ce-money-input input', '2500');
    botao('Lançar despesa').click();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Escolha o tipo da despesa.');
    expect(close).not.toHaveBeenCalled();
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
    const select = el.querySelector('ce-select select') as HTMLSelectElement;
    expect(select.value).toBe('t-3');
  });

  it.each([
    [409, 'CAIXA_FECHADO', 'O caixa do dia já está fechado.'],
    [400, 'VALOR_INVALIDO', 'Valor deve ser positivo.'],
    [422, 'TIPO_DESPESA_INEXISTENTE', 'Tipo de despesa não encontrado.'],
  ])('%i %s aparece inline e não fecha', async (status, code, mensagem) => {
    const { fixture, el, http, close, botao, digitar, escolherTipo } = await montar();
    await escolherTipo('t-1');
    await digitar('ce-money-input input', '2500');
    botao('Lançar despesa').click();
    http
      .expectOne(`${BASE}/caixas/cx-1/despesas`)
      .flush({ code, message: 'x', traceId: 't' }, { status, statusText: 'Erro' });
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(mensagem);
    expect(close).not.toHaveBeenCalled();
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
