import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, EnvironmentInjector, Injector, createComponent } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { ClienteResponse, SaldosResponse } from '../../core/api/models/clientes';
import { EstoqueItemResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { VendaDetalheResponse, VendaResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { ItemCarrinho } from './carrinho';
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

async function montar(idVenda?: string, opcoes: { desktop?: boolean } = {}) {
  const abrir = vi.fn();
  const confirmar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: SheetService, useValue: { abrir, confirmar } },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: opcoes.desktop === true, breakpoints: {} }) },
      },
      {
        provide: OperatorStore,
        useValue: { operator: () => ({ id: 'f-1', nome: 'Maria', cargoId: 'c', cargoNome: null }) },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PdvPage);
  if (idVenda) {
    fixture.componentRef.setInput('id', idVenda);
  }
  const el = fixture.nativeElement as HTMLElement;
  http.expectOne('/api/estoque/v1/produtos').flush([AGUA, GALAO, GELO, COPO]);
  http.expectOne('/api/estoque/v1/estoque').flush(ESTOQUE);
  await assentar(fixture);

  const botao = (texto: string): HTMLButtonElement => {
    const achado = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    );
    if (!achado) {
      throw new Error(`botão "${texto}" não encontrado`);
    }
    return achado;
  };
  const clicar = async (texto: string) => {
    botao(texto).click();
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
  const campo = (seletor: string, indice = 0) =>
    el.querySelectorAll<HTMLInputElement>(seletor)[indice];
  const texto = () => (el.textContent ?? '').replace(/\s+/g, ' ');
  const alertas = () => Array.from(el.querySelectorAll('[role="alert"]')).map((a) => a.textContent);

  const escolherCliente = async (
    c: ClienteResponse,
    saldos: SaldosResponse = { saldoCascos: 0, sucataEntregue: 0, saldoFiado: 0 },
  ) => {
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
    http
      .expectOne(`/api/clientes/v1/clientes/${clienteId}/saldos`)
      .flush({ saldoCascos: 0, sucataEntregue: 0, saldoFiado: 0 });
    await assentar(fixture);
  };
  const linha = (p: ProdutoResponse) => {
    const achada = Array.from(el.querySelectorAll('ce-produto-linha')).find((l) =>
      l.textContent?.includes(p.nome),
    );
    if (!achada) {
      throw new Error(`linha "${p.nome}" não encontrada`);
    }
    return achada as HTMLElement;
  };
  const aumentar = async (p: ProdutoResponse, vezes = 1) => {
    for (let i = 0; i < vezes; i++) {
      linha(p).querySelector<HTMLElement>(`button[aria-label="Aumentar ${p.nome}"]`)!.click();
      await assentar(fixture);
    }
  };
  const diminuir = async (p: ProdutoResponse) => {
    linha(p).querySelector<HTMLElement>(`button[aria-label="Diminuir ${p.nome}"]`)!.click();
    await assentar(fixture);
  };
  const adicionar = (p: ProdutoResponse, quantidade: number) => aumentar(p, quantidade);
  const ate = async (rotulo: string) => {
    // Avança até o passo cujo cabeçalho tem o rótulo dado.
    for (let i = 0; i < 5; i++) {
      const ativo = el.querySelector('.passo--ativo .passo__cabecalho')?.textContent ?? '';
      if (ativo.includes(rotulo)) {
        return;
      }
      await clicar('Avançar');
    }
  };
  const cabecalhos = () =>
    Array.from(el.querySelectorAll('.passo__cabecalho')).map((b) => b.textContent?.trim() ?? '');

  return {
    fixture,
    http,
    navegar,
    el,
    abrir,
    confirmar,
    botao,
    clicar,
    digitar,
    enter,
    campo,
    texto,
    alertas,
    escolherCliente,
    adicionar,
    aumentar,
    diminuir,
    linha,
    responderSaldos,
    ate,
    cabecalhos,
  };
}

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

