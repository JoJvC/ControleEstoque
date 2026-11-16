import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { PedidoNovoPage } from './pedido-novo-page';

const CLIENTES = '/api/clientes/v1/clientes';
const PRODUTOS = '/api/estoque/v1/produtos';
const FUNCS = '/api/rh/v1/funcionarios';
const PEDIDOS = '/api/vendas/v1/pedidos';

const marca = (id: string, nome: string, preco: number) => ({
  id: `pm-${id}`,
  marcaId: id,
  marcaNome: nome,
  precoReferencia: preco,
});
const AGUA = {
  id: 'p-1',
  nome: 'Água 20L',
  categoria: 'Água',
  marcas: [marca('m-1', 'Cristal', 12.5), marca('m-2', 'Serra', 9)],
};
const GELO = { id: 'p-2', nome: 'Gelo', categoria: 'Gelo', marcas: [marca('m-3', 'Polar', 5)] };
const ANA = {
  id: 'c-1',
  nome: 'Ana',
  telefone: '11',
  observacoes: null,
  enderecos: [
    { id: 'e-1', logradouro: 'Rua A', numero: '10', bairro: 'Centro', principal: false },
    { id: 'e-2', logradouro: 'Rua B', numero: '20', bairro: 'Vila', principal: true },
  ],
};
const BIA = { id: 'c-2', nome: 'Bia', telefone: null, observacoes: null, enderecos: [] };
const func = (id: string, nome: string) => ({
  id,
  nome,
  telefone: null,
  cargoId: 'c',
  cargo: null,
  valorDiaria: 0,
  ativo: true,
});

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(['*']));
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PedidoNovoPage);
  fixture.detectChanges();
  http.expectOne(PRODUTOS).flush([AGUA, GELO]);
  http.expectOne(FUNCS).flush([func('a', 'Ana F'), func('b', 'Beto F')]);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;

  const botoes = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
  const botao = (texto: string) => botoes().find((b) => b.textContent?.trim().includes(texto))!;
  const porRotulo = (rotulo: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`)!;
  const digitar = async (placeholder: string, texto: string, formsFixture = fixture) => {
    const campo = el.querySelector<HTMLInputElement>(`input[placeholder^="${placeholder}"]`)!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // debounce do ce-search-box
    await assentar(formsFixture);
  };
  // A lista de clientes não traz endereços (enderecos: []); o detalhe traz.
  const escolherCliente = async (cliente: typeof ANA | typeof BIA) => {
    await digitar('Buscar cliente', 'a');
    http.expectOne((r) => r.url === CLIENTES).flush([{ ...cliente, enderecos: [] }]);
    await assentar(fixture);
    botao(cliente.nome).click();
    http.expectOne(`${CLIENTES}/${cliente.id}`).flush(cliente);
    await assentar(fixture);
  };
  const pilula = (texto: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.pilula')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  const itens = () =>
    Array.from(el.querySelectorAll('.item')).map((i) => i.textContent?.replace(/\s+/g, ' ').trim());
  return { fixture, el, http, navegar, botao, porRotulo, digitar, escolherCliente, pilula, itens };
}

describe('PedidoNovoPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('segue o padrão de página: cabeçalho com voltar', async () => {
    const t = await montar();
    expect(lerPadraoPagina(t.el)).toMatchObject({ cabecalhos: 1, voltar: true });
  });

  it('Criar pedido fica desabilitado sem cliente e sem item', async () => {
    const t = await montar();
    expect(t.botao('Criar pedido').disabled).toBe(true);
    await t.escolherCliente(BIA);
    expect(t.botao('Criar pedido').disabled).toBe(true); // sem item
    t.botao('Água 20L — Cristal').click();
    await assentar(t.fixture);
    expect(t.botao('Criar pedido').disabled).toBe(false);
    t.porRotulo('Remover Água 20L').click();
    await assentar(t.fixture);
    expect(t.botao('Criar pedido').disabled).toBe(true);
  });

  it('escolher cliente pré-seleciona o endereço principal; clique troca e permite Sem endereço', async () => {
    const t = await montar();
    await t.escolherCliente(ANA);
    expect(t.pilula('Rua B').getAttribute('aria-pressed')).toBe('true');
    expect(t.pilula('Rua A').getAttribute('aria-pressed')).toBe('false');
    t.pilula('Rua A').click();
    await assentar(t.fixture);
    expect(t.pilula('Rua A').getAttribute('aria-pressed')).toBe('true');
    t.pilula('Sem endereço').click();
    await assentar(t.fixture);
    expect(t.pilula('Sem endereço').getAttribute('aria-pressed')).toBe('true');
  });

  it('lista sem endereços + detalhe com endereço: usa os do detalhe', async () => {
    const t = await montar();
    await t.escolherCliente(ANA);
    expect(t.pilula('Rua A')).toBeTruthy();
    expect(t.pilula('Rua B').getAttribute('aria-pressed')).toBe('true');
  });

  it('falha ao carregar o detalhe do cliente mostra mensagem e mantém só Sem endereço', async () => {
    const t = await montar();
    await t.digitar('Buscar cliente', 'a');
    t.http.expectOne((r) => r.url === CLIENTES).flush([{ ...ANA, enderecos: [] }]);
    await assentar(t.fixture);
    t.botao('Ana').click();
    t.http
      .expectOne(`${CLIENTES}/c-1`)
      .flush({ code: 'X', message: 'x', traceId: 't' }, { status: 500, statusText: 'err' });
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')).toBeTruthy();
    expect(t.pilula('Sem endereço').getAttribute('aria-pressed')).toBe('true');
  });

  it('cliente sem endereço: só Sem endereço, marcado', async () => {
    const t = await montar();
    await t.escolherCliente(BIA);
    expect(t.pilula('Sem endereço').getAttribute('aria-pressed')).toBe('true');
  });

  it('busca filtra o catálogo; tocar adiciona, tocar de novo soma, +/− e remover ajustam', async () => {
    const t = await montar();
    await t.digitar('Buscar produto', 'cristal');
    expect(t.el.textContent).not.toContain('Gelo — Polar');
    t.botao('Água 20L — Cristal').click();
    t.botao('Água 20L — Cristal').click();
    await assentar(t.fixture);
    expect(t.itens()).toHaveLength(1);
    expect(t.itens()[0]).toContain('2');

    t.porRotulo('Aumentar Água 20L').click();
    await assentar(t.fixture);
    expect(t.itens()[0]).toContain('3');
    t.porRotulo('Diminuir Água 20L').click();
    t.porRotulo('Diminuir Água 20L').click();
    await assentar(t.fixture);
    expect(t.itens()[0]).toContain('1');
    t.porRotulo('Diminuir Água 20L').click(); // chega a 0: some
    await assentar(t.fixture);
    expect(t.itens()).toHaveLength(0);
  });

  it('clique em Criar pedido envia o CriarPedidoRequest e navega para o detalhe', async () => {
    const t = await montar();
    await t.escolherCliente(ANA);
    await t.digitar('Ex.: entregar', ' depois das 14h ');
    await t.digitar('Buscar produto', 'cristal');
    t.botao('Água 20L — Cristal').click();
    await assentar(t.fixture);
    t.porRotulo('Aumentar Água 20L').click();
    t.el.querySelectorAll<HTMLInputElement>('ce-seletor-funcionarios ce-checkbox input')[1].click();
    await assentar(t.fixture);

    t.botao('Criar pedido').click();
    const req = t.http.expectOne(PEDIDOS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      funcionarioId: 'f1',
      clienteId: 'c-1',
      enderecoEntregaId: 'e-2',
      itens: [
        { produtoId: 'p-1', marcaId: 'm-1', quantidade: 2, precoUnitario: 12.5, desconto: null },
      ],
      funcionariosIds: ['b'],
      observacao: 'depois das 14h',
    });
    req.flush({ id: 'p-9' });
    await assentar(t.fixture);
    expect(t.navegar).toHaveBeenCalledWith('/pedidos/p-9');
  });

  it('erro da API mostra a mensagem e não navega', async () => {
    const t = await montar();
    await t.escolherCliente(BIA);
    t.botao('Água 20L — Cristal').click();
    await assentar(t.fixture);
    t.botao('Criar pedido').click();
    t.http
      .expectOne(PEDIDOS)
      .flush(
        { code: 'ENDERECO_NAO_PERTENCE_AO_CLIENTE', message: 'x', traceId: 't' },
        { status: 422, statusText: 'x' },
      );
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain(
      'O endereço de entrega não pertence ao cliente.',
    );
    expect(t.navegar).not.toHaveBeenCalled();
  });
});
