import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ConverterGalaoSheet } from './converter-galao-sheet';

const URL = '/api/vendas/v1/vendas';
const tipo = (id: string, nome: string, precoVasilhame: number) => ({
  id,
  nome,
  marcaId: null,
  marca: null,
  precoVasilhame,
  aceitaSucata: false,
});
const TIPOS = [
  tipo('t-20', 'Galão 20L', 15),
  tipo('t-10', 'Galão 10L', 9),
  tipo('t-5', 'Garrafão', 4),
];
const UM_TIPO = [
  { tipoCascoId: 't-20', nome: 'Galão 20L', saldo: 3 },
  { tipoCascoId: 't-10', nome: 'Galão 10L', saldo: 0 },
  { tipoCascoId: 't-5', nome: 'Garrafão', saldo: -1 },
];
const DOIS_TIPOS = [UM_TIPO[0], { tipoCascoId: 't-10', nome: 'Galão 10L', saldo: 2 }];

async function montar(cascosPorTipo = UM_TIPO, comOperador = true) {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [ConverterGalaoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
      { provide: DIALOG_DATA, useValue: { clienteId: 'c-1', tipos: TIPOS, cascosPorTipo } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  if (comOperador) {
    TestBed.inject(OperatorStore).select(operadorValido(['*']));
  }
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ConverterGalaoSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const texto = () => el.textContent!.replace(/\s+/g, ' ');
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar'),
    ) as HTMLButtonElement;
  const escrever = async (seletor: string, valor: string) => {
    const campo = el.querySelector(seletor) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const preco = (digitos: string) => escrever('ce-money-input input', digitos);
  const quantidade = (n: string) => escrever('ce-quantity-stepper input', n);
  const escolherTipo = async (id: string) => {
    const select = el.querySelector('ce-select select') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  return { fixture, el, http, close, texto, confirmar, preco, quantidade, escolherTipo };
}

describe('ConverterGalaoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista só os tipos com saldo > 0; tipo único já vem selecionado com o preço padrão', async () => {
    const { el, texto, confirmar } = await montar();
    const opcoes = Array.from(el.querySelectorAll('ce-select option:not([disabled])'));
    expect(opcoes.map((o) => o.textContent!.trim())).toEqual(['Galão 20L (3)']);
    expect(texto()).toContain('Total: R$ 15,00');
    expect(texto()).toContain('vira fiado do cliente');
    expect(confirmar().disabled).toBe(false);
  });

  it('com dois tipos nada vem selecionado; escolher traz o preço do tipo', async () => {
    const { texto, confirmar, escolherTipo } = await montar(DOIS_TIPOS);
    expect(confirmar().disabled).toBe(true);
    await escolherTipo('t-10');
    expect(texto()).toContain('Total: R$ 9,00');
    expect(confirmar().disabled).toBe(false);
  });

  it('digitar outro valor e a quantidade atualiza o total', async () => {
    const { texto, preco, quantidade } = await montar();
    await preco('1200');
    await quantidade('2');
    expect(texto()).toContain('Total: R$ 24,00');
  });

  it('quantidade acima do saldo é travada no saldo (3 × R$ 15,00) e o + desabilita', async () => {
    const { el, texto, quantidade } = await montar();
    await quantidade('9');
    expect(texto()).toContain('Total: R$ 45,00');
    const mais = el.querySelector('button[aria-label="Aumentar"]') as HTMLButtonElement;
    expect(mais.disabled).toBe(true);
  });

  it('sem operador: Confirmar desabilitado e aviso', async () => {
    const { texto, confirmar } = await montar(UM_TIPO, false);
    expect(confirmar().disabled).toBe(true);
    expect(texto()).toContain('Escolha o operador');
  });

  it('Confirmar envia a venda de conversão e fecha com a resposta', async () => {
    const { fixture, http, close, preco, quantidade, confirmar } = await montar();
    await preco('1200');
    await quantidade('2');
    confirmar().click();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      clienteId: 'c-1',
      funcionarioId: 'f1',
      itens: [],
      pagamentos: [],
      vasilhames: [
        { tipoCascoId: 't-20', quantidade: 2, precoUnitario: 12, modoCredito: 'CONVERTER_CASCO' },
      ],
    });
    req.flush({ id: 'v-1', totalLiquido: 24 });
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith({ id: 'v-1', totalLiquido: 24 });
  });

  it('erro 4xx aparece inline e não fecha', async () => {
    const { fixture, el, http, close, confirmar } = await montar();
    confirmar().click();
    http
      .expectOne(URL)
      .flush(
        { code: 'CONVERSAO_MAIOR_QUE_SALDO', message: 'Maior que o saldo.', traceId: 't' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBeTruthy();
    expect(close).not.toHaveBeenCalled();
  });
});
