import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { RelatoriosStore } from './relatorios-store';

const VENDAS = '/api/vendas/v1/relatorios';
const FINANCEIRO = '/api/financeiro/v1/relatorios';
const FATURAMENTO = {
  totalBruto: 100,
  totalDesconto: 10,
  totalLiquido: 90,
  porProduto: [{ produtoId: 'p1', nome: 'Água 20L', quantidade: 3, totalLiquido: 90 }],
  porDia: [{ dia: '2026-11-02', totalLiquido: 90 }],
  porCategoria: [],
};

describe('RelatoriosStore', () => {
  let store: RelatoriosStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(RelatoriosStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('faturamento: carregando até a resposta e depois guarda exatamente o que o servidor devolveu', async () => {
    expect(store.faturamento()).toEqual({ dados: null, carregando: false, erro: null });
    const p = store.carregarFaturamento('2026-11-01', '2026-11-13', 'p1');
    expect(store.faturamento().carregando).toBe(true);
    const req = http.expectOne((r) => r.url === `${VENDAS}/faturamento`);
    expect(req.request.params.get('inicio')).toBe('2026-11-01');
    expect(req.request.params.get('fim')).toBe('2026-11-13');
    expect(req.request.params.get('produtoId')).toBe('p1');
    req.flush(FATURAMENTO);
    await p;
    expect(store.faturamento()).toEqual({ dados: FATURAMENTO, carregando: false, erro: null });
  });

  it('faturamento: erro da API guarda a mensagem, limpa os dados e sai de carregando', async () => {
    const p = store.carregarFaturamento('2026-11-01', '2026-11-13');
    http
      .expectOne((r) => r.url === `${VENDAS}/faturamento`)
      .flush(
        { code: 'PERIODO_INVALIDO', message: 'x', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await p;
    const e = store.faturamento();
    expect(e.carregando).toBe(false);
    expect(e.dados).toBeNull();
    expect(e.erro).toBeTruthy();
  });

  it('recarga mantém os dados antigos enquanto carrega', async () => {
    const p1 = store.carregarFaturamento('2026-11-01', '2026-11-13');
    http.expectOne((r) => r.url === `${VENDAS}/faturamento`).flush(FATURAMENTO);
    await p1;
    const p2 = store.carregarFaturamento('2026-11-01', '2026-11-14');
    expect(store.faturamento().carregando).toBe(true);
    expect(store.faturamento().dados).toEqual(FATURAMENTO);
    http.expectOne((r) => r.url === `${VENDAS}/faturamento`).flush(FATURAMENTO);
    await p2;
  });

  it('vendas por funcionário, caixa e fiado guardam a resposta e têm erro próprio', async () => {
    const pv = store.carregarVendasPorFuncionario('2026-11-01', '2026-11-13');
    const vendas = [{ funcionarioId: 'f1', nome: 'Ana', quantidadeVendas: 2, totalLiquido: 50 }];
    http.expectOne((r) => r.url === `${VENDAS}/vendas-por-funcionario`).flush(vendas);
    await pv;
    expect(store.vendasPorFuncionario().dados).toEqual(vendas);

    const pc = store.carregarCaixa('2026-11-01', '2026-11-13');
    const caixa = { dias: [], despesasPorTipo: [{ tipoDespesa: 'Luz', total: 30 }] };
    http.expectOne((r) => r.url === `${FINANCEIRO}/caixa`).flush(caixa);
    await pc;
    expect(store.caixa().dados).toEqual(caixa);

    const pf = store.carregarFiado();
    http.expectOne(`${FINANCEIRO}/fiado`).flush({}, { status: 500, statusText: 'Erro' });
    await pf;
    expect(store.fiado().erro).toBeTruthy();
    expect(store.fiado().carregando).toBe(false);
    expect(store.caixa().erro).toBeNull();
  });

  it.each([
    [
      'cascos',
      'clientes',
      'cascos',
      'carregarCascos',
      [{ clienteId: 'c1', nome: 'A', saldoCascos: 3 }],
    ],
    [
      'sucata',
      'clientes',
      'sucata',
      'carregarSucata',
      [{ clienteId: 'c1', nome: 'A', totalEntregue: 2 }],
    ],
    [
      'contaFuncionarios',
      'rh',
      'conta-funcionarios',
      'carregarContaFuncionarios',
      [{ funcionarioId: 'f1', nome: 'Ana', saldoAPagar: 10 }],
    ],
  ] as const)(
    '%s: sucesso, erro e recarga mantendo os dados',
    async (campo, svc, fim, loader, dados) => {
      const url = `/api/${svc}/v1/relatorios/${fim}`;
      const p1 = store[loader]();
      expect(store[campo]().carregando).toBe(true);
      http.expectOne(url).flush(dados);
      await p1;
      expect(store[campo]()).toEqual({ dados, carregando: false, erro: null });

      const p2 = store[loader]();
      expect(store[campo]().carregando).toBe(true);
      expect(store[campo]().dados).toEqual(dados);
      http.expectOne(url).flush({}, { status: 500, statusText: 'Erro' });
      await p2;
      expect(store[campo]().dados).toBeNull();
      expect(store[campo]().erro).toBeTruthy();
      expect(store[campo]().carregando).toBe(false);
    },
  );

  it('estoque: carregarEstoque busca /relatorios/estoque e /produtos juntos', async () => {
    const relatorio = { itens: [], alertasEstoqueMinimo: [], cascos: [] };
    const p = store.carregarEstoque();
    expect(store.estoque().carregando).toBe(true);
    http.expectOne('/api/estoque/v1/relatorios/estoque').flush(relatorio);
    http.expectOne('/api/estoque/v1/produtos').flush([]);
    await p;
    expect(store.estoque()).toEqual({
      dados: { ...relatorio, produtos: [] },
      carregando: false,
      erro: null,
    });

    const p2 = store.carregarEstoque();
    http
      .expectOne('/api/estoque/v1/relatorios/estoque')
      .flush({}, { status: 500, statusText: 'Erro' });
    await p2;
    expect(store.estoque().dados).toBeNull();
    expect(store.estoque().erro).toBeTruthy();
  });
});
