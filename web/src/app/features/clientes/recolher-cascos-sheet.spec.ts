import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { RecolherCascosSheet } from './recolher-cascos-sheet';

const URL = '/api/clientes/v1/clientes/c-1/cascos/devolucoes';
const tipo = (id: string, nome: string) => ({
  id,
  nome,
  marcaId: null,
  marca: null,
  precoVasilhame: 15,
  aceitaSucata: false,
});
const DADOS = {
  clienteId: 'c-1',
  tipos: [tipo('t-20', 'Galão 20L'), tipo('t-10', 'Galão 10L'), tipo('t-5', 'Garrafão 5L')],
  cascosPorTipo: [
    { tipoCascoId: 't-20', nome: 'Galão 20L', saldo: 3 },
    { tipoCascoId: 't-5', nome: 'Garrafão 5L', saldo: -1 },
  ],
};

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [RecolherCascosSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: DADOS },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(RecolherCascosSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const botao = (rotulo: string) =>
    el.querySelector(`button[aria-label="${rotulo}"]`) as HTMLButtonElement;
  const campo = (nome: string) =>
    el.querySelector(`input[aria-label="Voltaram agora ${nome}"]`) as HTMLInputElement;
  const clicar = async (rotulo: string) => {
    botao(rotulo).click();
    await fixture.whenStable();
  };
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar'),
    ) as HTMLButtonElement;
  return { fixture, el, http, close, botao, campo, clicar, confirmar };
}

describe('RecolherCascosSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('uma linha por tipo, com o saldo; negativo aparece "a favor do cliente"', async () => {
    const { el } = await montar();
    const linhas = Array.from(el.querySelectorAll('.linha')).map((l) =>
      l.querySelector('.linha__texto')!.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(linhas).toEqual([
      'Galão 20L Com ele: 3',
      'Galão 10L Com ele: 0',
      'Garrafão 5L 1 a favor do cliente',
    ]);
  });

  it('− não desce de 0 e Confirmar fica desabilitado com tudo em 0', async () => {
    const { botao, campo, clicar, confirmar } = await montar();
    expect(confirmar().disabled).toBe(true);
    expect(botao('Diminuir Galão 20L').disabled).toBe(true);
    await clicar('Aumentar Galão 20L');
    expect(campo('Galão 20L').value).toBe('1');
    expect(confirmar().disabled).toBe(false);
    await clicar('Diminuir Galão 20L');
    expect(campo('Galão 20L').value).toBe('0');
    expect(botao('Diminuir Galão 20L').disabled).toBe(true);
    expect(confirmar().disabled).toBe(true);
  });

  it('digitar no campo aceita só inteiro ≥ 0', async () => {
    const { fixture, campo, confirmar } = await montar();
    const c = campo('Galão 10L');
    c.value = '-4x';
    c.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(confirmar().disabled).toBe(false);
    c.value = '';
    c.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(confirmar().disabled).toBe(true);
  });

  it('Confirmar envia só as linhas > 0 num único POST e fecha com a resposta', async () => {
    const { fixture, http, close, campo, clicar, confirmar } = await montar();
    await clicar('Aumentar Galão 20L');
    await clicar('Aumentar Galão 20L');
    campo('Galão 10L').value = '1';
    campo('Galão 10L').dispatchEvent(new Event('input'));
    await fixture.whenStable();
    confirmar().click();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      linhas: [
        { tipoCascoId: 't-20', quantidade: 2 },
        { tipoCascoId: 't-10', quantidade: 1 },
      ],
    });
    const resposta = { novoSaldoCascos: 0, saldoPorTipo: [] };
    req.flush(resposta);
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(resposta);
  });

  it('erro 4xx aparece inline e não fecha', async () => {
    const { fixture, el, http, close, clicar, confirmar } = await montar();
    await clicar('Aumentar Galão 20L');
    confirmar().click();
    http
      .expectOne(URL)
      .flush(
        { code: 'CLIENTE_NAO_ENCONTRADO', message: 'x', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Cliente não encontrado.');
    expect(close).not.toHaveBeenCalled();
    expect(confirmar().disabled).toBe(false);
  });
});
