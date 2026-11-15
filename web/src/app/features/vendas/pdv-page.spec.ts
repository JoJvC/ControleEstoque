import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, map, of } from 'rxjs';
import { vi } from 'vitest';

import { ClienteResponse, SaldosResponse } from '../../core/api/models/clientes';
import { EstoqueItemResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { VendaDetalheResponse, VendaResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { ItemCarrinho } from './carrinho';
import { CobrarSheet } from './cobrar-painel';
import { ItemVendaSheet } from './item-venda-sheet';
import { PdvPage } from './pdv-page';

const URL_VENDAS = '/api/vendas/v1/vendas';

function produto(id: string, nome: string, tipo: ProdutoResponse['tipo']): ProdutoResponse {
  return {
    id,
    tipo,
    nome,
    marcaId: null,
    marca: null,
    categoria: null,
    tamanho: null,
    fotoUrl: null,
    precoReferencia: 50,
    estoqueMinimo: 0,
  };
}

const AGUA = produto('p-agua', 'Água 20L', 'AGUA');
const GALAO = produto('p-galao', 'Galão vazio', 'DESCARTAVEL');
const GELO = { ...produto('p-gelo', 'Gelo 5kg', 'DESCARTAVEL'), categoria: 'Gelo' };
const COPO = { ...produto('p-copo', 'Copo 200ml', 'DESCARTAVEL'), categoria: 'Copos' };
const GCOMPLETO = produto('p-gcomp', 'Galão completo', 'GALAO_COMPLETO');

const ESTOQUE = [
  { produtoId: 'p-agua', quantidade: 12 },
  { produtoId: 'p-gelo', quantidade: 7 },
] as EstoqueItemResponse[];

function cliente(id: string, nome: string, enderecos = 1): ClienteResponse {
  return {
    id,
    nome,
    telefone: null,
    observacoes: null,
    enderecos: Array.from({ length: enderecos }, (_, i) => ({
      id: `${id}-e${i + 1}`,
      logradouro: `Rua ${i + 1}`,
      numero: '10',
      bairro: null,
      complemento: null,
      referencia: null,
      principal: i === 0,
    })),
  };
}

function itemDe(p: ProdutoResponse, quantidade: number): ItemCarrinho {
  return { produto: p, quantidade, precoUnitario: 50, desconto: null };
}

const RESPOSTA: VendaResponse = {
  id: 'v-1',
  totalBruto: 250,
  totalDesconto: 0,
  totalLiquido: 250,
  totalPago: 200,
  saldoFiadoGerado: 50,
  statusPagamento: 'PARCIAL',
  saldoCascoCliente: 2,
};

const SALDOS: SaldosResponse = { saldoCascos: 3, sucataEntregue: 0, saldoFiado: 40 };
const SALDOS_ZERO: SaldosResponse = { saldoCascos: 0, sucataEntregue: 0, saldoFiado: 0 };

// A sheet Cobrar é a SheetService de verdade (Esc e Fechar valem); só a sheet do item é dublê.
async function montar(
  idVenda?: string,
  opcoes: { desktop?: boolean; cliente?: string; catalogoFalha?: boolean } = {},
) {
  const largura = new BehaviorSubject(opcoes.desktop === true);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => largura.pipe(map((matches) => ({ matches, breakpoints: {} }))) },
      },
      {
        provide: OperatorStore,
        useValue: { operator: () => ({ id: 'f-1', nome: 'Maria', cargoId: 'c', cargoNome: null }) },
      },
    ],
  });
  const sheet = TestBed.inject(SheetService);
  const abrirReal = sheet.abrir.bind(sheet);
  const abrir = vi.fn();
  vi.spyOn(sheet, 'abrir').mockImplementation(((componente: unknown, dados: unknown) =>
    componente === ItemVendaSheet
      ? abrir(componente, dados)
      : (abrirReal as (c: unknown, d: unknown) => unknown)(
          componente,
          dados,
        )) as unknown as typeof sheet.abrir);
  const confirmar = vi.spyOn(sheet, 'confirmar');
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PdvPage);
  if (idVenda) {
    fixture.componentRef.setInput('id', idVenda);
  }
  if (opcoes.cliente) {
    fixture.componentRef.setInput('cliente', opcoes.cliente);
  }
  const el = fixture.nativeElement as HTMLElement;
  const produtosReq = http.expectOne('/api/estoque/v1/produtos');
  if (opcoes.catalogoFalha) {
    produtosReq.flush(
      { code: 'ERRO_X', message: 'falhou', traceId: 't' },
      { status: 500, statusText: 'Server Error' },
    );
  } else {
    produtosReq.flush([AGUA, GALAO, GELO, COPO, GCOMPLETO]);
  }
  http.expectOne('/api/estoque/v1/estoque').flush(ESTOQUE);
  await assentar(fixture);

  // O painel de cobrança é um só: dentro da sheet (celular) ou na coluna da direita (desktop).
  const painel = () => document.querySelector<HTMLElement>('ce-cobrar-painel')!;
  const botaoEm = (raiz: ParentNode, texto: string): HTMLButtonElement => {
    const achado = Array.from(raiz.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    );
    if (!achado) {
      throw new Error(`botão "${texto}" não encontrado`);
    }
    return achado;
  };
  const botao = (texto: string) => botaoEm(el, texto);
  const clicar = async (texto: string) => {
    botao(texto).click();
    await assentar(fixture);
  };
  const clicarNoPainel = async (texto: string) => {
    botaoEm(painel(), texto).click();
    await assentar(fixture);
  };
  const digitar = async (input: HTMLInputElement, valor: string) => {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await assentar(fixture);
  };
  const enter = async (input: HTMLInputElement) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await assentar(fixture);
  };
  const campo = (seletor: string, indice = 0, raiz: ParentNode = el) =>
    raiz.querySelectorAll<HTMLInputElement>(seletor)[indice];
  const campoDoPainel = (seletor: string, indice = 0) => campo(seletor, indice, painel());
  const texto = (raiz: Element = el) => (raiz.textContent ?? '').replace(/\s+/g, ' ');
  const alertas = () =>
    Array.from(document.body.querySelectorAll('[role="alert"]')).map((a) => a.textContent);
  const exato = (raiz: ParentNode, rotulo: string): HTMLButtonElement[] =>
    Array.from(raiz.querySelectorAll('button')).filter((b) => b.textContent?.trim() === rotulo);
  const valores = () =>
    Array.from(painel().querySelectorAll<HTMLInputElement>('ce-money-input input')).map(
      (i) => i.value,
    );

  const escolherCliente = async (c: ClienteResponse, saldos: SaldosResponse = SALDOS_ZERO) => {
    const busca = campo('ce-search-box input[placeholder^="Buscar cliente"]');
    await digitar(busca, c.nome);
    await enter(busca);
    http
      .expectOne((r) => r.url === '/api/clientes/v1/clientes' && r.params.get('nome') === c.nome)
      .flush([c]);
    await assentar(fixture);
    http.expectOne(`/api/clientes/v1/clientes/${c.id}/saldos`).flush(saldos);
    await assentar(fixture);
  };
  const responderSaldos = async (clienteId: string) => {
    http.expectOne(`/api/clientes/v1/clientes/${clienteId}/saldos`).flush(SALDOS_ZERO);
    await assentar(fixture);
  };
  const linha = (p: ProdutoResponse): HTMLElement => {
    const achada = Array.from(el.querySelectorAll<HTMLElement>('.prod')).find((l) =>
      l.textContent?.includes(p.nome),
    );
    if (!achada) {
      throw new Error(`linha "${p.nome}" não encontrada`);
    }
    return achada;
  };
  // Toque na linha do catálogo: adiciona uma unidade.
  const tocar = async (p: ProdutoResponse, vezes = 1) => {
    for (let i = 0; i < vezes; i++) {
      linha(p).querySelector<HTMLElement>(`button[aria-label="Adicionar ${p.nome}"]`)!.click();
      await assentar(fixture);
    }
  };
  const aumentar = async (p: ProdutoResponse) => {
    linha(p).querySelector<HTMLElement>(`button[aria-label="Aumentar ${p.nome}"]`)!.click();
    await assentar(fixture);
  };
  const diminuir = async (p: ProdutoResponse) => {
    linha(p).querySelector<HTMLElement>(`button[aria-label="Diminuir ${p.nome}"]`)!.click();
    await assentar(fixture);
  };
  const barra = () => texto(el.querySelector('.barra')!);
  const cobrar = () => clicar('Cobrar');
  const escape = async () => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    await assentar(fixture);
  };
  const aberta = () => document.querySelector('ce-cobrar-painel') !== null;
  // Depois do POST: a lista de vendas recarrega e os saldos do cliente são consultados de novo.
  const depoisDoPost = async (saldos: SaldosResponse = SALDOS_ZERO) => {
    http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(fixture);
    http.expectOne('/api/clientes/v1/clientes/c-1/saldos').flush(saldos);
    await assentar(fixture);
  };
  const aposRegistro = async (resposta: VendaResponse = RESPOSTA) => {
    http.expectOne(URL_VENDAS).flush(resposta);
    await assentar(fixture);
    await depoisDoPost();
  };

  return {
    fixture,
    largura,
    http,
    navegar,
    el,
    abrir,
    confirmar,
    painel,
    botao,
    botaoEm,
    clicar,
    clicarNoPainel,
    digitar,
    enter,
    campo,
    campoDoPainel,
    texto,
    alertas,
    exato,
    valores,
    escolherCliente,
    responderSaldos,
    linha,
    tocar,
    aumentar,
    diminuir,
    barra,
    cobrar,
    escape,
    aberta,
    aposRegistro,
    depoisDoPost,
  };
}

