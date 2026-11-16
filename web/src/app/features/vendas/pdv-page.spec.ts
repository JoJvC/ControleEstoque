import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, map, of } from 'rxjs';
import { vi } from 'vitest';

import { ClienteResponse, SaldosResponse } from '../../core/api/models/clientes';
import { ProdutoResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { VendaDetalheResponse, VendaResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { ItemCarrinho, itemNovo } from './carrinho';
import { ItemVendaSheet } from './item-venda-sheet';
import { PdvPage } from './pdv-page';

const URL_VENDAS = '/api/vendas/v1/vendas';

const TIPO_T: TipoCascoResponse = {
  id: 't-1',
  nome: 'Casco 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 30,
  aceitaSucata: true,
};
const TIPO_B: TipoCascoResponse = {
  id: 't-2',
  nome: 'Casco 10L',
  marcaId: null,
  marca: null,
  precoVasilhame: 15,
  aceitaSucata: false,
};
const TIPOS = [TIPO_T, TIPO_B];

// Uma marca (Indaiá, R$ 50) por produto; `casco` é o tipo de casco resolvido da marca.
function produto(
  id: string,
  nome: string,
  tipo: ProdutoResponse['tipo'],
  quantidade = 0,
  casco: string | null = tipo === 'RETORNAVEL' ? 't-1' : null,
): ProdutoResponse {
  return produtoResp({
    id,
    tipo,
    nome,
    marcas: [marcaResp({ quantidade, tipoCascoResolvidoId: casco })],
  });
}

const AGUA = produto('p-agua', 'Água 20L', 'RETORNAVEL', 12);
const GALAO = produto('p-galao', 'Galão vazio', 'DESCARTAVEL');
const GELO = { ...produto('p-gelo', 'Gelo 5kg', 'DESCARTAVEL', 7), categoria: 'Gelo' };
// Retornável de outro tipo de casco (10L, sem sucata).
const AGUA_10 = produto('p-agua10', 'Água 10L', 'RETORNAVEL', 4, 't-2');
const COPO = { ...produto('p-copo', 'Copo 200ml', 'DESCARTAVEL'), categoria: 'Copos' };

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
  return itemNovo(p, p.marcas[0], quantidade);
}

const RESPOSTA: VendaResponse = {
  id: 'v-1',
  totalBruto: 250,
  totalDesconto: 0,
  totalLiquido: 250,
  totalPago: 200,
  descontoSucata: 0,
  creditoGerado: 0,
  saldoFiadoGerado: 50,
  statusPagamento: 'PARCIAL',
  saldoCascoCliente: 2,
  saldoCascoClientePorTipo: [{ tipoCascoId: 't-1', nome: 'Casco 20L', saldo: 2 }],
};

const SALDOS: SaldosResponse = {
  saldoCascos: 3,
  sucataEntregue: 0,
  saldoFiado: 40,
  saldo: -40,
  creditoDisponivel: 0,
  cascosPorTipo: [{ tipoCascoId: 't-1', nome: 'Casco 20L', saldo: 3 }],
  sucataPorTipo: [],
};
const SALDOS_ZERO: SaldosResponse = {
  saldoCascos: 0,
  sucataEntregue: 0,
  saldoFiado: 0,
  saldo: 0,
  creditoDisponivel: 0,
  cascosPorTipo: [],
  sucataPorTipo: [],
};
const SALDOS_CREDITO: SaldosResponse = { ...SALDOS_ZERO, saldo: 30, creditoDisponivel: 30 };

// A SheetService é a de verdade; só a sheet do item é dublê. No celular a cobrança é o passo a passo (sem sheet).
async function montar(
  idVenda?: string,
  opcoes: {
    desktop?: boolean;
    cliente?: string;
    repetirUltima?: string;
    catalogoFalha?: boolean;
    catalogo?: ProdutoResponse[];
  } = {},
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
  if (opcoes.repetirUltima) {
    fixture.componentRef.setInput('repetirUltima', opcoes.repetirUltima);
  }
  const el = fixture.nativeElement as HTMLElement;
  const produtosReq = http.expectOne('/api/estoque/v1/produtos');
  http.expectOne('/api/estoque/v1/tipos-casco').flush(TIPOS);
  if (opcoes.catalogoFalha) {
    produtosReq.flush(
      { code: 'ERRO_X', message: 'falhou', traceId: 't' },
      { status: 500, statusText: 'Server Error' },
    );
  } else {
    produtosReq.flush(opcoes.catalogo ?? [AGUA, GALAO, GELO, COPO, AGUA_10]);
  }
  await assentar(fixture);

  // Onde a cobrança aparece: o painel na coluna da direita (desktop) ou o passo atual do passo a passo (celular).
  const painel = () =>
    el.querySelector<HTMLElement>('ce-cobrar-painel') ??
    el.querySelector<HTMLElement>('ce-passo-a-passo')!;
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
    Array.from(
      painel().querySelectorAll<HTMLInputElement>('.forma-linha ce-money-input input'),
    ).map((i) => i.value);

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
  // Uma linha por produto+marca: o rótulo é 'Nome — Marca' (todas as fixtures usam a marca Indaiá).
  const rotulo = (p: ProdutoResponse, marca = 'Indaiá') => `${p.nome} — ${marca}`;
  const linha = (p: ProdutoResponse, marca = 'Indaiá'): HTMLElement => {
    const achada = Array.from(el.querySelectorAll<HTMLElement>('.prod')).find((l) =>
      l.textContent?.includes(rotulo(p, marca)),
    );
    if (!achada) {
      throw new Error(`linha "${rotulo(p, marca)}" não encontrada`);
    }
    return achada;
  };
  // Toque na linha do catálogo: adiciona uma unidade.
  const tocar = async (p: ProdutoResponse, vezes = 1) => {
    for (let i = 0; i < vezes; i++) {
      linha(p)
        .querySelector<HTMLElement>(`button[aria-label="Adicionar ${rotulo(p)}"]`)!
        .click();
      await assentar(fixture);
    }
  };
  const aumentar = async (p: ProdutoResponse) => {
    linha(p)
      .querySelector<HTMLElement>(`button[aria-label="Aumentar ${rotulo(p)}"]`)!
      .click();
    await assentar(fixture);
  };
  const diminuir = async (p: ProdutoResponse) => {
    linha(p)
      .querySelector<HTMLElement>(`button[aria-label="Diminuir ${rotulo(p)}"]`)!
      .click();
    await assentar(fixture);
  };
  const barra = () => texto(el.querySelector('.barra')!);
  const botaoContinuar = () =>
    el.querySelector<HTMLButtonElement>('[data-testid="passo-continuar"] button')!;
  const botaoVoltar = () =>
    el.querySelector<HTMLButtonElement>('[data-testid="passo-voltar"] button');
  const trilho = () => el.querySelector('[data-testid="passo-trilho"]')?.textContent?.trim();
  const continuar = async () => {
    botaoContinuar().click();
    await assentar(fixture);
  };
  const voltar = async () => {
    botaoVoltar()!.click();
    await assentar(fixture);
  };
  // Vai até o último passo (Pagamento), o que o antigo toque em 'Cobrar' abria.
  const cobrar = async () => {
    while (el.querySelector('[data-testid="passo-continuar"]')) {
      await continuar();
    }
  };
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
    rotulo,
    tocar,
    aumentar,
    diminuir,
    barra,
    cobrar,
    botaoContinuar,
    botaoVoltar,
    trilho,
    continuar,
    voltar,
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
      marcaId: 'm-1',
      tipoCascoId: 't-1',
      quantidade: 1,
      precoUnitario: 50,
      descontoTipo: 'PERCENTUAL',
      descontoValor: 10,
      motivoDesconto: null,
      totalItem: 45,
    },
    {
      produtoId: 'p-galao',
      marcaId: 'm-1',
      tipoCascoId: null,
      quantidade: 1,
      precoUnitario: 50,
      descontoTipo: null,
      descontoValor: null,
      motivoDesconto: null,
      totalItem: 50,
    },
  ],
  pagamentos: [{ forma: 'DINHEIRO', valor: 30 }],
  cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 2 }],
  vasilhames: [],
  sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 0 }],
};