describe('PdvPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('"preço e desconto" abre o sheet e o resultado entra no carrinho', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');

    t.abrir.mockReturnValueOnce({ closed: of(itemDe(AGUA, 2)) });
    await t.clicar('preço e desconto');

    expect(t.abrir).toHaveBeenCalledWith(expect.anything(), { produto: AGUA, existente: null });
    expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(1);
    expect(t.texto()).toContain('Carrinho (1)');
  });

  it('clique no item do carrinho com resultado "remover" tira o item', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(AGUA, 2);

    t.abrir.mockReturnValueOnce({ closed: of('remover') });
    t.el.querySelector<HTMLElement>('ce-item-venda-card button')!.click();
    await assentar(t.fixture);

    expect(t.abrir.mock.calls[0][1].existente).toEqual(itemDe(AGUA, 2));
    expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(0);
    expect(t.botao('Avançar').disabled).toBe(true);
  });

  it('o passo Cascos só existe com item de ÁGUA', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');

    await t.adicionar(GALAO, 1);
    expect(t.cabecalhos().some((c) => c.includes('Cascos'))).toBe(false);

    await t.adicionar(AGUA, 1);
    expect(t.cabecalhos().some((c) => c.includes('Cascos'))).toBe(true);
  });

  it('toggle "todos na hora" preenche devolvidos, segue editável e desligar não zera', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(AGUA, 5);
    await t.clicar('Avançar');

    const toggle = t.campo('ce-checkbox input');
    expect(t.texto()).toContain('Devolveu todos na hora');
    toggle.click();
    await assentar(t.fixture);
    expect(t.campo('ce-quantity-stepper input', 0).value).toBe('5');

    await t.digitar(t.campo('ce-quantity-stepper input', 0), '3');
    expect(t.campo('ce-quantity-stepper input', 0).value).toBe('3');

    toggle.click();
    await assentar(t.fixture);
    expect(t.campo('ce-quantity-stepper input', 0).value).toBe('3');
    expect(t.texto()).toContain('não abate o débito de casco');
  });

  it('com o toggle ligado, mudar a quantidade de água acompanha devolvidos; edição manual fica', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(AGUA, 5);
    await t.clicar('Avançar');
    t.campo('ce-checkbox input').click();
    await assentar(t.fixture);
    expect(t.campo('ce-quantity-stepper input', 0).value).toBe('5');

    const trocarQuantidade = async (quantidade: number) => {
      await t.clicar('Voltar');
      t.abrir.mockReturnValueOnce({ closed: of(itemDe(AGUA, quantidade)) });
      t.el.querySelector<HTMLElement>('ce-item-venda-card button')!.click();
      await assentar(t.fixture);
      await t.clicar('Avançar');
    };

    await trocarQuantidade(6);
    expect(t.campo('ce-quantity-stepper input', 0).value).toBe('6');

    await t.digitar(t.campo('ce-quantity-stepper input', 0), '4');
    await trocarQuantidade(7);
    expect(t.campo('ce-quantity-stepper input', 0).value).toBe('4');

    await t.ate('Revisão');
    await t.clicar('Registrar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.cascosDevolvidos).toBe(4);
    expect(req.request.body.itens[0].quantidade).toBe(7);
  });

  it('pagamento maior que o total bloqueia o avanço e mostra a mensagem', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(GALAO, 1);
    await t.ate('Pagamento');

    await t.clicar('Adicionar forma de pagamento');
    await t.digitar(t.campo('ce-money-input input'), '6000');

    expect(t.botao('Avançar').disabled).toBe(true);
    expect(t.alertas()).toContain('A soma dos pagamentos ultrapassa o total da venda.');
  });

  it('as formas de pagamento são botões num grupo com nome acessível', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(GALAO, 1);
    await t.ate('Pagamento');

    await t.clicar('Adicionar forma de pagamento');
    const grupo = t.el.querySelector('ce-pagamento-lista [role="radiogroup"]')!;
    const formas = Array.from(grupo.querySelectorAll('[role="radio"]'));

    expect(grupo.getAttribute('aria-label')).toBe('Forma de pagamento');
    expect(formas.map((f) => f.textContent?.trim())).toEqual([
      'PIX',
      'Cartão de crédito',
      'Cartão de débito',
      'Dinheiro',
      'Outro',
    ]);
  });

  it('walkthrough 7: 5 águas, 3 devolvidos, 1 sucata, PIX 200 → PARCIAL, fiado 50, casco 2', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(AGUA, 5);
    await t.clicar('Avançar');

    t.campo('ce-checkbox input').click();
    await assentar(t.fixture);
    await t.digitar(t.campo('ce-quantity-stepper input', 0), '3');
    await t.digitar(t.campo('ce-quantity-stepper input', 1), '1');
    expect(t.texto()).toContain('Fica 2 casco na rua');
    await t.clicar('Avançar');

    await t.clicar('Adicionar forma de pagamento');
    await t.digitar(t.campo('ce-money-input input'), '20000');
    expect(t.texto()).toMatch(/Vai para fiado ?R\$ 50,00/);
    await t.clicar('Avançar');
    expect(t.texto()).toMatch(/Vai para fiado ?R\$ 50,00/);

    await t.clicar('Registrar venda');
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
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);

    expect(t.texto()).toContain('Parcial');
    expect(t.texto()).toMatch(/Fiado gerado ?R\$ 50,00/);
    expect(t.texto()).toMatch(/Saldo de cascos do cliente ?2/);
  });

  async function ateRevisao() {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(GALAO, 1);
    await t.ate('Revisão');
    return t;
  }

  it('409 CAIXA_FECHADO aparece inline e mantém o rascunho', async () => {
    const t = await ateRevisao();

    await t.clicar('Registrar venda');
    t.http
      .expectOne(URL_VENDAS)
      .flush(
        { code: 'CAIXA_FECHADO', message: 'caixa fechado', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toContain('O caixa do dia já está fechado.');
    expect(t.texto()).toMatch(/Líquido ?R\$ 50,00/);
    expect(t.botao('Registrar venda').disabled).toBe(false);
  });

  it('400 do backend mostra a mensagem do servidor', async () => {
    const t = await ateRevisao();

    await t.clicar('Registrar venda');
    t.http
      .expectOne(URL_VENDAS)
      .flush(
        { code: 'ITEM_INVALIDO', message: 'Quantidade do item deve ser positiva.', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toContain('Quantidade do item deve ser positiva.');
    expect(t.botao('Registrar venda').disabled).toBe(false);
  });

  it('"Emitir cupom fiscal" faz POST no cupom-fiscal e mostra o número', async () => {
    const t = await ateRevisao();
    await t.clicar('Registrar venda');
    t.http.expectOne(URL_VENDAS).flush({ ...RESPOSTA, id: 'v-9' });
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);

    await t.clicar('Emitir cupom fiscal');
    const req = t.http.expectOne(`${URL_VENDAS}/v-9/cupom-fiscal`);
    expect(req.request.method).toBe('POST');
    req.flush({ cupomId: 'c', numero: '123', emitidoEm: '2026-01-01' });
    await assentar(t.fixture);

    expect(t.texto()).toContain('Cupom fiscal nº 123');
  });

  it('"Cancelar venda" confirmada limpa o rascunho sem chamar a API', async () => {
    const t = await ateRevisao();
    t.confirmar.mockResolvedValue(true);

    await t.clicar('Cancelar venda');

    expect(t.confirmar).toHaveBeenCalled();
    expect(t.el.querySelector('.passo--ativo')?.textContent).toContain('Cliente');
    expect(t.texto()).not.toContain('Ana');
    // afterEach: http.verify() garante que nenhuma chamada HTTP foi feita.
  });

  it('"Cancelar venda" recusada mantém o rascunho', async () => {
    const t = await ateRevisao();
    t.confirmar.mockResolvedValue(false);

    await t.clicar('Cancelar venda');

    expect(t.el.querySelector('.passo--ativo')?.textContent).toContain('Revisão');
  });

  it('Enter na busca de produto abre o sheet do primeiro produto filtrado', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');

    t.abrir.mockReturnValueOnce({ closed: of(undefined) });
    const busca = t.campo('ce-search-box input');
    busca.value = 'galao';
    busca.dispatchEvent(new Event('input'));
    await t.enter(busca);

    expect(t.abrir).toHaveBeenCalledWith(expect.anything(), { produto: GALAO, existente: null });
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
    expect(t.botao('Avançar').disabled).toBe(false);
  });

  it('cliente com vários endereços exige escolher um antes de avançar', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana', 2));
    expect(t.botao('Avançar').disabled).toBe(true);

    t.el.querySelectorAll<HTMLElement>('[role="radio"]')[1].click();
    await assentar(t.fixture);

    expect(t.botao('Avançar').disabled).toBe(false);
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

  it('"Nova venda" volta ao passo Cliente com o carrinho vazio', async () => {
    const t = await ateRevisao();
    await t.clicar('Registrar venda');
    t.http.expectOne(URL_VENDAS).flush(RESPOSTA);
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);

    await t.clicar('Nova venda');

    expect(t.el.querySelector('.passo--ativo')?.textContent).toContain('Cliente');
    expect(t.texto()).not.toContain('Venda registrada');
    expect(t.texto()).not.toContain('Ana');
  });

  async function emitirComErro(status: number, code: string) {
    const t = await ateRevisao();
    await t.clicar('Registrar venda');
    t.http.expectOne(URL_VENDAS).flush({ ...RESPOSTA, id: 'v-9' });
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);

    await t.clicar('Emitir cupom fiscal');
    t.http
      .expectOne(`${URL_VENDAS}/v-9/cupom-fiscal`)
      .flush({ code, message: 'x', traceId: 't' }, { status, statusText: 'Erro' });
    await assentar(t.fixture);
    return t;
  }

  it('409 CUPOM_JA_EMITIDO mostra o cupom existente', async () => {
    const t = await emitirComErro(409, 'CUPOM_JA_EMITIDO');
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

  it('outro erro ao emitir o cupom aparece inline', async () => {
    const t = await emitirComErro(409, 'CAIXA_FECHADO');

    expect(t.alertas()).toContain('O caixa do dia já está fechado.');
    expect(t.texto()).not.toContain('Cupom fiscal nº');
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
    t.http
      .expectOne('/api/clientes/v1/clientes/c-1/saldos')
      .flush({ saldoCascos: 0, sucataEntregue: 0, saldoFiado: 0 });
    await assentar(t.fixture);
    return t;
  }

  async function responderLista(t: Awaited<ReturnType<typeof montar>>) {
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);
  }

  it('(a) pré-carga: cliente, itens, cascos e sucata aparecem; título e botão de edição', async () => {
    const t = await montarEdicao();

    expect(t.texto()).toContain('Editar venda');
    expect(t.texto()).toMatch(/Cliente ?Ana/);
    expect(t.texto()).toMatch(/Cascos devolvidos ?2/);
    expect(t.texto()).toMatch(/Sucata entregue ?1/);
    await t.clicar('Itens');
    expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(2);
    expect(t.texto()).toContain('Água 20L');
    expect(t.texto()).toContain('Galão vazio');
    await t.ate('Revisão');
    expect(t.botao('Salvar alterações')).toBeTruthy();
    expect(t.texto()).not.toContain('Registrar venda');
  });

  it('(b) altera a quantidade de um item e salva: PUT com o corpo esperado e navega ao detalhe', async () => {
    const t = await montarEdicao();
    await t.clicar('Itens');
    const existente = itemDe(AGUA, 1);
    t.abrir.mockReturnValueOnce({
      closed: of({
        ...existente,
        quantidade: 3,
        desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: '' },
      }),
    });
    t.el.querySelector<HTMLElement>('ce-item-venda-card button')!.click();
    await assentar(t.fixture);
    await t.ate('Revisão');

    await t.clicar('Salvar alterações');
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
  });

  it('(c) salvar sem mexer reenvia cascos, sucata, pagamentos e vendedor originais', async () => {
    const t = await montarEdicao();

    await t.clicar('Salvar alterações');
    const req = t.http.expectOne(`${URL_VENDAS}/v-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(CORPO_ORIGINAL);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    await responderLista(t);
  });

  it('(d) 409 CAIXA_FECHADO aparece inline e mantém o rascunho e o botão', async () => {
    const t = await montarEdicao();

    await t.clicar('Salvar alterações');
    t.http
      .expectOne(`${URL_VENDAS}/v-1`)
      .flush(
        { code: 'CAIXA_FECHADO', message: 'caixa fechado', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toContain('O caixa do dia já está fechado.');
    expect(t.texto()).toMatch(/Líquido ?R\$ 95,00/);
    expect(t.botao('Salvar alterações').disabled).toBe(false);
    expect(t.navegar).not.toHaveBeenCalled();
  });

  it('(e) 400 aparece inline com a mensagem do servidor', async () => {
    const t = await montarEdicao();

    await t.clicar('Salvar alterações');
    t.http
      .expectOne(`${URL_VENDAS}/v-1`)
      .flush(
        { code: 'ITEM_INVALIDO', message: 'Quantidade do item deve ser positiva.', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toContain('Quantidade do item deve ser positiva.');
    expect(t.botao('Salvar alterações').disabled).toBe(false);
  });

  it('(f) 422 VENDA_JA_FATURADA aparece inline', async () => {
    const t = await montarEdicao();

    await t.clicar('Salvar alterações');
    t.http
      .expectOne(`${URL_VENDAS}/v-1`)
      .flush(
        { code: 'VENDA_JA_FATURADA', message: 'x', traceId: 't' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toContain('Venda com cupom fiscal emitido não pode ser editada.');
  });

  it('(g) cupomEmitido: aviso somente leitura, sem botão de salvar e sem PUT', async () => {
    const t = await montarEdicao({ ...VENDA_EDICAO, cupomEmitido: true });

    const aviso = t.el.querySelector('[data-testid="venda-somente-leitura"]');
    expect(aviso?.textContent).toContain('Venda com cupom emitido não pode ser editada.');
    expect(t.texto()).not.toContain('Salvar alterações');
    expect(t.el.querySelector('.acoes button')).toBeNull();
    // verify() no afterEach garante que nenhum PUT foi feito.
  });

  it('GET da venda com 404 mostra mensagem inline e nenhum botão de salvar', async () => {
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
    expect(t.el.querySelector('.acoes button')).toBeNull();
  });
});

describe('PdvPage no design Depósito', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const SALDOS: SaldosResponse = { saldoCascos: 3, sucataEntregue: 0, saldoFiado: 40 };
  type T = Awaited<ReturnType<typeof montar>>;

  const trilho = (t: T) =>
    t.el.querySelector('[data-testid="trilho-texto"]')?.textContent?.replace(/\s+/g, ' ').trim();
  const exato = (t: T, texto: string): HTMLButtonElement[] =>
    Array.from(t.el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === texto);
  const valores = (t: T) =>
    Array.from(t.el.querySelectorAll<HTMLInputElement>('ce-money-input input')).map((i) => i.value);

  async function comAguas(quantidade = 5) {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(AGUA, quantidade);
    return t;
  }

  it('trilho nomeado com "N de M": 4 etapas sem ÁGUA, 5 com ÁGUA', async () => {
    const t = await montar();
    expect(trilho(t)).toBe('1 de 4');
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    expect(trilho(t)).toBe('2 de 4');
    await t.adicionar(GALAO, 1);
    await t.ate('Pagamento');
    expect(trilho(t)).toBe('3 de 4');
    expect(t.cabecalhos().map((c) => c.replace(/^\d+\s*/, ''))).toEqual([
      'Cliente',
      'Itens',
      'Pagamento',
      'Revisão',
    ]);

    await t.clicar('Itens');
    await t.adicionar(AGUA, 1);
    expect(trilho(t)).toBe('2 de 5');
    await t.ate('Pagamento');
    expect(trilho(t)).toBe('4 de 5');
    expect(t.cabecalhos().map((c) => c.replace(/^\d+\s*/, ''))).toContain('Cascos');
  });

  it('só dá para voltar a etapas anteriores', async () => {
    const t = await comAguas(1);
    await t.clicar('Avançar');
    const [cliente1, , cascos] = Array.from(
      t.el.querySelectorAll<HTMLButtonElement>('.passo__cabecalho'),
    );
    expect(cliente1.disabled).toBe(false);
    expect(cascos.disabled).toBe(true);
  });

  it('pílulas de categoria filtram a lista; a linha mostra estoque e preço', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');

    const pilulas = () =>
      Array.from(t.el.querySelectorAll('.pilula')).map((b) => b.textContent?.trim());
    const linhas = () =>
      Array.from(t.el.querySelectorAll('ce-produto-linha .linha__nome')).map((n) => n.textContent);
    expect(pilulas()).toEqual(['Todas', 'Água', 'Copos', 'Gelo']);
    expect(linhas()).toEqual(['Água 20L', 'Galão vazio', 'Gelo 5kg', 'Copo 200ml']);
    expect(t.linha(AGUA).textContent).toMatch(/Estoque: 12 ·\sR\$\s50,00/);
    expect(t.linha(GALAO).textContent).not.toContain('Estoque');

    await t.clicar('Gelo');
    expect(linhas()).toEqual(['Gelo 5kg']);
    expect(t.el.querySelector('.pilula--ativa')?.textContent).toContain('Gelo');

    await t.clicar('Água');
    expect(linhas()).toEqual(['Água 20L']);

    await t.clicar('Todas');
    expect(linhas()).toHaveLength(4);
  });

  it('os botões −/+ de cada linha levam o nome do produto', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');

    const nomes = (acao: string) =>
      Array.from(t.el.querySelectorAll('ce-produto-linha button[aria-label^="' + acao + '"]')).map(
        (b) => b.getAttribute('aria-label'),
      );
    expect(nomes('Aumentar')).toEqual([
      'Aumentar Água 20L',
      'Aumentar Galão vazio',
      'Aumentar Gelo 5kg',
      'Aumentar Copo 200ml',
    ]);
    expect(nomes('Diminuir')).toContain('Diminuir Água 20L');
  });

  it('contador −/+ da linha altera a quantidade no carrinho e em 0 remove o item', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');

    await t.aumentar(AGUA, 2);
    const campo = () => t.linha(AGUA).querySelector<HTMLInputElement>('input')!.value;
    expect(campo()).toBe('2');
    expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(1);
    expect(t.texto()).toContain('Carrinho (1)');

    await t.diminuir(AGUA);
    expect(campo()).toBe('1');
    await t.diminuir(AGUA);
    expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(0);
    expect(t.botao('Avançar').disabled).toBe(true);
  });

  it('"preço e desconto" abre o sheet de verdade e recusa desconto sem motivo', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.aumentar(AGUA, 1);

    let sheet!: HTMLElement;
    const detectar: (() => void)[] = [];
    t.abrir.mockImplementation((_componente, dados) => {
      const closed = new Subject<unknown>();
      const ref = createComponent(ItemVendaSheet, {
        environmentInjector: TestBed.inject(EnvironmentInjector),
        elementInjector: Injector.create({
          providers: [
            { provide: DIALOG_DATA, useValue: dados },
            { provide: DialogRef, useValue: { close: (r?: unknown) => closed.next(r) } },
          ],
        }),
      });
      TestBed.inject(ApplicationRef).attachView(ref.hostView);
      sheet = ref.location.nativeElement;
      document.body.appendChild(sheet);
      detectar.push(() => ref.changeDetectorRef.detectChanges());
      return { closed };
    });
    const sheetAssentar = async () => {
      detectar.forEach((d) => d());
      await assentar(t.fixture);
      detectar.forEach((d) => d());
    };

    await t.clicar('preço e desconto');
    await sheetAssentar();
    expect(t.abrir.mock.calls[0][1].existente).toEqual(itemDe(AGUA, 1));

    sheet.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await sheetAssentar();
    const dinheiro = sheet.querySelectorAll<HTMLInputElement>('ce-money-input input');
    dinheiro[1].value = '500';
    dinheiro[1].dispatchEvent(new Event('input'));
    await sheetAssentar();
    const confirmar = () =>
      Array.from(sheet.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Atualizar item'))!
        .click();

    confirmar();
    await sheetAssentar();
    expect(sheet.querySelector('[role="alert"]')?.textContent).toContain(
      'Informe o motivo do desconto.',
    );
    expect(t.el.querySelector('ce-item-venda-card')?.textContent).not.toContain('Desconto');
    expect(t.el.querySelector('ce-item-venda-card')?.textContent).not.toContain('cliente antigo');

    const motivo = sheet.querySelector<HTMLInputElement>('ce-input input')!;
    motivo.value = 'cliente antigo';
    motivo.dispatchEvent(new Event('input'));
    await sheetAssentar();
    confirmar();
    await sheetAssentar();

    expect(t.el.querySelector('ce-item-venda-card')?.textContent).toContain('cliente antigo');
    sheet.remove();
  });

  it('chips de casco e fiado do topo vêm do servidor, seguem nas etapas e somem ao trocar', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);

    const chips = () =>
      Array.from(t.el.querySelectorAll('.cliente-fixo ce-chip')).map((c) =>
        c.textContent?.replace(/\s+/g, ' ').trim(),
      );
    expect(chips()).toEqual(['Casco 3', 'Fiado R$ 40,00']);
    expect(t.el.querySelector('.cliente-fixo ce-chip .chip--casco')).not.toBeNull();
    expect(t.el.querySelector('.cliente-fixo ce-chip .chip--fiado')).not.toBeNull();

    await t.clicar('Avançar');
    await t.adicionar(AGUA, 1);
    await t.ate('Pagamento');
    expect(t.el.querySelector('.cliente-fixo strong')?.textContent).toBe('Ana');
    expect(chips()).toEqual(['Casco 3', 'Fiado R$ 40,00']);

    await t.clicar('Trocar');
    expect(t.el.querySelector('.cliente-fixo')).toBeNull();
    expect(t.el.querySelector('.passo--ativo')?.textContent).toContain('Cliente');
  });

  it('Cascos: "Fica N casco na rua" muda ao vivo e a sucata tem cartão e aviso próprios', async () => {
    const t = await comAguas(5);
    await t.clicar('Avançar');
    const fica = () =>
      t.el.querySelector('.casco-na-rua')?.textContent?.replace(/\s+/g, ' ').trim();

    expect(fica()).toBe('Fica 5 casco na rua');
    await t.digitar(t.campo('ce-quantity-stepper input', 0), '3');
    expect(fica()).toBe('Fica 2 casco na rua');
    t.campo('ce-checkbox input').click();
    await assentar(t.fixture);
    expect(fica()).toBe('Fica 0 casco na rua');
    await t.digitar(t.campo('ce-quantity-stepper input', 0), '9');
    expect(fica()).toBe('Fica 0 casco na rua');

    const sucata = t.el.querySelector('section.sucata')!;
    expect(sucata.textContent).toContain('Sucata não abate o débito de casco');
    expect(sucata.querySelector('ce-quantity-stepper')).not.toBeNull();
    expect(t.el.querySelectorAll('section.sucata ce-quantity-stepper')).toHaveLength(1);
  });

  it('Pagamento: total grande, formas em botões e "Vai para fiado" ao vivo', async () => {
    const t = await comAguas(5);
    await t.ate('Pagamento');

    expect(t.el.querySelector('.pagamentos__total strong')?.textContent).toMatch(/R\$\s250,00/);
    expect(t.texto()).toMatch(/Vai para fiado ?R\$ 250,00/);

    await t.clicar('Adicionar forma de pagamento');
    const formas = () => Array.from(t.el.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(formas().find((f) => f.getAttribute('aria-checked') === 'true')?.textContent).toContain(
      'PIX',
    );
    formas()
      .find((f) => f.textContent?.includes('Dinheiro'))!
      .click();
    await assentar(t.fixture);
    expect(formas().find((f) => f.getAttribute('aria-checked') === 'true')?.textContent).toContain(
      'Dinheiro',
    );

    await t.digitar(t.campo('ce-money-input input'), '10000');
    expect(t.texto()).toMatch(/Pago ?R\$ 100,00/);
    expect(t.texto()).toMatch(/Vai para fiado ?R\$ 150,00/);

    await t.ate('Revisão');
    await t.clicar('Registrar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.pagamentos).toEqual([{ forma: 'DINHEIRO', valor: 100 }]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
  });

  it('atalhos: com 100 pagos de 250, Metade dá 75, Tudo dá 150 e Tudo fiado zera', async () => {
    const t = await comAguas(5);
    await t.ate('Pagamento');
    await t.clicar('Adicionar forma de pagamento');
    await t.digitar(t.campo('ce-money-input input'), '10000');
    await t.clicar('Adicionar forma de pagamento');
    expect(valores(t)).toEqual(['100,00', '']);

    exato(t, 'Metade')[1].click();
    await assentar(t.fixture);
    expect(valores(t)).toEqual(['100,00', '75,00']);
    expect(t.texto()).toMatch(/Vai para fiado ?R\$ 75,00/);

    exato(t, 'Tudo')[1].click();
    await assentar(t.fixture);
    expect(valores(t)).toEqual(['100,00', '150,00']);
    expect(t.texto()).toContain('Venda paga por completo');

    exato(t, 'Tudo fiado')[0].click();
    await assentar(t.fixture);
    expect(valores(t)).toEqual([]);
    expect(t.texto()).toMatch(/Vai para fiado ?R\$ 250,00/);
  });

  it('pagamentos acima do total bloqueiam o avanço; o atalho nunca passa do total', async () => {
    const t = await comAguas(5);
    await t.ate('Pagamento');
    await t.clicar('Adicionar forma de pagamento');
    await t.digitar(t.campo('ce-money-input input'), '30000');
    expect(t.botao('Avançar').disabled).toBe(true);
    expect(t.alertas()).toContain('A soma dos pagamentos ultrapassa o total da venda.');

    exato(t, 'Tudo')[0].click();
    await assentar(t.fixture);
    expect(valores(t)).toEqual(['250,00']);
    expect(t.botao('Avançar').disabled).toBe(false);
  });

  it('desktop: produtos à esquerda e cliente, cascos e pagamento à direita, sem trilho', async () => {
    const t = await montar(undefined, { desktop: true });
    expect(trilho(t)).toBeUndefined();
    expect(t.botao('Registrar venda').disabled).toBe(true);

    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    await t.adicionar(AGUA, 5);
    const esquerda = t.el.querySelector('.grade__produtos')!;
    const direita = t.el.querySelector('.grade__venda')!;
    expect(esquerda.querySelectorAll('ce-produto-linha')).toHaveLength(4);
    expect(direita.querySelector('.cliente-fixo')?.textContent).toContain('Ana');
    expect(direita.querySelectorAll('ce-item-venda-card')).toHaveLength(1);
    expect(direita.querySelector('.casco-na-rua')?.textContent).toContain('Fica 5 casco na rua');
    expect(direita.querySelector('ce-pagamento-lista')).not.toBeNull();

    await t.clicar('Adicionar forma de pagamento');
    await t.digitar(t.campo('ce-money-input input'), '20000');
    await t.digitar(t.campo('.grade__venda ce-quantity-stepper input', 0), '3');
    expect(t.botao('Registrar venda').disabled).toBe(false);

    await t.clicar('Registrar venda');
    const req = t.http.expectOne(URL_VENDAS);
    expect(req.request.body.pagamentos).toEqual([{ forma: 'PIX', valor: 200 }]);
    expect(req.request.body.cascosDevolvidos).toBe(3);
    expect(req.request.body.itens).toEqual([
      { produtoId: 'p-agua', quantidade: 5, precoUnitario: 50, desconto: null },
    ]);
    req.flush(RESPOSTA);
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);
    expect(t.texto()).toContain('Venda registrada');
  });

  it('desktop com carrinho vazio não mostra mensagem de fiado nem de venda paga', async () => {
    const t = await montar(undefined, { desktop: true });
    await t.escolherCliente(cliente('c-1', 'Ana'), SALDOS);
    const pagamento = t.el.querySelector('ce-pagamento-lista')!.textContent;
    expect(pagamento).not.toContain('Nenhum pagamento');
    expect(pagamento).not.toContain('Venda paga por completo');

    await t.adicionar(GALAO, 1);
    expect(t.el.querySelector('ce-pagamento-lista')!.textContent).toContain('Nenhum pagamento');
  });
});