type T = Awaited<ReturnType<typeof montar>>;

// Promessas do componente (firstValueFrom) resolvem em microtasks: dá um tick antes de estabilizar.
async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

const VENDA_EDICAO: VendaDetalheResponse = {
  id: 'v-1',
  clienteId: 'c-1',
  funcionarioId: 'f-orig',
  enderecoEntregaId: 'c-1-e1',
  data: '2026-01-02T10:00:00',
  totalBruto: 100,
  totalDesconto: 5,
  totalLiquido: 95,
  statusPagamento: 'PARCIAL',
  observacao: 'entregar à tarde',
  cupomEmitido: false,
  cupomNumero: null,
  cupomEmitidoEm: null,
  itens: [
    {
      produtoId: 'p-agua',
      quantidade: 1,
      precoUnitario: 50,
      descontoTipo: 'PERCENTUAL',
      descontoValor: 10,
      motivoDesconto: null,
      totalItem: 45,
    },
    {
      produtoId: 'p-galao',
      quantidade: 1,
      precoUnitario: 50,
      descontoTipo: null,
      descontoValor: null,
      motivoDesconto: null,
      totalItem: 50,
    },
  ],
  pagamentos: [{ forma: 'DINHEIRO', valor: 30 }],
  cascosDevolvidos: 2,
  sucataEntregue: 1,
};