const CORPO_ORIGINAL = {
  clienteId: 'c-1',
  funcionarioId: 'f-orig',
  enderecoEntregaId: 'c-1-e1',
  itens: [
    {
      produtoId: 'p-agua',
      marcaId: 'm-1',
      quantidade: 1,
      precoUnitario: 50,
      desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
    },
    {
      produtoId: 'p-galao',
      marcaId: 'm-1',
      quantidade: 1,
      precoUnitario: 50,
      desconto: null,
    },
  ],
  vasilhames: [],
  pagamentos: [{ forma: 'DINHEIRO', valor: 30 }],
  cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 2 }],
  sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 0 }],
  observacao: 'entregar à tarde',
};

const itemAntigo = (produtoId: string, quantidade: number, precoUnitario: number) => ({
  produtoId,
  marcaId: 'm-1',
  tipoCascoId: null,
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
    expect(t.botaoContinuar().disabled).toBe(true);
    await t.escolherCliente(cliente('c-1', 'Ana'));
    expect(t.botaoContinuar().disabled).toBe(true);
    expect(t.barra()).toContain('0 itens');

    await t.tocar(AGUA);
    expect(t.barra()).toMatch(/1 item R\$ 50,00/);
    expect(t.botaoContinuar().disabled).toBe(false);

    await t.aumentar(AGUA);
    await t.tocar(GELO);
    expect(t.barra()).toMatch(/3 itens R\$ 150,00/);

    await t.diminuir(AGUA);
    expect(t.barra()).toMatch(/2 itens R\$ 100,00/);
    await t.diminuir(AGUA);
    await t.diminuir(GELO);
    expect(t.el.querySelectorAll('.prod--sel')).toHaveLength(0);
    expect(t.barra()).toContain('0 itens');
    expect(t.botaoContinuar().disabled).toBe(true);
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('a linha mostra estoque e preço; as pílulas filtram por categoria', async () => {
    const t = await montar();
    expect(t.texto(t.linha(AGUA))).toMatch(/Estoque: 12 · R\$ 50,00/);
    const nomes = () =>
      Array.from(t.el.querySelectorAll('.prod__nome'))
        .map((n) => n.textContent)
        .filter((n) => !n?.startsWith('Vasilhame'));
    expect(nomes()).toHaveLength(5);

    await t.clicar('Gelo');
    expect(nomes()).toEqual(['Gelo 5kg — Indaiá']);
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
      marca: AGUA.marcas[0],
      existente: itemDe(AGUA, 2),
      clienteId: 'c-1',
    });
    expect(t.texto(t.linha(AGUA))).toContain('preço editado');
    expect(t.barra()).toContain('R$ 90,00');

    t.abrir.mockReturnValueOnce({ closed: of('remover') });
    await t.clicar('Preço e desconto');
    expect(t.el.querySelectorAll('.prod--sel')).toHaveLength(0);
  });

  it('Enter na busca de produto abre o sheet da primeira linha produto+marca filtrada', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));

    t.abrir.mockReturnValueOnce({ closed: of(undefined) });
    const busca = t.campo('ce-search-box input[placeholder^="Buscar por nome"]');
    busca.value = 'galao';
    busca.dispatchEvent(new Event('input'));
    await t.enter(busca);

    expect(t.abrir).toHaveBeenCalledWith(expect.anything(), {
      produto: GALAO,
      marca: GALAO.marcas[0],
      existente: null,
      clienteId: 'c-1',
    });
  });

  it('cliente fixo no topo: chips de casco e fiado do servidor; Trocar volta à busca', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    const topo = t.el.querySelector<HTMLElement>('.cliente-fixo')!;
    expect(t.texto(topo)).toContain('Ana');
    expect(t.texto(topo)).toMatch(/Casco 3/);
    expect(t.texto(topo)).toMatch(/Fiado R\$ 40,00/);
    expect(topo.querySelector('.chip--fiado')).not.toBeNull();

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
    expect(t.botaoContinuar().disabled).toBe(true);

    t.el.querySelectorAll<HTMLElement>('[role="radio"]')[1].click();
    await assentar(t.fixture);

    expect(t.botaoContinuar().disabled).toBe(false);
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

describe('PdvPage: cobrar no celular (passo a passo)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('chip de saldo positivo é "Crédito R$ x" em tom pago', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS_CREDITO);
    const topo = t.el.querySelector<HTMLElement>('.cliente-fixo')!;
    expect(t.texto(topo)).toMatch(/Crédito R\$ 30,00/);
    expect(topo.querySelector('.chip--pago')).not.toBeNull();
    expect(topo.querySelector('.chip--fiado')).toBeNull();
  });

  it('chip de saldo zerado é "Em dia" em tom pago', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS_ZERO);
    const topo = t.el.querySelector<HTMLElement>('.cliente-fixo')!;
    expect(t.texto(topo)).toContain('Em dia');
    expect(topo.querySelector('.chip--pago')).not.toBeNull();
  });

  it('o pagamento reage ao que se digita; ao ir para o desktop o painel fica na tela e o passo a passo some', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(AGUA, 2);
    await t.cobrar();

    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '4000');
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 60,00/);

    t.largura.next(true);
    await assentar(t.fixture);
    expect(t.trilho()).toBeUndefined();
    expect(t.el.querySelector('.grade__venda ce-cobrar-painel')).not.toBeNull();
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 60,00/);

    t.largura.next(false);
    await assentar(t.fixture);
    expect(t.trilho()).toBe('1 de 3 · Cliente e produtos');
  });

  it('passeio 7: 5 águas, 3 devolvidos, 1 sucata, PIX 200 → fiado 50 antes; PARCIAL, fiado 50 e casco 2 depois', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    await t.tocar(AGUA, 5);
    expect(t.barra()).toMatch(/5 itens R\$ 250,00/);
    await t.continuar();

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '3');
    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 1), '1');
    expect(t.texto(t.painel())).toContain('Casco 20L: Ficam 5 cascos na rua com Ana');
    await t.continuar();

    t.exato(t.painel(), 'PIX')[0].click();
    await assentar(t.fixture);
    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '20000');
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 50,00/);

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      clienteId: 'c-1',
      funcionarioId: 'f-1',
      enderecoEntregaId: 'c-1-e1',
      itens: [
        {
          produtoId: 'p-agua',
          marcaId: 'm-1',
          quantidade: 5,
          precoUnitario: 50,
          desconto: null,
        },
      ],
      vasilhames: [],
      pagamentos: [{ forma: 'PIX', valor: 200 }],
      cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 3 }],
      sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 0 }],
      observacao: null,
    });
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost({
      saldoCascos: 2,
      sucataEntregue: 1,
      saldoFiado: 90,
      saldo: -90,
      creditoDisponivel: 0,
      cascosPorTipo: [{ tipoCascoId: 't-1', nome: 'Casco 20L', saldo: 2 }],
      sucataPorTipo: [{ tipoCascoId: 't-1', nome: 'Casco 20L', quantidade: 1 }],
    });

    expect(t.el.querySelector('ce-passo-a-passo')).toBeNull();
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
    expect(t.botaoContinuar().disabled).toBe(true);
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

