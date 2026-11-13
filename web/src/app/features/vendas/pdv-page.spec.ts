import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ClienteResponse } from '../../core/api/models/clientes';
import { ProdutoResponse } from '../../core/api/models/estoque';
import { VendaDetalheResponse, VendaResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { ItemCarrinho } from './carrinho';
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

async function montar(idVenda?: string) {
  const abrir = vi.fn();
  const confirmar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: SheetService, useValue: { abrir, confirmar } },
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
  http.expectOne('/api/estoque/v1/produtos').flush([AGUA, GALAO]);
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

  const escolherCliente = async (c: ClienteResponse) => {
    await digitar(campo('ce-search-box input'), c.nome);
    await enter(campo('ce-search-box input'));
    http
      .expectOne((r) => r.url === '/api/clientes/v1/clientes' && r.params.get('nome') === c.nome)
      .flush([c]);
    await assentar(fixture);
  };
  const adicionar = async (p: ProdutoResponse, quantidade: number) => {
    abrir.mockReturnValueOnce({ closed: of(itemDe(p, quantidade)) });
    el.querySelectorAll<HTMLElement>('ce-produto-card button')[p === AGUA ? 0 : 1].click();
    await assentar(fixture);
  };
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

  it('clique no produto abre o sheet e o resultado entra no carrinho', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');

    await t.adicionar(AGUA, 2);

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

    expect(t.abrir.mock.calls[1][1].existente).toEqual(itemDe(AGUA, 2));
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

  it('o select da forma de pagamento não sai com id="null" e tem nome acessível', async () => {
    const t = await montar();
    await t.escolherCliente(cliente('c-1', 'Ana'));
    await t.clicar('Avançar');
    await t.adicionar(GALAO, 1);
    await t.ate('Pagamento');

    await t.clicar('Adicionar forma de pagamento');
    const select = t.campo('ce-pagamento-lista select') as unknown as HTMLSelectElement;

    expect(select.hasAttribute('id')).toBe(false);
    expect(select.getAttribute('aria-label')).toBe('Forma de pagamento');
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

    expect(t.texto()).toContain('PARCIAL');
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
    await t.clicar('Trocar');

    // Novo termo: o debounce real (300 ms) dispara a busca; o Enter vem com ela em voo.
    const novo = t.campo('ce-search-box input');
    await t.digitar(novo, 'bia');
    await new Promise((r) => setTimeout(r, 350));
    const req = t.http.expectOne((r) => r.params.get('nome') === 'bia');
    await t.enter(novo);
    req.flush([cliente('c-2', 'Bianca')]);
    await assentar(t.fixture);

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

  it('erro ao emitir o cupom aparece inline', async () => {
    const t = await ateRevisao();
    await t.clicar('Registrar venda');
    t.http.expectOne(URL_VENDAS).flush({ ...RESPOSTA, id: 'v-9' });
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    await assentar(t.fixture);

    await t.clicar('Emitir cupom fiscal');
    t.http
      .expectOne(`${URL_VENDAS}/v-9/cupom-fiscal`)
      .flush(
        { code: 'CUPOM_JA_EMITIDO', message: 'x', traceId: 't' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await assentar(t.fixture);

    expect(t.alertas()).toContain('Cupom fiscal já emitido para esta venda.');
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