const CORPO_ORIGINAL = {
  clienteId: 'c-1',
  funcionarioId: 'f-orig',
  enderecoEntregaId: 'c-1-e1',
  itens: [
    {
      produtoId: 'p-agua',
      quantidade: 1,
      precoUnitario: 50,
      desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
    },
    { produtoId: 'p-galao', quantidade: 1, precoUnitario: 50, desconto: null },
  ],
  pagamentos: [{ forma: 'DINHEIRO', valor: 30 }],
  cascosDevolvidos: 2,
  cascosDevolvidosNaHora: false,
  sucataEntregue: 1,
  observacao: 'entregar à tarde',
};

const itemAntigo = (produtoId: string, quantidade: number, precoUnitario: number) => ({
  produtoId,
  quantidade,
  precoUnitario,
  descontoTipo: 'PERCENTUAL' as const,
  descontoValor: 10,
  motivoDesconto: 'antigo',
  totalItem: 0,
});

// Última venda de Ana: 2 águas a R$ 12 (hoje R$ 50) e 1 gás que saiu do catálogo.
const ULTIMA: VendaDetalheResponse = {
  ...VENDA_EDICAO,
  id: 'v-0',
  itens: [itemAntigo('p-agua', 2, 12), itemAntigo('p-gas', 1, 90)],
};

const ehUltimaVenda = (r: {
  method: string;
  url: string;
  params: { get(k: string): string | null };
}) =>
  r.method === 'GET' &&
  r.url === URL_VENDAS &&
  r.params.get('clienteId') === 'c-1' &&
  r.params.get('page') === '1' &&
  r.params.get('pageSize') === '1';

// Como o servidor real: a listagem devolve o resumo (itens: []), os itens vêm do detalhe.
const RESUMO_ULTIMA: VendaDetalheResponse = { ...ULTIMA, itens: [] };

async function responderUltima(
  t: { http: HttpTestingController; fixture: ComponentFixture<PdvPage> },
  detalhe: VendaDetalheResponse,
): Promise<void> {
  t.http.expectOne(ehUltimaVenda).flush([RESUMO_ULTIMA]);
  await assentar(t.fixture);
  t.http.expectOne(`${URL_VENDAS}/${RESUMO_ULTIMA.id}`).flush(detalhe);
  await assentar(t.fixture);
}

describe('PdvPage: venda em uma tela', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('tocar na linha adiciona o item; −/+ muda a quantidade; a barra mostra itens e total', async () => {
    const t = await montar();
    expect(t.botao('Escolha o cliente').disabled).toBe(true);
    await t.escolherCliente(cliente('c-1', 'Ana'));
    expect(t.botao('Adicione itens').disabled).toBe(true);
    expect(t.barra()).toContain('0 itens');

    await t.tocar(AGUA);
    expect(t.barra()).toMatch(/1 item R\$ 50,00/);
    expect(t.botao('Cobrar').disabled).toBe(false);

    await t.aumentar(AGUA);
    await t.tocar(GELO);
    expect(t.barra()).toMatch(/3 itens R\$ 150,00/);

    await t.diminuir(AGUA);
    expect(t.barra()).toMatch(/2 itens R\$ 100,00/);
    await t.diminuir(AGUA);
    await t.diminuir(GELO);
    expect(t.el.querySelectorAll('.prod--sel')).toHaveLength(0);
    expect(t.barra()).toContain('0 itens');
    expect(t.botao('Adicione itens').disabled).toBe(true);
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('a linha mostra estoque e preço; as pílulas filtram por categoria', async () => {
    const t = await montar();
    expect(t.texto(t.linha(AGUA))).toMatch(/Estoque: 12 · R\$ 50,00/);
    const nomes = () => Array.from(t.el.querySelectorAll('.prod__nome')).map((n) => n.textContent);
    expect(nomes()).toHaveLength(5);

    await t.clicar('Gelo');
    expect(nomes()).toEqual(['Gelo 5kg']);
    await t.clicar('Todos');
    expect(nomes()).toHaveLength(5);
  });

  it('"Preço e desconto" abre o sheet do item e o resultado entra no carrinho', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(AGUA, 2);

    t.abrir.mockReturnValueOnce({ closed: of({ ...itemDe(AGUA, 2), precoUnitario: 45 }) });
    await t.clicar('Preço e desconto');

    expect(t.abrir).toHaveBeenCalledWith(expect.anything(), {
      produto: AGUA,
      existente: itemDe(AGUA, 2),
    });
    expect(t.texto(t.linha(AGUA))).toContain('preço editado');
    expect(t.barra()).toContain('R$ 90,00');

    t.abrir.mockReturnValueOnce({ closed: of('remover') });
    await t.clicar('Preço e desconto');
    expect(t.el.querySelectorAll('.prod--sel')).toHaveLength(0);
  });

  it('Enter na busca de produto abre o sheet do primeiro produto filtrado', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));

    t.abrir.mockReturnValueOnce({ closed: of(undefined) });
    const busca = t.campo('ce-search-box input[placeholder^="Buscar produto"]');
    busca.value = 'galao';
    busca.dispatchEvent(new Event('input'));
    await t.enter(busca);

    expect(t.abrir).toHaveBeenCalledWith(expect.anything(), { produto: GALAO, existente: null });
  });

  it('cliente fixo no topo: chips de casco e fiado do servidor; Trocar volta à busca', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    const topo = t.el.querySelector<HTMLElement>('.cliente-fixo')!;
    expect(t.texto(topo)).toContain('Ana');
    expect(t.texto(topo)).toMatch(/Casco 3/);
    expect(t.texto(topo)).toMatch(/Fiado R\$ 40,00/);

    await t.clicar('Trocar');
    expect(t.el.querySelector('.cliente-fixo')).toBeNull();
    expect(t.texto()).toContain('Quem está comprando?');
  });

  it('Enter na busca de cliente seleciona o primeiro resultado', async () => {
    const t = await montar();
    const busca = t.campo('ce-search-box input');
    await t.digitar(busca, 'an');
    await t.enter(busca);
    t.http
      .expectOne((r) => r.url === '/api/clientes/v1/clientes' && r.params.get('nome') === 'an')
      .flush([cliente('c-1', 'Ana'), cliente('c-2', 'Anselmo')]);
    await assentar(t.fixture);
    await t.responderSaldos('c-1');

    expect(t.texto()).toContain('Ana');
    expect(t.texto()).not.toContain('Anselmo');
  });

  it('cliente com vários endereços exige escolher um antes de cobrar', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana', 2));
    await t.tocar(GALAO);
    expect(t.botao('Escolha o endereço').disabled).toBe(true);

    t.el.querySelectorAll<HTMLElement>('[role="radio"]')[1].click();
    await assentar(t.fixture);

    expect(t.botao('Cobrar').disabled).toBe(false);
  });

  it('Enter com a busca do debounce ainda em voo seleciona o cliente da resposta nova', async () => {
    const t = await montar();
    const busca = t.campo('ce-search-box input');
    // Termo anterior já resolvido: o Enter seleciona 'Antiga'.
    await t.digitar(busca, 'an');
    await t.enter(busca);
    t.http.expectOne((r) => r.params.get('nome') === 'an').flush([cliente('c-0', 'Antiga')]);
    await assentar(t.fixture);
    await t.responderSaldos('c-0');
    await t.clicar('Trocar');

    // Novo termo: o debounce real (300 ms) dispara a busca; o Enter vem com ela em voo.
    const novo = t.campo('ce-search-box input');
    await t.digitar(novo, 'bia');
    await new Promise((r) => setTimeout(r, 350));
    const req = t.http.expectOne((r) => r.params.get('nome') === 'bia');
    await t.enter(novo);
    req.flush([cliente('c-2', 'Bianca')]);
    await assentar(t.fixture);
    await t.responderSaldos('c-2');

    expect(t.texto()).toContain('Bianca');
    expect(t.texto()).not.toContain('Antiga');
  });
});

