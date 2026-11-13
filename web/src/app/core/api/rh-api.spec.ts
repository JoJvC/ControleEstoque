import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../config/app-config';
import { RhApi } from './rh-api';

describe('RhApi', () => {
  let api: RhApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    api = TestBed.inject(RhApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const BASE = '/api/rh/v1';

  it('listarFuncionarios: GET /funcionarios repassa o array', () => {
    let resp: unknown;
    api.listarFuncionarios().subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/funcionarios`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'f1' }]);
    expect(resp).toEqual([{ id: 'f1' }]);
  });

  it('listarCargos: GET /cargos', () => {
    api.listarCargos().subscribe();
    const req = http.expectOne(`${BASE}/cargos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('criarCargo: POST /cargos com o corpo', () => {
    const body = { nome: 'Entregador', permissoes: ['VENDER'] } as never;
    api.criarCargo(body).subscribe();
    const req = http.expectOne(`${BASE}/cargos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('atualizarCargo: PUT /cargos/<id> com o corpo', () => {
    const body = { nome: 'Caixa', permissoes: ['caixa.fechar'] };
    api.atualizarCargo('c1', body).subscribe();
    const req = http.expectOne(`${BASE}/cargos/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  const FUNC = {
    nome: 'Ana',
    telefone: null,
    cargoId: 'c1',
    valorDiaria: 0,
    ativo: true,
  };

  it('obterFuncionario: GET /funcionarios/<id>', () => {
    api.obterFuncionario('f1').subscribe();
    const req = http.expectOne(`${BASE}/funcionarios/f1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('criarFuncionario: POST /funcionarios com o corpo', () => {
    api.criarFuncionario(FUNC).subscribe();
    const req = http.expectOne(`${BASE}/funcionarios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(FUNC);
    req.flush({});
  });

  it('atualizarFuncionario: PUT /funcionarios/<id> com o corpo', () => {
    api.atualizarFuncionario('f1', { ...FUNC, ativo: false }).subscribe();
    const req = http.expectOne(`${BASE}/funcionarios/f1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...FUNC, ativo: false });
    req.flush({});
  });

  it('obterContaCorrente: GET /funcionarios/<id>/conta-corrente', () => {
    api.obterContaCorrente('f1').subscribe();
    const req = http.expectOne(`${BASE}/funcionarios/f1/conta-corrente`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('lancarVale: POST /funcionarios/<id>/vales com o corpo', () => {
    const body = { valor: 30, observacao: 'adiantamento' };
    api.lancarVale('f1', body).subscribe();
    const req = http.expectOne(`${BASE}/funcionarios/f1/vales`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ saldoAPagar: 70 });
  });

  it('lancarPagamento: POST /funcionarios/<id>/pagamentos com o corpo', () => {
    const body = { valor: 70, observacao: null };
    api.lancarPagamento('f1', body).subscribe();
    const req = http.expectOne(`${BASE}/funcionarios/f1/pagamentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ saldoAPagar: 0 });
  });
});