describe('PdvPage: passo a passo no celular', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const comAgua = async (quantidade = 2) => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    await t.tocar(AGUA, quantidade);
    return t;
  };

  it('roteiro: 2 galões, 1 casco devolvido, voltar sem perder nada, Tudo e Confirmar enviam cascos e pagamento', async () => {
    const t = await comAgua(2);
    expect(t.trilho()).toBe('1 de 3 · Cliente e produtos');
    expect(t.el.querySelector('.cliente-fixo')).not.toBeNull();

    await t.continuar();
    expect(t.trilho()).toBe('2 de 3 · Cascos');
    await t.digitar(t.campoDoPainel('.casco ce-quantity-stepper input'), '1');

    await t.voltar();
    expect(t.trilho()).toBe('1 de 3 · Cliente e produtos');
    expect(t.linha(AGUA).querySelector<HTMLInputElement>('ce-quantity-stepper input')!.value).toBe(
      '2',
    );

    await t.continuar();
    expect(t.trilho()).toBe('2 de 3 · Cascos');
    expect(t.campoDoPainel('.casco ce-quantity-stepper input').value).toBe('1');

    await t.continuar();
    expect(t.trilho()).toBe('3 de 3 · Pagamento');
    t.exato(t.painel(), 'Tudo')[0].click();
    await assentar(t.fixture);
    expect(t.valores()).toEqual(['100,00']);

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toEqual([{ tipoCascoId: 't-1', quantidade: 1 }]);
    expect(req.request.body.pagamentos).toEqual([{ forma: 'DINHEIRO', valor: 100 }]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();

    expect(TestBed.inject(SheetService).abrir).not.toHaveBeenCalled();
    expect(t.texto()).toContain('Venda registrada');
  });

  it('retornável no carrinho: o quadro de vasilhames aparece no passo 2 com a linha do tipo em 0; subir a quantidade equivale a adicionar o vasilhame', async () => {
    const t = await comAgua(2);
    await t.continuar();

    expect(t.texto(t.painel())).toContain('Vasilhames comprados agora');
    expect(t.campoDoPainel('.vasilhame ce-quantity-stepper input').value).toBe('0');
    expect(t.campoDoPainel('.vasilhame ce-money-input input').value).toBe('30,00');
    expect(t.campoDoPainel('.vasilhame ce-money-input input').disabled).toBe(true);
    expect(t.painel().querySelector('.modos')).toBeNull();

    await t.digitar(t.campoDoPainel('.vasilhame ce-quantity-stepper input'), '1');
    expect(t.trilho()).toBe('2 de 3 · Cascos');
    expect(t.campoDoPainel('.vasilhame ce-money-input input').disabled).toBe(false);

    await t.continuar();
    t.exato(t.painel(), 'Tudo')[0].click();
    await assentar(t.fixture);
    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 1, precoUnitario: 30, modoCredito: 'ABATER_CREDITO' },
    ]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('retornável no carrinho, quantidade do vasilhame de volta a 0: a linha continua e nada vai no pedido', async () => {
    const t = await comAgua(2);
    await t.continuar();
    await t.digitar(t.campoDoPainel('.vasilhame ce-quantity-stepper input'), '1');
    await t.digitar(t.campoDoPainel('.vasilhame ce-quantity-stepper input'), '0');

    expect(t.campoDoPainel('.vasilhame ce-quantity-stepper input').value).toBe('0');
    expect(t.trilho()).toBe('2 de 3 · Cascos');

    await t.continuar();
    t.exato(t.painel(), 'Tudo')[0].click();
    await assentar(t.fixture);
    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.vasilhames ?? []).toEqual([]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('com crédito de galão do tipo, a linha em 0 mostra Abater/Comprar desabilitado até a quantidade subir', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS_CREDITO_CASCO);
    await t.tocar(AGUA, 2);
    await t.continuar();

    const botoes = () =>
      Array.from(t.painel().querySelectorAll<HTMLButtonElement>('.vasilhame .modos button'));
    expect(botoes()).toHaveLength(2);
    expect(botoes().every((b) => b.disabled)).toBe(true);

    await t.digitar(t.campoDoPainel('.vasilhame ce-quantity-stepper input'), '1');
    expect(botoes().every((b) => !b.disabled)).toBe(true);
  });

  it('só descartáveis: Continuar cai direto no pagamento (2 de 2)', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(COPO);
    expect(t.trilho()).toBe('1 de 2 · Cliente e produtos');

    await t.continuar();

    expect(t.trilho()).toBe('2 de 2 · Pagamento');
    expect(t.el.querySelector('ce-passo-pagamento')).not.toBeNull();
    expect(t.el.querySelector('ce-passo-cascos')).toBeNull();
    expect(t.el.querySelector('[data-testid="passo-continuar"]')).toBeNull();
  });

  it('só com vasilhame comprado do tipo B: 3 passos e o passo 2 mostra o vasilhame', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    t.el.querySelector<HTMLElement>('button[aria-label="Adicionar Vasilhame Casco 10L"]')!.click();
    await assentar(t.fixture);
    expect(t.trilho()).toBe('1 de 3 · Cliente e produtos');

    await t.continuar();

    expect(t.trilho()).toBe('2 de 3 · Cascos');
    expect(t.texto(t.painel())).toContain('Vasilhame Casco 10L');
    expect(t.campoDoPainel('.vasilhame ce-quantity-stepper input').value).toBe('1');
  });

  it('Continuar fica desabilitado sem cliente e sem itens; Voltar não existe no 1º passo', async () => {
    const t = await montar();
    expect(t.botaoContinuar().disabled).toBe(true);
    expect(t.botaoVoltar()).toBeNull();

    await t.escolherCliente(cliente('c-1', 'Ana'));
    expect(t.botaoContinuar().disabled).toBe(true);

    await t.tocar(AGUA);
    expect(t.botaoContinuar().disabled).toBe(false);
  });

  it('voltar do passo 3 ao 1 e avançar de novo mantém carrinho, cascos, sucata e pagamentos', async () => {
    const t = await comAgua(2);
    await t.continuar();
    await t.digitar(t.campoDoPainel('.casco ce-quantity-stepper input'), '1');
    await t.digitar(t.campoDoPainel('.sucata ce-quantity-stepper input'), '1');
    await t.digitar(t.campoDoPainel('.sucata ce-money-input input'), '500');
    await t.continuar();
    t.exato(t.painel(), 'PIX')[0].click();
    await assentar(t.fixture);
    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '3000');

    await t.voltar();
    await t.voltar();
    expect(t.trilho()).toBe('1 de 3 · Cliente e produtos');
    expect(t.linha(AGUA).querySelector<HTMLInputElement>('ce-quantity-stepper input')!.value).toBe(
      '2',
    );

    await t.continuar();
    expect(t.campoDoPainel('.casco ce-quantity-stepper input').value).toBe('1');
    expect(t.campoDoPainel('.sucata ce-quantity-stepper input').value).toBe('1');
    expect(t.campoDoPainel('.sucata ce-money-input input').value).toBe('5,00');

    await t.continuar();
    expect(t.valores()).toEqual(['30,00']);
    expect(t.exato(t.painel(), 'PIX')[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('sucata acima do total depois de diminuir o carrinho: dá para voltar ao passo 2 e corrigir', async () => {
    const t = await comAgua(2);
    await t.continuar();
    await t.digitar(t.campoDoPainel('.sucata ce-quantity-stepper input'), '2');
    await t.digitar(t.campoDoPainel('.sucata ce-money-input input'), '4000');
    await t.voltar();
    await t.diminuir(AGUA); // total cai para R$ 50, abaixo dos R$ 80 de sucata

    expect(t.botaoContinuar().disabled).toBe(false);
    await t.continuar();
    expect(t.trilho()).toBe('2 de 3 · Cascos');
    expect(t.texto(t.painel())).toContain('O desconto da sucata passa do total da venda');
    expect(t.botaoContinuar().disabled).toBe(true);

    await t.digitar(t.campoDoPainel('.sucata ce-money-input input'), '1000');
    expect(t.botaoContinuar().disabled).toBe(false);
  });

  it('erro 4xx do servidor deixa a tela no passo 3 com a mensagem', async () => {
    const t = await comAgua(1);
    await t.cobrar();
    expect(t.trilho()).toBe('3 de 3 · Pagamento');

    await t.clicarNoPainel('Confirmar venda');
    t.http
      .expectOne(URL_VENDAS)
      .flush(
        { code: 'CAIXA_FECHADO', message: 'caixa fechado', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar(t.fixture);

    expect(t.trilho()).toBe('3 de 3 · Pagamento');
    expect(t.alertas()).toContain('O caixa do dia já está fechado.');
  });

  it('depois de registrar, "Nova venda" recomeça no passo 1', async () => {
    const t = await comAgua(1);
    await t.cobrar();
    await t.clicarNoPainel('Confirmar venda');
    await t.aposRegistro();

    await t.clicar('Nova venda');
    await t.escolherCliente(cliente('c-1', 'Ana'));

    expect(t.trilho()).toBe('1 de 2 · Cliente e produtos');
  });

  it('ao virar desktop o rascunho fica; ao voltar ao celular o passo volta ao 1º', async () => {
    const t = await comAgua(2);
    await t.cobrar();
    t.exato(t.painel(), 'PIX')[0].click();
    await assentar(t.fixture);

    t.largura.next(true);
    await assentar(t.fixture);
    expect(t.trilho()).toBeUndefined();
    expect(t.el.querySelector('.grade__venda ce-cobrar-painel')).not.toBeNull();
    expect(t.exato(t.painel(), 'PIX')[0].getAttribute('aria-pressed')).toBe('true');

    t.largura.next(false);
    await assentar(t.fixture);
    expect(t.trilho()).toBe('1 de 3 · Cliente e produtos');
    expect(t.el.querySelector('ce-cobrar-painel')).toBeNull();
  });

  it('no desktop não há trilho; o aside com o painel continua', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(AGUA);

    expect(t.trilho()).toBeUndefined();
    expect(t.el.querySelector('aside ce-cobrar-painel')).not.toBeNull();
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
    expect(t.el.querySelectorAll('.grade__catalogo .prod')).toHaveLength(7); // 5 produtos + 2 vasilhames
    expect(t.el.querySelector('.barra')).toBeNull();
    expect(document.querySelector('.ce-sheet-panel')).toBeNull();
    expect(t.el.querySelector('ce-passo-a-passo')).toBeNull();
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('"Devolveu todos na hora" trava o stepper de cada tipo no vendido em troca; desmarcar libera a partir do valor', async () => {
    const t = await comAguas(5);
    const toggle = t.campoDoPainel('ce-checkbox input');
    const casco = () => t.campoDoPainel('.casco ce-quantity-stepper input', 0);
    expect(t.texto(t.painel())).toContain('Devolveu todos na hora');
    expect(casco().disabled).toBe(false);

    toggle.click();
    await assentar(t.fixture);
    expect(casco().disabled).toBe(true);
    expect(casco().value).toBe('5');

    toggle.click();
    await assentar(t.fixture);
    expect(casco().disabled).toBe(false);
    expect(casco().value).toBe('5');

    await t.digitar(casco(), '3');
    expect(casco().value).toBe('3');
  });

  it('com "na hora" marcado, mudar a quantidade no carrinho atualiza o valor travado', async () => {
    const t = await comAguas(5);
    t.campoDoPainel('ce-checkbox input').click();
    await assentar(t.fixture);
    const casco = () => t.campoDoPainel('.casco ce-quantity-stepper input', 0);
    expect(casco().value).toBe('5');

    await t.aumentar(AGUA);
    expect(casco().value).toBe('6');
    expect(casco().disabled).toBe(true);

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toEqual([{ tipoCascoId: 't-1', quantidade: 6 }]);
    expect(req.request.body.itens[0].quantidade).toBe(6);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('desmarcar "na hora" e editar: o valor editado vai no pedido', async () => {
    const t = await comAguas(5);
    const toggle = t.campoDoPainel('ce-checkbox input');
    toggle.click();
    await assentar(t.fixture);
    toggle.click();
    await assentar(t.fixture);
    await t.digitar(t.campoDoPainel('.casco ce-quantity-stepper input', 0), '4');
    await t.aumentar(AGUA);
    expect(t.campoDoPainel('.casco ce-quantity-stepper input', 0).value).toBe('4');

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toEqual([{ tipoCascoId: 't-1', quantidade: 4 }]);
    expect(req.request.body.itens[0].quantidade).toBe(6);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('um stepper de devolução por tipo do carrinho; sucata só para o tipo que aceita; "na hora" trava os dois', async () => {
    const t = await comAguas(2);
    await t.tocar(AGUA_10, 3);
    const painel = t.painel();
    expect(painel.querySelectorAll('.casco ce-quantity-stepper')).toHaveLength(2);
    expect(painel.querySelectorAll('.sucata ce-quantity-stepper')).toHaveLength(1);
    expect(t.texto(painel.querySelector('.sucata')!)).toContain('Casco 20L');
    expect(t.texto(painel.querySelector('.sucata')!)).not.toContain('Casco 10L');

    t.campoDoPainel('ce-checkbox input').click();
    await assentar(t.fixture);
    const campos = Array.from(
      painel.querySelectorAll<HTMLInputElement>('.casco ce-quantity-stepper input'),
    );
    expect(campos.map((c) => [c.value, c.disabled])).toEqual([
      ['2', true],
      ['3', true],
    ]);

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toEqual([
      { tipoCascoId: 't-1', quantidade: 2 },
      { tipoCascoId: 't-2', quantidade: 3 },
    ]);
    expect(req.request.body.sucataEntregue).toEqual([]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('tipo que sai do carrinho some da seção e do pedido', async () => {
    const t = await comAguas(2);
    await t.tocar(AGUA_10, 3);
    await t.digitar(t.campoDoPainel('.casco ce-quantity-stepper input', 1), '2');
    await t.diminuir(AGUA_10);
    await t.diminuir(AGUA_10);
    await t.diminuir(AGUA_10);

    expect(t.painel().querySelectorAll('.casco ce-quantity-stepper')).toHaveLength(1);
    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toEqual([]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('casco e sucata são campos separados e a sucata não abate o débito de casco', async () => {
    const t = await comAguas(2);
    const painel = t.painel();
    // casco, sucata e a linha do vasilhame (sempre presente com retornável no carrinho)
    expect(painel.querySelectorAll('ce-quantity-stepper')).toHaveLength(3);
    expect(painel.querySelector('.vasilhame ce-quantity-stepper')).not.toBeNull();
    expect(t.texto(painel.querySelector('.casco')!)).toContain('Cascos devolvidos agora');
    expect(t.texto(painel.querySelector('.sucata')!)).toContain('Sucata entregue agora');
    expect(t.texto(painel.querySelector('.sucata')!)).toContain(
      'Sucata não abate o débito de casco',
    );

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 1), '2');
    expect(t.texto(painel)).toContain('Casco 20L: Ficam 5 cascos na rua com Ana');
  });

  it('só descartável no carrinho: sem seção de cascos e o pedido vai com as listas vazias', async () => {
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
    expect(req.request.body.cascosDevolvidos).toEqual([]);
    expect(req.request.body.sucataEntregue).toEqual([]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('formas, valor e atalhos Tudo, Metade e Tudo fiado sempre visíveis; "Vai para fiado: R$ X" muda ao digitar; acima do total vira crédito', async () => {
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

    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '20000');
    expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 50,00/);

    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '30000');
    expect(t.alertas()).toEqual([]);
    expect(t.texto(t.painel())).toContain('Sobra de R$ 50,00 vira crédito de Ana');
    expect(t.botaoEm(t.painel(), 'Confirmar venda').disabled).toBe(false);

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
    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '10000');

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

  describe('pagar com Crédito do cliente', () => {
    const comCredito = async (saldos: SaldosResponse = SALDOS_CREDITO) => {
      const t = await montar(undefined, { desktop: true });
      await t.escolherCliente(cliente('c-1', 'Ana'), saldos);
      await t.tocar(AGUA, 5);
      return t;
    };

    it('crédito 30, digitar 80 no campo: fica em 30 e o pedido leva CREDITO_CLIENTE 30', async () => {
      const t = await comCredito();
      t.exato(t.painel(), 'Crédito do cliente')[0].click();
      await assentar(t.fixture);
      expect(t.valores()).toEqual(['30,00']);

      await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '1000');
      expect(t.valores()).toEqual(['10,00']);
      await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '8000');
      expect(t.valores()).toEqual(['30,00']);
      expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 220,00/);

      await t.clicarNoPainel('Confirmar venda');
      const req = t.http.expectOne(URL_VENDAS);
      expect(req.request.body.pagamentos).toEqual([{ forma: 'CREDITO_CLIENTE', valor: 30 }]);
    });

    it('Trocar de cliente tira a forma e a linha de crédito; "Vai para fiado" volta ao total', async () => {
      const t = await comCredito();
      t.exato(t.painel(), 'Crédito do cliente')[0].click();
      await assentar(t.fixture);
      await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '3000');
      expect(t.valores()).toEqual(['30,00']);
      expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 220,00/);

      await t.clicar('Trocar');
      expect(t.el.querySelector('ce-cobrar-painel')).toBeNull(); // sem cliente não há cobrança

      await t.escolherCliente(cliente('c-2', 'Bia'), SALDOS_ZERO);
      expect(t.valores()).toEqual([]);
      expect(t.exato(t.painel(), 'Crédito do cliente')).toHaveLength(0);
      expect(t.texto(t.painel())).toMatch(/Vai para fiado: R\$ 250,00/);
    });

    it('sem crédito disponível a forma não é oferecida', async () => {
      const t = await comCredito(SALDOS_ZERO);
      expect(t.exato(t.painel(), 'Crédito do cliente')).toHaveLength(0);
      expect(t.exato(t.painel(), 'PIX')).toHaveLength(1);
    });

    it('CREDITO_INSUFICIENTE mostra a mensagem e recarrega os saldos', async () => {
      const t = await comCredito();
      t.exato(t.painel(), 'Crédito do cliente')[0].click();
      await assentar(t.fixture);

      await t.clicarNoPainel('Confirmar venda');
      t.http
        .expectOne(URL_VENDAS)
        .flush(
          { code: 'CREDITO_INSUFICIENTE', message: 'x', traceId: 't' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      await assentar(t.fixture);
      t.http.expectOne('/api/clientes/v1/clientes/c-1/saldos').flush(SALDOS_ZERO);
      await assentar(t.fixture);

      expect(t.alertas()).toContain('Crédito do cliente insuficiente');
      expect(t.exato(t.painel(), 'Crédito do cliente')).toHaveLength(0);
      expect(t.valores()).toEqual([]);
    });
  });

  it('o número de cascos na rua soma o saldo do cliente (3) à água da venda e tira os devolvidos', async () => {
    const t = await comAguas(2);

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '1');
    expect(t.texto(t.painel())).toContain('Casco 20L: Ficam 4 cascos na rua com Ana');

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '4');
    expect(t.texto(t.painel())).toContain('Casco 20L: Fica 1 casco na rua com Ana');
  });

  it('o feedback de casco na rua usa o nome completo do cliente', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Dona Rosa'), SALDOS);
    await t.tocar(AGUA, 2);

    expect(t.texto(t.painel())).toContain('Casco 20L: Ficam 5 cascos na rua com Dona Rosa');
  });

  it('devolver mais do que o saldo mais a água mostra "Devolveu N a mais"', async () => {
    const t = await comAguas(2);

    await t.digitar(t.campoDoPainel('ce-quantity-stepper input', 0), '8');
    expect(t.texto(t.painel())).toContain('Devolveu 3 a mais');
    expect(t.texto(t.painel())).not.toContain('na rua');
  });

  it('"Outra forma" acrescenta uma linha já com o que falta pagar', async () => {
    const t = await comAguas(5);
    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '10000');

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

  it('Confirmar com pagamento acima do total envia os pagamentos como estão', async () => {
    const t = await comAguas(5);
    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '30000');

    t.painel().querySelector<HTMLElement>('[data-testid="confirmar-venda"]')!.click();
    await assentar(t.fixture);
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.pagamentos).toEqual([{ forma: 'DINHEIRO', valor: 300 }]);
  });

  it('no desktop o Confirmar fica fora da região que rola', async () => {
    const t = await comAguas(5);
    const confirmar = t.painel().querySelector('[data-testid="confirmar-venda"]');

    expect(t.painel().querySelector('[data-rolagem]')).not.toBeNull();
    expect(confirmar).not.toBeNull();
    expect(confirmar!.closest('[data-rolagem]')).toBeNull();
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

const SALDOS_CREDITO_CASCO: SaldosResponse = {
  ...SALDOS_ZERO,
  saldoCascos: -2,
  cascosPorTipo: [{ tipoCascoId: 't-1', nome: 'Casco 20L', saldo: -2 }],
};

describe('PdvPage: vasilhame na lista e sucata com valor (desktop)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const rotuloV = 'Vasilhame Casco 20L';
  const tocarVasilhame = async (t: T, vezes = 1) => {
    for (let i = 0; i < vezes; i++) {
      t.el.querySelector<HTMLElement>(`button[aria-label="Adicionar ${rotuloV}"]`)!.click();
      await assentar(t.fixture);
    }
  };

  it('a lista traz uma linha "Vasilhame <tipo>" por tipo de casco; tocar duas vezes deixa qtd 2, valor 30,00 e total 60,00', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));
    expect(t.el.querySelector('button[aria-label="Adicionar Vasilhame Casco 10L"]')).not.toBeNull();

    await tocarVasilhame(t, 2);

    expect(t.abrir).not.toHaveBeenCalled();
    expect(t.texto(t.painel())).toContain('Vasilhames comprados agora');
    expect(t.campoDoPainel('.vasilhame ce-quantity-stepper input').value).toBe('2');
    expect(t.campoDoPainel('.vasilhame ce-money-input input').value).toBe('30,00');
    expect(t.texto(t.painel())).toContain('Casco 20L: R$ 60,00');
    expect(t.texto(t.painel())).toMatch(/Total ?R\$ 60,00/);
    // A linha da lista mostra a quantidade atual.
    const linhaV = t.el.querySelector<HTMLElement>('.prod--sel')!;
    expect(linhaV.querySelector<HTMLInputElement>('ce-quantity-stepper input')!.value).toBe('2');
    // Sem saldo negativo, a escolha Abater/Comprar não aparece.
    expect(t.painel().querySelector('.modos')).toBeNull();

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.itens).toEqual([]);
    expect(req.request.body.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 2, precoUnitario: 30, modoCredito: 'ABATER_CREDITO' },
    ]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('quantidade 0 no quadro tira o tipo do quadro', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await tocarVasilhame(t);

    await t.digitar(t.campoDoPainel('.vasilhame ce-quantity-stepper input'), '0');

    expect(t.el.querySelector('ce-cobrar-painel')).toBeNull();
    expect(t.texto(t.el.querySelector('.grade__venda')!)).toContain('Toque nos produtos');
  });

  it('o filtro de categoria esconde o vasilhame; o texto filtra por "vasilhame <nome>"', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));

    await t.clicar('Gelo');
    expect(t.el.querySelector('button[aria-label^="Adicionar Vasilhame"]')).toBeNull();
    await t.clicar('Todos');

    const busca = t.campo('ce-search-box input[placeholder^="Buscar por nome"]');
    busca.value = 'vasilhame casco 10';
    busca.dispatchEvent(new Event('input'));
    await t.enter(busca);

    // Enter adiciona a primeira linha da lista filtrada: o vasilhame do tipo 10L.
    expect(t.el.querySelectorAll('.grade__catalogo .prod')).toHaveLength(1);
    expect(t.campoDoPainel('.vasilhame ce-quantity-stepper input').value).toBe('1');
    expect(t.campoDoPainel('.vasilhame ce-money-input input').value).toBe('15,00');
  });

  it('com saldo negativo: Abater cobra só o que passa do crédito; Comprar cobra tudo; sucata tem valor e desconto', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS_CREDITO_CASCO);
    await t.tocar(AGUA, 1);
    await tocarVasilhame(t, 3);

    // Crédito 2, qtd 3: abate 2 e cobra 1 (30,00); água 50,00.
    expect(t.texto(t.painel())).toContain('Casco 20L: R$ 30,00');
    expect(t.texto(t.painel())).toMatch(/Total ?R\$ 80,00/);
    expect(t.botaoEm(t.painel(), 'Abater do crédito').getAttribute('aria-pressed')).toBe('true');

    await t.clicarNoPainel('Comprar');
    expect(t.texto(t.painel())).toContain('Casco 20L: R$ 90,00');
    expect(t.texto(t.painel())).toMatch(/Total ?R\$ 140,00/);

    await t.digitar(t.campoDoPainel('.sucata ce-quantity-stepper input'), '2');
    await t.digitar(t.campoDoPainel('.sucata ce-money-input input'), '500');
    expect(t.texto(t.painel())).toContain('Desconto da sucata: R$ 10,00');
    expect(t.texto(t.painel())).toMatch(/Total ?R\$ 130,00/);

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(Object.keys(req.request.body.itens[0]).join()).not.toMatch(/vasilhame/i);
    expect(req.request.body.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 3, precoUnitario: 30, modoCredito: 'COMPRAR' },
    ]);
    expect(req.request.body.sucataEntregue).toEqual([
      { tipoCascoId: 't-1', quantidade: 2, valorUnitario: 5 },
    ]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('prévia dos cascos devolvidos espelha o servidor: crédito abatido zera, Comprar vira "Devolveu 2 a mais"', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS_CREDITO_CASCO);
    await t.tocar(AGUA, 1);
    await tocarVasilhame(t, 2);

    // Saldo −2 + empréstimo max(0, 1−2) − 0 devolvido + 2 abatidos = 0.
    expect(t.texto(t.painel())).toContain('Casco 20L: Ficam 0 cascos na rua com Ana');
    expect(t.texto(t.painel())).not.toContain('a mais');

    await t.clicarNoPainel('Comprar');
    expect(t.texto(t.painel())).toContain('Casco 20L: Devolveu 2 a mais');
  });

  it('chip do cliente com saldo de casco negativo mostra "a favor", sem sinal de menos', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'), {
      ...SALDOS_CREDITO_CASCO,
      saldoCascos: -2,
    });
    const topo = t.el.querySelector<HTMLElement>('.cliente-fixo')!;
    expect(t.texto(topo)).toContain('Casco 0 · 2 a favor');
    expect(t.texto(topo)).not.toContain('-2');
  });

  it('sucata sem valor digitado vai com valorUnitario 0', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(AGUA, 1);
    await t.digitar(t.campoDoPainel('.sucata ce-quantity-stepper input'), '1');

    await t.clicarNoPainel('Confirmar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.sucataEntregue).toEqual([
      { tipoCascoId: 't-1', quantidade: 1, valorUnitario: 0 },
    ]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await t.depoisDoPost();
  });

  it('desconto de sucata acima do total mostra o aviso e desabilita o Registrar', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.tocar(AGUA, 1);

    await t.digitar(t.campoDoPainel('.sucata ce-quantity-stepper input'), '2');
    await t.digitar(t.campoDoPainel('.sucata ce-money-input input'), '3000');

    expect(t.alertas().join(' ')).toContain('O desconto da sucata passa do total da venda');
    expect(t.botaoEm(t.painel(), 'Confirmar venda').disabled).toBe(true);
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
    expect(t.botaoContinuar().disabled).toBe(true);
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

  it('copia os vasilhames (tipo, quantidade e preço) com o modo voltando para Abater do crédito', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS_CREDITO_CASCO);

    await t.clicar('Repetir última venda');
    await responderUltima(t, {
      ...ULTIMA,
      vasilhames: [
        {
          tipoCascoId: 't-1',
          quantidade: 2,
          quantidadeAbatida: 0,
          precoUnitario: 25,
          modo: 'COMPRAR',
          total: 50,
        },
      ],
    });

    expect(t.barra()).toMatch(/4 itens R\$ 100,00/);
    await t.continuar();
    expect(t.campoDoPainel('.vasilhame ce-quantity-stepper input').value).toBe('2');
    expect(t.campoDoPainel('.vasilhame ce-money-input input').value).toBe('25,00');
    expect(t.botaoEm(t.painel(), 'Abater do crédito').getAttribute('aria-pressed')).toBe('true');
    // Crédito 2 cobre os 2 vasilhames: nada a cobrar neles.
    expect(t.texto(t.painel())).toContain('Casco 20L: R$ 0,00');
  });

  it('venda só com vasilhame: o carrinho não fica vazio', async () => {
    const t = await comCliente();

    await t.clicar('Repetir última venda');
    await responderUltima(t, {
      ...ULTIMA,
      itens: [],
      vasilhames: [
        {
          tipoCascoId: 't-1',
          quantidade: 1,
          quantidadeAbatida: 0,
          precoUnitario: 30,
          modo: 'ABATER_CREDITO',
          total: 30,
        },
      ],
    });

    expect(t.texto()).not.toContain('ainda não tem venda anterior');
    expect(t.barra()).toMatch(/1 item R\$ 30,00/);
    expect(t.botaoContinuar().disabled).toBe(false);
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

  it('com repetirUltima=1: seleciona o cliente e carrega a última venda', async () => {
    const t = await montar(undefined, { cliente: 'c-1', repetirUltima: '1' });
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    await t.responderSaldos('c-1');
    await responderUltima(t, ULTIMA);
    expect(t.linha(AGUA).querySelector<HTMLInputElement>('ce-quantity-stepper input')!.value).toBe(
      '2',
    );
  });

  it('sem repetirUltima: não consulta a última venda', async () => {
    const t = await montar(undefined, { cliente: 'c-1' });
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    await t.responderSaldos('c-1');
    t.http.expectNone(ehUltimaVenda);
  });

  it('com id (edição): ignora repetirUltima', async () => {
    const t = await montar('v-1', { cliente: 'c-9', repetirUltima: '1' });
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush({ ...VENDA_EDICAO, itens: [] });
    await assentar(t.fixture);
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    t.http.expectNone(ehUltimaVenda);
    await t.responderSaldos('c-1');
  });

  it('obter falha: abre sem cliente', async () => {
    const t = await montar(undefined, { cliente: 'c-1' });
    t.http
      .expectOne('/api/clientes/v1/clientes/c-1')
      .flush({ code: 'X', message: 'x', traceId: 't' }, { status: 404, statusText: 'Not Found' });
    await assentar(t.fixture);
    expect(t.botaoContinuar().disabled).toBe(true);
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

  it('teto do crédito na edição: saldo 20 + estorno da venda (20 de crédito + 60 de fiado) = 100, limitado ao líquido (95)', async () => {
    const t = await montar('v-1');
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush({
      ...VENDA_EDICAO,
      totalLiquido: 80,
      pagamentos: [{ forma: 'CREDITO_CLIENTE', valor: 20 }],
    });
    await assentar(t.fixture);
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    t.http
      .expectOne('/api/clientes/v1/clientes/c-1/saldos')
      .flush({ ...SALDOS_ZERO, saldo: 20, creditoDisponivel: 20 });
    await assentar(t.fixture);
    await t.cobrar();

    expect(t.valores()).toEqual(['20,00']);
    await t.digitar(t.campoDoPainel('.forma-linha ce-money-input input'), '15000');
    expect(t.valores()).toEqual(['95,00']);
  });

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

    await t.continuar();
    expect(t.campoDoPainel('ce-quantity-stepper input', 0).value).toBe('2');
    expect(t.campoDoPainel('ce-quantity-stepper input', 1).value).toBe('1');
    // Na edição o saldo já inclui a venda original: o texto de casco não cita o cliente.
    expect(t.texto(t.painel())).toContain('Devolveu 1 a mais');
    await t.continuar();
    expect(t.botaoEm(t.painel(), 'Salvar alterações')).toBeTruthy();
    expect(t.texto(t.painel())).not.toContain('Confirmar venda');
  });

  it('(b) altera um item e salva: PUT com o corpo esperado, volta ao 1º passo e navega ao detalhe', async () => {
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
    expect(t.trilho()).toMatch(/^1 de 3/);
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
    expect(t.barra()).toMatch(/R\$ 95,00/);
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

describe('PdvPage: busca com sugestão', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const marca = (marcaId: string, marcaNome: string) =>
    marcaResp({ marcaId, marcaNome, tipoCascoResolvidoId: 't-1' });
  const AGUA_2 = produtoResp({
    id: 'p-agua',
    nome: 'Água 20L',
    categoria: 'Água',
    marcas: [marca('m-ind', 'Indaiá'), marca('m-cri', 'Cristal')],
  });
  const GELO_2 = produtoResp({
    id: 'p-gelo',
    tipo: 'DESCARTAVEL',
    nome: 'Gelo 5kg',
    categoria: 'Gelo',
    marcas: [marcaResp({ marcaId: 'm-ind', marcaNome: 'Indaiá' })],
  });
  const COPO_2 = produtoResp({
    id: 'p-copo',
    tipo: 'DESCARTAVEL',
    nome: 'Copo 200ml',
    categoria: 'Copos',
    marcas: [marcaResp({ marcaId: 'm-ger', marcaNome: 'Genérica' })],
  });

  async function comCatalogo() {
    const t = await montar(undefined, { catalogo: [AGUA_2, GELO_2, COPO_2] });
    const caixa = () => t.campo('ce-search-box input[placeholder^="Buscar por nome"]');
    // O SearchBox emite a busca depois do debounce de 300 ms.
    const buscar = async (texto: string) => {
      await t.digitar(caixa(), texto);
      await new Promise((r) => setTimeout(r, 350));
      await assentar(t.fixture);
    };
    const nomes = () =>
      Array.from(t.el.querySelectorAll('.prod__nome'))
        .map((n) => n.textContent?.trim())
        .filter((n) => !n?.startsWith('Vasilhame'));
    const sugestoes = () =>
      Array.from(t.el.querySelectorAll('.sugestao')).map((b) => b.textContent?.trim());
    return { ...t, caixa, buscar, nomes, sugestoes };
  }

  it('a lista tem uma linha por produto+marca, "Nome — Marca", com estoque e preço da marca', async () => {
    const t = await comCatalogo();

    expect(t.nomes()).toEqual([
      'Água 20L — Indaiá',
      'Água 20L — Cristal',
      'Gelo 5kg — Indaiá',
      'Copo 200ml — sem marca',
    ]);
    expect(t.caixa().placeholder).toBe('Buscar por nome, marca ou categoria…');
  });

  it('digitar mostra sugestões; sem sugestão escolhida a lista filtra pelo texto', async () => {
    const t = await comCatalogo();

    await t.buscar('inda');

    expect(t.sugestoes()).toEqual(['Marca: Indaiá']);
    expect(t.nomes()).toEqual(['Água 20L — Indaiá', 'Gelo 5kg — Indaiá']);
  });

  it('escolher a sugestão de marca filtra, mostra o chip e esvazia o texto; categoria troca o filtro e marca a pílula; limpar volta a lista inteira', async () => {
    const t = await comCatalogo();

    await t.buscar('crist');
    await t.clicar('Marca: Cristal');
    expect(t.nomes()).toEqual(['Água 20L — Cristal']);
    expect(t.caixa().value).toBe('');
    expect(t.sugestoes()).toEqual([]);
    expect(t.texto(t.el.querySelector('.filtro')!)).toContain('Marca: Cristal');

    await t.buscar('cop');
    await t.clicar('Categoria: Copos');
    expect(t.nomes()).toEqual(['Copo 200ml — sem marca']);
    expect(t.el.querySelector('.pilula--ativa')?.textContent?.trim()).toBe('Copos');

    t.botaoEm(t.el.querySelector('.filtro')!, '').click();
    await assentar(t.fixture);
    expect(t.el.querySelector('.filtro')).toBeNull();
    expect(t.nomes()).toHaveLength(4);
    expect(t.el.querySelector('.pilula--ativa')?.textContent?.trim()).toBe('Todos');
  });

  it('sugestão de nome mostra todas as marcas do produto', async () => {
    const t = await comCatalogo();

    await t.buscar('agua');
    await t.clicar('Produto: Água 20L');

    expect(t.nomes()).toEqual(['Água 20L — Indaiá', 'Água 20L — Cristal']);
  });

  it('Enter adiciona a primeira linha produto+marca da lista filtrada', async () => {
    const t = await comCatalogo();
    await t.escolherCliente(cliente('c-1', 'Ana'));

    t.abrir.mockReturnValueOnce({ closed: of(undefined) });
    await t.digitar(t.caixa(), 'cristal');
    await t.enter(t.caixa());

    expect(t.abrir).toHaveBeenCalledWith(expect.anything(), {
      produto: AGUA_2,
      marca: AGUA_2.marcas[1],
      existente: null,
      clienteId: expect.anything(),
    });
  });

  it('duas marcas do mesmo produto são itens distintos do carrinho', async () => {
    const t = await comCatalogo();
    await t.escolherCliente(cliente('c-1', 'Ana'));

    await t.tocar(AGUA_2, 1);
    t.linha(AGUA_2, 'Cristal')
      .querySelector<HTMLElement>('button[aria-label="Adicionar Água 20L — Cristal"]')!
      .click();
    await assentar(t.fixture);

    expect(t.el.querySelectorAll('.prod--sel')).toHaveLength(2);
    expect(t.barra()).toMatch(/2 itens R\$ 100,00/);
  });
});

describe('PdvPage: chip de casco por tipo e edição com vasilhame', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('tocar no chip Casco lista os tipos com saldo ≠ 0; negativo é "a favor do cliente"', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), {
      ...SALDOS,
      saldoCascos: 1,
      cascosPorTipo: [
        { tipoCascoId: 't-1', nome: 'Casco 20L', saldo: 3 },
        { tipoCascoId: 't-2', nome: 'Casco 10L', saldo: -2 },
        { tipoCascoId: 't-3', nome: 'Casco 5L', saldo: 0 },
      ],
    });
    expect(t.el.querySelector('.casco-lista')).toBeNull();

    await t.clicar('Casco 3');

    const lista = t.texto(t.el.querySelector('.casco-lista')!);
    expect(lista).toContain('Casco 20L = 3');
    expect(lista).toContain('Casco 10L = 2 a favor do cliente');
    expect(lista).not.toContain('Casco 5L');

    await t.clicar('Casco 3');
    expect(t.el.querySelector('.casco-lista')).toBeNull();
  });

  it('edição: vasilhames e sucata com valor voltam no quadro e seguem no PUT', async () => {
    const t = await montar('v-1');
    const venda: VendaDetalheResponse = {
      ...VENDA_EDICAO,
      vasilhames: [
        {
          tipoCascoId: 't-1',
          quantidade: 3,
          quantidadeAbatida: 2,
          precoUnitario: 28,
          modo: 'ABATER_CREDITO',
          total: 28,
        },
      ],
      sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 7 }],
    };
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(venda);
    await assentar(t.fixture);
    t.http.expectOne('/api/clientes/v1/clientes/c-1').flush(cliente('c-1', 'Ana'));
    await assentar(t.fixture);
    await t.responderSaldos('c-1');

    await t.continuar();
    expect(t.texto(t.painel())).toContain('Vasilhames comprados agora');
    expect(t.campoDoPainel('.vasilhame ce-quantity-stepper input').value).toBe('3');
    expect(t.campoDoPainel('.vasilhame ce-money-input input').value).toBe('28,00');
    // O detalhe abateu 2: a escolha aparece já em 'Abater do crédito'.
    expect(t.botaoEm(t.painel(), 'Abater do crédito').getAttribute('aria-pressed')).toBe('true');
    expect(t.campoDoPainel('.sucata ce-money-input input').value).toBe('7,00');

    await t.continuar();
    await t.clicarNoPainel('Salvar alterações');
    const req = t.http.expectOne(`${URL_VENDAS}/v-1`);
    expect(req.request.method).toBe('PUT');
    expect(Object.keys(req.request.body.itens[0]).join()).not.toMatch(/vasilhame/i);
    expect(req.request.body.vasilhames).toEqual([
      { tipoCascoId: 't-1', quantidade: 3, precoUnitario: 28, modoCredito: 'ABATER_CREDITO' },
    ]);
    expect(req.request.body.cascosDevolvidos).toEqual([{ tipoCascoId: 't-1', quantidade: 2 }]);
    expect(req.request.body.sucataEntregue).toEqual([
      { tipoCascoId: 't-1', quantidade: 1, valorUnitario: 7 },
    ]);
    req.flush({});
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);
  });
});