describe('PdvPage: cobrar no celular (sheet)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('Cobrar abre a sheet; o botão Fechar e o Esc a fecham', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(AGUA);
    expect(t.aberta()).toBe(false);

    await t.cobrar();
    expect(t.aberta()).toBe(true);
    expect(document.querySelector('.ce-sheet-panel')?.textContent).toContain('Fechar venda');
    expect(t.texto(t.painel())).toContain('1× Água 20L');

    document.querySelector<HTMLElement>('.ce-sheet-panel button[aria-label="Fechar"]')!.click();
    await assentar(t.fixture);
    expect(t.aberta()).toBe(false);

    await t.cobrar();
    expect(t.aberta()).toBe(true);
    await t.escape();
    expect(t.aberta()).toBe(false);
    expect(t.barra()).toContain('1 item');
  });

  it('o painel da sheet reage ao que se digita; ao ir para o desktop a sheet fecha e o painel fica na tela', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(AGUA, 2);
    await t.cobrar();

    await t.digitar(t.campoDoPainel('ce-money-input input'), '4000');
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 60,00/);

    t.largura.next(true);
    await assentar(t.fixture);
    expect(document.querySelector('.ce-sheet-panel')).toBeNull();
    expect(t.el.querySelector('.grade__venda ce-cobrar-painel')).not.toBeNull();
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 60,00/);
  });

  it('passeio 7: 5 águas, 3 devolvidos, 1 sucata, PIX 200 → fiado 50 antes; PARCIAL, fiado 50 e casco 2 depois', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    await t.tocar(AGUA, 5);
    expect(t.barra()).toMatch(/5 itens R\$ 250,00/);
    await t.cobrar();

    t.campoDoPainel('ce-checkbox input').click();
    await assentar(t.fixture);
    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '3');
    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 1), '1');
    expect(t.texto(t.painel())).toContain('Ficam 5 cascos na rua com Ana');

    t.exato(t.painel(), 'PIX')[0].click();
    await assentar(t.fixture);
    await t.digitar(t.campoDoPainel('ce-money-input input'), '20000');
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 50,00/);

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      clienteId: 'c-1',
      funcionarioId: 'f-1',
      enderecoEntregaId: 'c-1-e1',
      itens: [{ produtoId: 'p-agua', quantidade: 5, precoUnitario: 50, desconto: null }],
      pagamentos: [{ forma: 'PIX', valor: 200 }],
      cascosDevolvidos: 3,
      cascosDevolvidosNaHora: true,
      sucataEntregue: 1,
      observacao: null,
    });
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost({ saldoCascos: 2, sucataEntregue: 1, saldoFiado: 90 });

    expect(t.aberta()).toBe(false);
    expect(t.texto()).toContain('Venda registrada');
    expect(t.texto()).toContain('Parcial');
    expect(t.texto()).toMatch(/Fiado gerado ?R\$ 50,00/);
    expect(t.texto()).toMatch(/Saldo de cascos do cliente ?2/);
    expect(t.texto()).toMatch(/Fiado do cliente ?R\$ 90,00/);
  });

  it('"Nova venda" depois do registro volta à tela vazia, sem cliente', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(GALAO);
    await t.cobrar();
    await t.clicarNoPainel('Confirmar venda');
    await t.aposRegistro();

    await t.clicar('Nova venda');

    expect(t.texto()).not.toContain('Venda registrada');
    expect(t.texto()).not.toContain('Ana');
    expect(t.botao('Escolha o cliente').disabled).toBe(true);
  });

  it('"Cancelar venda" confirmada limpa o rascunho sem chamar a API; recusada mantém', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(GALAO);

    t.confirmar.mockResolvedValue(false);
    await t.clicar('Cancelar venda');
    expect(t.texto()).toContain('Ana');

    t.confirmar.mockResolvedValue(true);
    await t.clicar('Cancelar venda');
    expect(t.confirmar).toHaveBeenCalledTimes(2);
    expect(t.texto()).not.toContain('Ana');
    // afterEach: http.verify() garante que nenhuma chamada HTTP foi feita.
  });
});

