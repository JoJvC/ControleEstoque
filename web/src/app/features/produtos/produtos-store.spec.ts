import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProdutoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { ApiError } from '../../core/http/api-error';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { MarcasStore } from './marcas-store';
import { FormProduto, SEM_MARCA, aoTrocarTipo, formDe, novaLinha } from './produto-form-modelo';
import { ProdutosStore } from './produtos-store';

const BASE = '/api/estoque/v1';
const ERRO = (code: string, message = 'falhou') => ({ code, message, traceId: 't' });

const form = (p: Partial<FormProduto> = {}): FormProduto => ({
  id: null,
  tipo: 'RETORNAVEL',
  nome: 'Água 20L',
  categoria: '',
  tamanho: '',
  tipoCascoId: 'c-gen',
  linhas: [],
  ...p,
});

const com = (
  marcas: { pmId: string; marcaId: string; nome?: string }[],
  id = 'p1',
): ProdutoResponse =>
  produtoResp({
    id,
    marcas: marcas.map((m) =>
      marcaResp({ id: m.pmId, marcaId: m.marcaId, marcaNome: m.nome ?? m.marcaId }),
    ),
  });

describe('ProdutosStore.salvar', () => {
  let store: ProdutosStore;
  let marcas: MarcasStore;
  let http: HttpTestingController;
  const ordem: string[] = [];

  beforeEach(() => {
    ordem.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(ProdutosStore);
    marcas = TestBed.inject(MarcasStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Espera a próxima requisição que a store abrir, na ordem. */
  async function proxima(): Promise<TestRequest> {
    for (let i = 0; i < 100; i++) {
      const [req] = http.match(() => true);
      if (req) {
        ordem.push(`${req.request.method} ${req.request.url.replace(BASE, '')}`);
        return req;
      }
      await new Promise((r) => setTimeout(r));
    }
    throw new Error('a store não abriu a requisição esperada');
  }

  async function carregarMarcas(lista: { id: string; nome: string }[]) {
    marcas.carregar();
    http.expectOne(`${BASE}/marcas`).flush(lista);
  }

  /** Termina o salvar: responde o GET /produtos da recarga da lista. */
  async function fim(salvando: Promise<unknown>) {
    (await proxima()).flush([]);
    await salvando;
  }

  it('criação: POST produto → POST marca ×2 → POST foto, com o multipart na associação', async () => {
    const foto = new File(['x'], 'a.png', { type: 'image/png' });
    const f = form({
      linhas: [
        novaLinha({ marcaId: 'm1', preco: 12, minimo: '5', foto }),
        novaLinha({ marcaId: 'm2', preco: 13, minimo: '3', tipoCascoId: 'c-esp' }),
      ],
    });
    const salvando = store.salvar(f);

    let req = await proxima();
    expect(req.request.body).toEqual({
      tipo: 'RETORNAVEL',
      nome: 'Água 20L',
      categoria: null,
      tamanho: null,
      tipoCascoId: 'c-gen',
    });
    req.flush(com([]));

    req = await proxima();
    expect(req.request.body).toEqual({
      marcaId: 'm1',
      precoReferencia: 12,
      estoqueMinimo: 5,
      tipoCascoId: null,
    });
    req.flush(com([{ pmId: 'pm1', marcaId: 'm1' }]));

    req = await proxima();
    expect(req.request.body).toMatchObject({ marcaId: 'm2', tipoCascoId: 'c-esp' });
    req.flush(
      com([
        { pmId: 'pm1', marcaId: 'm1' },
        { pmId: 'pm2', marcaId: 'm2' },
      ]),
    );

    req = await proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas/pm1/foto`);
    const corpo = req.request.body as FormData;
    expect(corpo).toBeInstanceOf(FormData);
    expect((corpo.get('foto') as File).name).toBe('a.png');
    req.flush({ fotoUrl: 'u' });

    await fim(salvando);
    expect(ordem).toEqual([
      'POST /produtos',
      'POST /produtos/p1/marcas',
      'POST /produtos/p1/marcas',
      'POST /produtos/p1/marcas/pm1/foto',
      'GET /produtos',
    ]);
  });

  it('edição: PUT produto, PUT só nas linhas alteradas, POST nas novas e a foto', async () => {
    const existente = com([
      { pmId: 'pm1', marcaId: 'm1' },
      { pmId: 'pm2', marcaId: 'm2' },
    ]);
    const base = formDe(existente, () => '');
    const foto = new File(['x'], 'b.jpg');
    const f: FormProduto = {
      ...base,
      linhas: [
        base.linhas[0],
        { ...base.linhas[1], preco: 99, foto },
        novaLinha({ marcaId: 'm3', preco: 1, minimo: '0' }),
      ],
    };
    const salvando = store.salvar(f);

    let req = await proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1`);
    req.flush(existente);

    req = await proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas/pm2`);
    expect(req.request.body.precoReferencia).toBe(99);
    req.flush(existente);

    req = await proxima();
    expect(req.request.method).toBe('POST');
    expect(req.request.body.marcaId).toBe('m3');
    req.flush(
      com([
        { pmId: 'pm1', marcaId: 'm1' },
        { pmId: 'pm2', marcaId: 'm2' },
        { pmId: 'pm3', marcaId: 'm3' },
      ]),
    );

    req = await proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas/pm2/foto`);
    req.flush({ fotoUrl: 'u' });

    await fim(salvando);
    expect(ordem).toEqual([
      'PUT /produtos/p1',
      'PUT /produtos/p1/marcas/pm2',
      'POST /produtos/p1/marcas',
      'POST /produtos/p1/marcas/pm2/foto',
      'GET /produtos',
    ]);
  });

  it('edição que vira Descartável (só troca o tipo): PUT da associação com casco nulo antes do produto', async () => {
    const existente = produtoResp({
      id: 'p1',
      tipoCascoId: 'c-gen',
      marcas: [marcaResp({ id: 'pm1', marcaId: 'm1', tipoCascoId: 'c-esp' })],
    });
    const f = aoTrocarTipo(
      formDe(existente, () => ''),
      'DESCARTAVEL',
    );
    const salvando = store.salvar(f);
    let req = await proxima();
    expect(req.request.method).toBe('PUT');
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas/pm1`);
    expect(req.request.body.tipoCascoId).toBeNull();
    req.flush(existente);
    req = await proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1`);
    expect(req.request.body.tipoCascoId).toBeNull();
    req.flush(existente);
    await fim(salvando);
    expect(ordem).toEqual(['PUT /produtos/p1/marcas/pm1', 'PUT /produtos/p1', 'GET /produtos']);
  });

  it('falha parcial: guarda o produto criado e o próximo salvar faz PUT, sem repetir a marca já gravada', async () => {
    const f = form({
      linhas: [
        novaLinha({ marcaId: 'm1', preco: 12, minimo: '5' }),
        novaLinha({ marcaId: 'm2', preco: 13, minimo: '3' }),
      ],
    });
    let salvando = store.salvar(f);
    const falha = salvando.catch((e: unknown) => e);
    (await proxima()).flush(com([]));
    (await proxima()).flush(com([{ pmId: 'pm1', marcaId: 'm1' }]));
    (await proxima()).flush(ERRO('MARCA_INEXISTENTE', 'Marca 2 não cadastrada.'), {
      status: 422,
      statusText: 'Unprocessable Entity',
    });
    const erro = await falha;
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).userMessage).toContain('Marca 2');

    ordem.length = 0;
    salvando = store.salvar(f);
    let req = await proxima();
    expect(req.request.method).toBe('PUT');
    expect(req.request.url).toBe(`${BASE}/produtos/p1`);
    req.flush(com([{ pmId: 'pm1', marcaId: 'm1' }]));
    req = await proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas/pm1`);
    expect(req.request.method).toBe('PUT');
    req.flush(com([{ pmId: 'pm1', marcaId: 'm1' }]));
    req = await proxima();
    expect(req.request.method).toBe('POST');
    expect(req.request.body.marcaId).toBe('m2');
    req.flush(
      com([
        { pmId: 'pm1', marcaId: 'm1' },
        { pmId: 'pm2', marcaId: 'm2' },
      ]),
    );
    await fim(salvando);
  });

  it('reiniciar esquece o produto parcial: o próximo salvar cria de novo', async () => {
    const f = form({ linhas: [novaLinha({ marcaId: 'm1', preco: 1, minimo: '0' })] });
    const falha = store.salvar(f).catch((e: unknown) => e);
    (await proxima()).flush(com([]));
    (await proxima()).flush(ERRO('PRECO_INVALIDO'), { status: 400, statusText: 'Bad Request' });
    await falha;

    store.reiniciar();
    const salvando = store.salvar(form());
    const req = await proxima();
    expect(req.request.method).toBe('POST');
    req.flush(com([]));
    await fim(salvando);
  });

  describe('linha "Sem marca"', () => {
    const f = () =>
      form({
        tipo: 'DESCARTAVEL',
        tipoCascoId: null,
        nome: 'Gelo 5kg',
        linhas: [novaLinha({ marcaId: SEM_MARCA, preco: 10, minimo: '2' })],
      });

    it('com a Genérica existente (GENERICA): nenhum POST /marcas e a associação usa o id dela', async () => {
      await carregarMarcas([{ id: 'g1', nome: 'GENERICA' }]);
      const salvando = store.salvar(f());
      (await proxima()).flush(com([]));
      const req = await proxima();
      expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas`);
      expect(req.request.body.marcaId).toBe('g1');
      req.flush(com([{ pmId: 'pm1', marcaId: 'g1' }]));
      await fim(salvando);
      expect(ordem).not.toContain('POST /marcas');
    });

    it('sem a Genérica: POST /marcas { nome } antes do produto, uma vez só, mesmo após falha', async () => {
      await carregarMarcas([]);
      let salvando = store.salvar(f());
      const falha = salvando.catch((e: unknown) => e);
      let req = await proxima();
      expect(ordem[0]).toBe('POST /marcas');
      expect(req.request.body).toEqual({ nome: 'Genérica' });
      req.flush({ id: 'g1', nome: 'Genérica' });
      (await proxima()).flush(ERRO('NOME_OBRIGATORIO'), { status: 400, statusText: 'Bad Request' });
      await falha;

      ordem.length = 0;
      store.reiniciar();
      salvando = store.salvar(f());
      (await proxima()).flush(com([]));
      req = await proxima();
      expect(req.request.body.marcaId).toBe('g1');
      req.flush(com([{ pmId: 'pm1', marcaId: 'g1' }]));
      await fim(salvando);
      expect(ordem).not.toContain('POST /marcas');
    });

    it('409 ao criar a Genérica: relê GET /marcas e usa a que achou', async () => {
      await carregarMarcas([]);
      const salvando = store.salvar(f());
      (await proxima()).flush(ERRO('MARCA_DUPLICADA'), { status: 409, statusText: 'Conflict' });
      const relida = await proxima();
      expect(relida.request.method).toBe('GET');
      expect(relida.request.url).toBe(`${BASE}/marcas`);
      relida.flush([{ id: 'g9', nome: 'genérica' }]);
      (await proxima()).flush(com([]));
      const req = await proxima();
      expect(req.request.body.marcaId).toBe('g9');
      req.flush(com([{ pmId: 'pm1', marcaId: 'g9' }]));
      await fim(salvando);
    });

    it('409 e a Genérica não aparece na releitura: expõe o erro e não grava nada', async () => {
      await carregarMarcas([]);
      const falha = store.salvar(f()).catch((e: unknown) => e);
      (await proxima()).flush(ERRO('MARCA_DUPLICADA', 'Marca já existe.'), {
        status: 409,
        statusText: 'Conflict',
      });
      (await proxima()).flush([]);
      const erro = await falha;
      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).code).toBe('MARCA_DUPLICADA');
      http.expectNone(`${BASE}/produtos`);
    });
  });
});