describe('PdvPage: cobrar no desktop (painel à direita)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const comAguas = async (quantidade = 5) => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    await t.tocar(AGUA, quantidade);
    return t;
  };

  it('o painel aparece ao lado do catálogo, sem sheet e sem barra', async () => {
    const t = await montar(undefined, { desktop: true });
    expect(t.el.querySelector('ce-cobrar-painel')).toBeNull();
    expect(t.texto(t.el.querySelector('.grade__venda')!)).toContain('O total aparece aqui');

    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    await t.tocar(AGUA, 2);

    const direita = t.el.querySelector('.grade__venda')!;
    expect(direita.querySelector('ce-cobrar-painel')).not.toBeNull();
    expect(t.texto(direita)).toContain('· 2 itens');
    expect(t.el.querySelectorAll('.grade__catalogo .prod')).toHaveLength(5);
    expect(t.el.querySelector('.barra')).toBeNull();
    expect(document.querySelector('.ce-sheet-panel')).toBeNull();
    expect(t.abrir).not.toHaveBeenCalledWith(CobrarSheet, expect.anything());
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('"Devolveu todos na hora" preenche com a água, segue editável e desligar não zera', async () => {
    const t = await comAguas(5);
    const toggle = t.campoDoPainel('ce-checkbox input');
    const casco = () => t.campoDoPainel('ce-quantity-stepper input', 0);
    expect(t.texto(t.painel())).toContain('Devolveu todos na hora');

    toggle.click();
    await assentar(t.fixture);
    expect(casco().value).toBe('5');

    await t.digitar(casco(), '3');
    expect(casco().value).toBe('3');

    toggle.click();
    await assentar(t.fixture);
    expect(casco().value).toBe('3');
  });

  it('com o atalho ligado, mudar a água acompanha os devolvidos; edição manual fica', async () => {
    const t = await comAguas(5);
    t.campoDoPainel('ce-checkbox input').click();
    await assentar(t.fixture);
    const casco = () => t.campoDoPainel('ce-quantity-stepper input', 0);
    expect(casco().value).toBe('5');

    await t.aumentar(AGUA);
    expect(casco().value).toBe('6');

    await t.digitar(casco(), '4');
    await t.aumentar(AGUA);
    expect(casco().value).toBe('4');

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toBe(4);
    expect(req.request.body.itens[0].quantidade).toBe(7);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('casco e sucata são campos separados e a sucata não abate o débito de casco', async () => {
    const t = await comAguas(2);
    const painel = t.painel();
    expect(painel.querySelectorAll('ce-quantity-stepper')).toHaveLength(2);
    expect(t.texto(painel.querySelector('.casco')!)).toContain('Cascos devolvidos agora');
    expect(t.texto(painel.querySelector('.sucata')!)).toContain('Sucata entregue agora');
    expect(t.texto(painel.querySelector('.sucata')!)).toContain(
      'Sucata não abate o débito de casco',
    );

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 1), '2');
    expect(t.texto(painel)).toContain('Ficam 5 cascos na rua com Ana');
  });

  it('sem ÁGUA no carrinho a seção de cascos e sucata fica oculta e o request vai zerado', async () => {
    const t = await comAguas(2);
    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '2');
    await t.diminuir(AGUA);
    await t.diminuir(AGUA);
    await t.tocar(GALAO);

    expect(t.painel().querySelector('.casco')).toBeNull();
    expect(t.painel().querySelector('.sucata')).toBeNull();
    expect(t.texto(t.painel())).not.toContain('Sucata não abate');

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toBe(0);
    expect(req.request.body.sucataEntregue).toBe(0);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('galão completo não gera casco: a seção some e aparece a nota', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(GCOMPLETO);

    expect(t.painel().querySelector('.casco')).toBeNull();
    expect(t.texto(t.painel())).toContain('Galão completo não gera casco');
  });

  it('formas, valor e atalhos Tudo, Metade e Tudo fiado sempre visíveis; "Vai para fiado: R$ X" muda ao digitar; acima do total bloqueia', async () => {
    const t = await comAguas(5);
    expect(t.exato(t.painel(), 'Dinheiro')).toHaveLength(1);
    expect(t.exato(t.painel(), 'PIX')).toHaveLength(1);
    for (const rotulo of ['Cartão de débito', 'Cartão de crédito', 'Outro']) {
      expect(t.exato(t.painel(), rotulo)).toHaveLength(1);
    }
    expect(t.exato(t.painel(), 'Dinheiro')[0].getAttribute('aria-pressed')).toBe('true');
    expect(t.valores()).toEqual(['']);
    for (const rotulo of ['Tudo', 'Metade', 'Tudo fiado']) {
      expect(t.exato(t.painel(), rotulo)).toHaveLength(1);
    }
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 250,00/);

    await t.digitar(t.campoDoPainel('ce-money-input input'), '20000');
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 50,00/);

    await t.digitar(t.campoDoPainel('ce-money-input input'), '30000');
    expect(t.alertas()).toContain('A soma dos pagamentos ultrapassa o total da venda.');
    expect(t.botaoEm(t.painel(), 'Confirmar venda').disabled).toBe(true);

    t.exato(t.painel(), 'Metade')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual(['125,00']);

    t.exato(t.painel(), 'Tudo')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual(['250,00']);
    expect(t.texto(t.painel())).toContain('Pago por completo');
    expect(t.botaoEm(t.painel(), 'Confirmar venda').disabled).toBe(false);

    t.exato(t.painel(), 'Tudo fiado')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual([]);
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 250,00/);

    t.exato(t.painel(), 'Metade')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual(['125,00']);
  });

  it('dividir em mais de uma forma: a pílula soma uma linha com o que falta e desliga ao tocar de novo', async () => {
    const t = await comAguas(5);
    await t.digitar(t.campoDoPainel('ce-money-input input'), '10000');

    t.exato(t.painel(), 'PIX')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual(['100,00', '150,00']);
    expect(t.texto(t.painel())).toContain('Pago por completo');

    t.exato(t.painel(), 'PIX')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual(['100,00']);
  });

  it('sem valor digitado, escolher outra forma troca a forma padrão em vez de dividir', async () => {
    const t = await comAguas(5);

    t.exato(t.painel(), 'PIX')[0].click();
    await assentar(t.fixture);

    expect(t.exato(t.painel(), 'Dinheiro')[0].getAttribute('aria-pressed')).toBe('false');
    expect(t.valores()).toEqual(['250,00']);
  });

  it('o número de cascos na rua soma o saldo do cliente (3) à água da venda e tira os devolvidos', async () => {
    const t = await comAguas(2);

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '1');
    expect(t.texto(t.painel())).toContain('Ficam 4 cascos na rua com Ana');

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '4');
    expect(t.texto(t.painel())).toContain('Fica 1 casco na rua com Ana');
  });

  it('devolver mais do que o saldo mais a água mostra "Devolveu N a mais"', async () => {
    const t = await comAguas(2);

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '8');
    expect(t.texto(t.painel())).toContain('Devolveu 3 a mais');
    expect(t.texto(t.painel())).not.toContain('na rua');
  });

  it('"Outra forma" acrescenta uma linha já com o que falta pagar', async () => {
    const t = await comAguas(5);
    await t.digitar(t.campoDoPainel('ce-money-input input'), '10000');

    t.exato(t.painel(), 'Outra forma')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual(['100,00', '150,00']);
  });

  it('"Outra forma" com a forma padrão ainda sem valor também divide em duas linhas', async () => {
    const t = await comAguas(5);

    t.exato(t.painel(), 'Outra forma')[0].click();
    await assentar(t.fixture);

    expect(t.valores()).toEqual(['', '250,00']);
  });

  it('o painel mostra "Total" uma única vez', async () => {
    const t = await comAguas(2);

    expect(t.texto(t.painel()).match(/Total ?R\$/g)).toHaveLength(1);
  });

  it('409 CAIXA_FECHADO e 400 do backend aparecem inline e mantêm o rascunho', async () => {
    const t = await comAguas(1);

    await t.clicarNoPainel('Confirmar venda');
    t.http
      .expectOne(URL_VENDAS)
      .flush(
        { code: 'CAIXA_FECHADO', message: 'caixa fechado', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar(t.fixture);
    expect(t.alertas()).toContain('O caixa do dia já está fechado.');
    expect(t.texto(t.painel())).toMatch(/Total ?R\$ 50,00/);
    expect(t.botaoEm(t.painel(), 'Confirmar venda').disabled).toBe(false);

    await t.clicarNoPainel('Confirmar venda');
    t.http
      .expectOne(URL_VENDAS)
      .flush(
        { code: 'ITEM_INVALIDO', message: 'Quantidade do item deve ser positiva.', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assentar(t.fixture);
    expect(t.alertas()).toEqual(['Quantidade do item deve ser positiva.']);
  });

  async function registrada() {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(GALAO);
    await t.clicarNoPainel('Confirmar venda');
    await t.aposRegistro({ ...RESPOSTA, id: 'v-9' });
    return t;
  }

  it('"Emitir cupom fiscal" faz POST no cupom-fiscal e mostra o número', async () => {
    const t = await registrada();

    await t.clicar('Emitir cupom fiscal');
    const req = t.http.expectOne(`${URL_VENDAS}/v-9/cupom-fiscal`);
    expect(req.request.method).toBe('POST');
    req.flush({ cupomId: 'c', numero: '123', emitidoEm: '2026-01-01' });
    await assentar(t.fixture);

    expect(t.texto()).toContain('Cupom fiscal nº 123');
  });

  it('409 CUPOM_JA_EMITIDO mostra o cupom existente; outro erro aparece inline', async () => {
    const t = await registrada();

    await t.clicar('Emitir cupom fiscal');
    t.http
      .expectOne(`${URL_VENDAS}/v-9/cupom-fiscal`)
      .flush(
        { code: 'CAIXA_FECHADO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar(t.fixture);
    expect(t.alertas()).toContain('O caixa do dia já está fechado.');

    await t.clicar('Emitir cupom fiscal');
    t.http
      .expectOne(`${URL_VENDAS}/v-9/cupom-fiscal`)
      .flush(
        { code: 'CUPOM_JA_EMITIDO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar(t.fixture);
    t.http.expectOne(`${URL_VENDAS}/v-9`).flush({
      ...VENDA_EDICAO,
      id: 'v-9',
      cupomEmitido: true,
      cupomNumero: 'CF-00000042',
      cupomEmitidoEm: '2026-01-02T11:00:00',
    });
    await assentar(t.fixture);

    expect(t.texto()).toContain('Cupom fiscal nº CF-00000042');
    expect(t.alertas()).toEqual([]);
  });
});

describe('PdvPage: Repetir última venda', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function comCliente() {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    return t;
  }

  it('o clique carrega os itens da última venda a preço de hoje; o item pulado é avisado', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    await responderUltima(t, ULTIMA);

    expect(t.linha(AGUA).querySelector<HTMLInputElement>('ce-quantity-stepper input')!.value).toBe(
      '2',
    );
    expect(t.barra()).toMatch(/2 itens R\$ 100,00/);
    expect(t.barra()).not.toContain('desc.');
    expect(t.texto()).toContain('1 item da última venda não está mais no catálogo');
    expect(t.texto()).not.toContain('Repetir última venda');
  });

  it('o preço é o precoReferencia de hoje (R$ 50), não o da venda antiga (R$ 12), e segue editável', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    await responderUltima(t, ULTIMA);

    expect(t.texto(t.linha(AGUA))).toContain('R$ 50,00');
    expect(t.texto(t.linha(AGUA))).not.toContain('R$ 12,00');

    t.abrir.mockReturnValueOnce({ closed: of({ ...itemDe(AGUA, 2), precoUnitario: 48 }) });
    await t.clicar('Preço e desconto');
    expect(t.abrir.mock.calls[0][1].existente.precoUnitario).toBe(50);
    expect(t.barra()).toContain('R$ 96,00');
  });

  it('cliente sem venda anterior mostra o aviso e esconde o botão', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    t.http.expectOne(ehUltimaVenda).flush([]);
    await assentar(t.fixture);

    expect(t.texto()).toContain('Este cliente ainda não tem venda anterior.');
    expect(t.texto()).not.toContain('Repetir última venda');
    expect(t.botao('Adicione itens').disabled).toBe(true);
  });

  it('venda cujos produtos saíram todos do catálogo avisa do item de fora, sem dizer que não há venda', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    await responderUltima(t, { ...ULTIMA, itens: [itemAntigo('p-gas', 1, 90)] });

    expect(t.texto()).toContain('1 item da última venda não está mais no catálogo');
    expect(t.texto()).not.toContain('ainda não tem venda anterior');
    expect(t.barra()).toContain('0 itens');
  });

  it('venda sem nenhum item mostra o aviso de sem venda anterior', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    await responderUltima(t, { ...ULTIMA, itens: [] });

    expect(t.texto()).toContain('Este cliente ainda não tem venda anterior.');
    expect(t.barra()).toContain('0 itens');
  });

  it('catálogo que falhou ao carregar mostra o erro, não "sem venda anterior"', async () => {
    const t = await montar(undefined, { catalogoFalha: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));

    await t.clicar('Repetir última venda');
    await responderUltima(t, ULTIMA);

    expect(t.alertas().join(' ')).toContain('catálogo');
    expect(t.texto()).not.toContain('ainda não tem venda anterior');
    expect(t.botao('Repetir última venda').disabled).toBe(false);
  });

  it('item tocado no catálogo com a consulta em voo não é perdido', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    await t.tocar(GALAO);
    await responderUltima(t, ULTIMA);

    expect(t.barra()).toMatch(/1 item\b/);
    expect(t.el.querySelector('.prod--sel')).not.toBeNull();
  });

  it('erro da API mostra o erro e deixa tentar de novo', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    t.http
      .expectOne(ehUltimaVenda)
      .flush(
        { code: 'ERRO_X', message: 'falhou', traceId: 't' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toHaveLength(1);
    expect(t.botao('Repetir última venda').disabled).toBe(false);
    expect(t.barra()).toContain('0 itens');
  });

  it('com o carrinho preenchido, na edição e sem cliente a ação não aparece', async () => {
    const t = await montar();
    expect(t.texto()).not.toContain('Repetir última venda');
    await t.escolherCliente(cliente('c-1', 'Ana'));
    expect(t.texto()).toContain('Repetir última venda');
    await t.tocar(GALAO);
    expect(t.texto()).not.toContain('Repetir última venda');
  });
});

describe('PdvPage com ?cliente=', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sem id e com cliente: obtém e seleciona o cliente', async () => {
    const t = await montar(undefined, { cliente: 'c-1' });
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    await t.responderSaldos('c-1');
    expect(t.texto()).toContain('Ana');
  });

  it('corrida: escolha manual antes do obter responder não é sobrescrita', async () => {
    const t = await montar(undefined, { cliente: 'c-1' });
    const pendente = t.http.expectOne('/api/clientes/v1/clientes/c-1');
    await t.escolherCliente(cliente('c-2', 'Beto'));
    pendente.flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    expect(t.texto()).toContain('Beto');
    expect(t.texto()).not.toContain('Ana');
  });

  it('com id (edição): ignora cliente', async () => {
    const t = await montar('v-1', { cliente: 'c-9' });
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush({ ...VENDA_EDICAO, itens: [] });
    await assentar(t.fixture);
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    t.http.expectNone('/api/clientes/v1/clientes/c-9');
    await t.responderSaldos('c-1');
  });

  it('obter falha: abre sem cliente', async () => {
    const t = await montar(undefined, { cliente: 'c-1' });
    t.http
      .expectOne('/api/clientes/v1/clientes/c-1')
      .flush({ code: 'X', message: 'x', traceId: 't' }, { status: 404, statusText: 'Not Found' });
    await assentar(t.fixture);
    expect(t.botao('Escolha o cliente').disabled).toBe(true);
  });
});

describe('PdvPage em modo edição', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function montarEdicao(venda: VendaDetalheResponse = VENDA_EDICAO) {
    const t = await montar('v-1');
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(venda);
    await assentar(t.fixture);
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    await t.responderSaldos('c-1');
    return t;
  }

  async function responderLista(t: T) {
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);
  }

  it('(a) pré-carga: cliente, itens, cascos e sucata na mesma tela; sem Repetir', async () => {
    const t = await montarEdicao();

    expect(t.texto()).toContain('Editar venda');
    expect(t.texto(t.el.querySelector('.cliente-fixo')!)).toContain('Ana');
    expect(t.el.querySelectorAll('.prod--sel')).toHaveLength(2);
    expect(t.barra()).toMatch(/2 itens · desc. R\$ 5,00 R\$ 95,00/);
    expect(t.texto()).not.toContain('Repetir última venda');

    await t.cobrar();
    expect(t.campoDoPainel('ce-quantity-stepper input', 0).value).toBe('2');
    expect(t.campoDoPainel('ce-quantity-stepper input', 1).value).toBe('1');
    expect(t.botaoEm(t.painel(), 'Salvar alterações')).toBeTruthy();
    // Na edição o saldo já inclui a venda original: o texto de casco não cita o cliente.
    expect(t.texto(t.painel())).toContain('Devolveu 1 a mais');
    expect(t.texto(t.painel())).not.toContain('Confirmar venda');
  });

  it('(b) altera um item e salva: PUT com o corpo esperado, fecha a sheet e navega ao detalhe', async () => {
    const t = await montarEdicao();
    t.abrir.mockReturnValueOnce({
      closed: of({
        ...itemDe(AGUA, 1),
        quantidade: 3,
        desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
      }),
    });
    t.linha(AGUA).querySelector<HTMLElement>('.prod__link')!.click();
    await assentar(t.fixture);
    await t.cobrar();

    await t.clicarNoPainel('Salvar alterações');
    const req = t.http.expectOne(`${URL_VENDAS}/v-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      ...CORPO_ORIGINAL,
      itens: [{ ...CORPO_ORIGINAL.itens[0], quantidade: 3 }, CORPO_ORIGINAL.itens[1]],
    });
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await responderLista(t);

    expect(t.navegar).toHaveBeenCalledWith('/vendas/detalhe/v-1');
    expect(t.aberta()).toBe(false);
  });

  it('(c) salvar sem mexer reenvia cascos, sucata, pagamentos e vendedor originais', async () => {
    const t = await montarEdicao();
    await t.cobrar();

    await t.clicarNoPainel('Salvar alterações');
    const req = t.http.expectOne(`${URL_VENDAS}/v-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(CORPO_ORIGINAL);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await responderLista(t);
  });

  it('(d) 409 CAIXA_FECHADO, 400 e 422 aparecem inline e mantêm o botão', async () => {
    const t = await montarEdicao();
    await t.cobrar();
    const falhar = async (status: number, code: string, message: string) => {
      await t.clicarNoPainel('Salvar alterações');
      t.http
        .expectOne(`${URL_VENDAS}/v-1`)
        .flush({ code, message, traceId: 't' }, { status, statusText: 'Erro' });
      await assentar(t.fixture);
    };

    await falhar(409, 'CAIXA_FECHADO', 'caixa fechado');
    expect(t.alertas()).toContain('O caixa do dia já está fechado.');
    expect(t.texto(t.painel())).toMatch(/Total ?R\$ 95,00/);
    expect(t.botaoEm(t.painel(), 'Salvar alterações').disabled).toBe(false);

    await falhar(400, 'ITEM_INVALIDO', 'Quantidade do item deve ser positiva.');
    expect(t.alertas()).toEqual(['Quantidade do item deve ser positiva.']);

    await falhar(422, 'VENDA_JA_FATURADA', 'x');
    expect(t.alertas()).toContain('Venda com cupom fiscal emitido não pode ser editada.');
    expect(t.navegar).not.toHaveBeenCalled();
  });

  it('(g) cupomEmitido: aviso somente leitura, sem barra, sem sheet e sem PUT', async () => {
    const t = await montarEdicao({ ...VENDA_EDICAO, cupomEmitido: true });

    const aviso = t.el.querySelector('[data-testid="venda-somente-leitura"]');
    expect(aviso?.textContent).toContain('Venda com cupom emitido não pode ser editada.');
    expect(t.texto()).not.toContain('Salvar alterações');
    expect(t.el.querySelector('.barra')).toBeNull();
    // verify() no afterEach garante que nenhum PUT foi feito.
  });

  it('GET da venda com 404 mostra mensagem inline e nenhuma ação de salvar', async () => {
    const t = await montar('v-1');
    t.http
      .expectOne(`${URL_VENDAS}/v-1`)
      .flush(
        { code: 'VENDA_NAO_ENCONTRADA', message: 'Venda não encontrada.', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toHaveLength(1);
    expect(t.texto()).not.toContain('Salvar alterações');
    expect(t.el.querySelector('.barra')).toBeNull();
  });
});
