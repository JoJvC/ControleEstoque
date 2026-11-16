import { marcaResp, produtoResp } from '../../core/api/testing';
import { BASE, detalhe, montarRotas } from './abastecimento-testing';

const total = (el: HTMLElement) =>
  (el.querySelector('.total b')?.textContent ?? '').replace(/\s/g, ' ');
const campos = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLInputElement>('ce-money-input input'));

describe('AbastecimentoCustosPage — momento 2', () => {
  it('digitar custos e frete e salvar: PUT com os ids das linhas e total do servidor', async () => {
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/ab1/custos');
    await t.responderCustos('ab1', detalhe());
    expect(t.texto()).toContain('Água 20L — Marca A');
    expect(t.texto()).toContain('Gás P13 — sem marca');
    expect(t.texto()).toContain('Vasilhame Galão 20L');
    expect(t.texto()).toContain('Custo pendente');

    const [custoA, custoG, , frete] = campos(t.el());
    await t.digitar(custoA, '800'); // R$ 8,00; o vasilhame fica vazio
    await t.digitar(custoG, '9000'); // R$ 90,00
    await t.digitar(frete, '1800'); // R$ 18,00
    await t.clicar('Salvar custos');

    const req = t.http.expectOne(`${BASE}/abastecimentos/ab1/custos`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      funcionarioId: 'f1',
      frete: 18,
      itens: [
        { id: 'l1', custoUnitario: 8 },
        { id: 'l2', custoUnitario: 90 },
      ],
      cascos: [],
    });
    // O servidor rateia o frete entre produtos e vasilhames: 551 difere da soma local (548).
    // O vasilhame segue sem custo, então a carga continua pendente.
    req.flush(
      detalhe({
        frete: 18,
        custoPendente: true,
        custoTotal: 551,
        itens: [
          { id: 'l1', produtoMarcaId: 'pm-a', quantidade: 10, custoUnitario: 8, custoDaUnidade: 9 },
          {
            id: 'l2',
            produtoMarcaId: 'pm-g',
            quantidade: 5,
            custoUnitario: 90,
            custoDaUnidade: 91,
          },
        ],
      }),
    );
    await t.assentar();
    await t.assentar();
    expect(total(t.el())).toBe('R$ 551,00');
    expect(t.texto()).toContain('Custo pendente');
    expect(t.toasts().at(-1)?.detail).toBe('Ainda pendente: custo de 1 linha.');
    t.http.verify();
  });

  it('abre com o que já foi lançado e manda o vasilhame quando preenchido', async () => {
    const t = await montarRotas(['*'], '/estoque/abastecimento/ab1/custos');
    await t.responderCustos(
      'ab1',
      detalhe({
        frete: 12.5,
        custoTotal: 100,
        itens: [
          { id: 'l1', produtoMarcaId: 'pm-a', quantidade: 10, custoUnitario: 8, custoDaUnidade: 9 },
          {
            id: 'l2',
            produtoMarcaId: 'pm-g',
            quantidade: 5,
            custoUnitario: null,
            custoDaUnidade: null,
          },
        ],
      }),
    );
    expect(campos(t.el()).map((c) => c.value)).toEqual(['8,00', '', '', '12,50']);
    expect(total(t.el())).toBe('R$ 100,00');

    await t.digitar(campos(t.el())[2], '350');
    await t.clicar('Salvar custos');
    const req = t.http.expectOne(`${BASE}/abastecimentos/ab1/custos`);
    expect(req.request.body).toEqual({
      funcionarioId: 'f1',
      frete: 12.5,
      itens: [{ id: 'l1', custoUnitario: 8 }],
      cascos: [{ id: 'c1', custoUnitario: 3.5 }],
    });
    req.flush(detalhe());
  });

  it('produtos de mesmo nome e tamanhos diferentes aparecem com o tamanho', async () => {
    const agua = (id: string, tamanho: string, marcaId: string) =>
      produtoResp({
        id,
        nome: 'Água',
        tamanho,
        marcas: [marcaResp({ id: marcaId, marcaNome: 'Marca A' })],
      });
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/ab1/custos', [
      agua('a10', '10L', 'pm-10'),
      agua('a20', '20L', 'pm-20'),
    ]);
    await t.responderCustos(
      'ab1',
      detalhe({
        itens: [
          {
            id: 'l1',
            produtoMarcaId: 'pm-10',
            quantidade: 1,
            custoUnitario: null,
            custoDaUnidade: null,
          },
          {
            id: 'l2',
            produtoMarcaId: 'pm-20',
            quantidade: 2,
            custoUnitario: null,
            custoDaUnidade: null,
          },
        ],
        cascos: [],
      }),
    );
    const nomes = Array.from(t.el().querySelectorAll('.linha__info b')).map((b) => b.textContent);
    expect(nomes).toEqual(['Água 10L — Marca A', 'Água 20L — Marca A']);
  });

  it('digitar 0 no custo do vasilhame e no frete envia 0 e fecha a pendência com confirmação', async () => {
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/ab1/custos');
    await t.responderCustos('ab1', detalhe());
    const [custoA, custoG, vasilhame, frete] = campos(t.el());
    await t.digitar(custoA, '800');
    await t.digitar(custoG, '9000');
    await t.digitar(vasilhame, '0'); // veio de graça
    await t.digitar(frete, '0'); // retirada nossa
    expect(vasilhame.value).toBe('0,00');
    expect(frete.value).toBe('0,00');
    await t.clicar('Salvar custos');

    const req = t.http.expectOne(`${BASE}/abastecimentos/ab1/custos`);
    expect(req.request.body).toEqual({
      funcionarioId: 'f1',
      frete: 0,
      itens: [
        { id: 'l1', custoUnitario: 8 },
        { id: 'l2', custoUnitario: 90 },
      ],
      cascos: [{ id: 'c1', custoUnitario: 0 }],
    });
    req.flush(detalhe({ frete: 0, custoPendente: false, custoTotal: 530 }));
    await t.assentar();
    await t.assentar();
    expect(total(t.el())).toBe('R$ 530,00');
    expect(t.texto()).not.toContain('Custo pendente');
    const aviso = t.toasts().at(-1);
    expect(aviso?.message).toBe('Custos salvos');
    expect(aviso?.detail?.replace(/\s/g, ' ')).toBe('Total da carga: R$ 530,00');
  });

  it('salvar com falta de custo avisa o que falta', async () => {
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/ab1/custos');
    await t.responderCustos('ab1', detalhe());
    await t.clicar('Salvar custos');
    t.http.expectOne(`${BASE}/abastecimentos/ab1/custos`).flush(detalhe());
    await t.assentar();
    await t.assentar();
    const aviso = t.toasts().at(-1);
    expect(aviso?.message).toBe('Custos salvos');
    expect(aviso?.detail).toBe('Ainda pendente: custo de 3 linhas e frete.');
  });

  it('frete vazio vai como null', async () => {
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/ab1/custos');
    await t.responderCustos('ab1', detalhe());
    await t.clicar('Salvar custos');
    const req = t.http.expectOne(`${BASE}/abastecimentos/ab1/custos`);
    expect(req.request.body).toEqual({ funcionarioId: 'f1', frete: null, itens: [], cascos: [] });
    req.flush(detalhe());
  });

  it('erro do servidor aparece inline', async () => {
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/ab1/custos');
    await t.responderCustos('ab1', detalhe());
    await t.clicar('Salvar custos');
    t.http
      .expectOne(`${BASE}/abastecimentos/ab1/custos`)
      .flush(
        { code: 'CUSTO_INVALIDO', message: 'Custo inválido.', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await t.assentar();
    await t.assentar();
    expect(t.el().querySelector('[role="alert"]')?.textContent).toContain('Custo inválido');
  });

  it('GET do detalhe leva funcionarioId na query', async () => {
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/ab1/custos');
    const req = t.http.expectOne((r) => r.url === `${BASE}/abastecimentos/ab1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('funcionarioId')).toBe('f1');
    req.flush(detalhe());
    t.http.expectOne(`${BASE}/produtos`).flush([]);
    t.http.expectOne(`${BASE}/estoque/cascos`).flush([]);
    t.http.expectOne(`${BASE}/tipos-casco`).flush([]);
  });
});

describe('rotas de custos sem estoque.custos', () => {
  it.each([['/estoque/abastecimento/pendentes'], ['/estoque/abastecimento/ab1/custos']])(
    '%s nega com toast e volta para /',
    async (url) => {
      const t = await montarRotas(['estoque.editar'], url);
      expect(t.url()).toBe('/');
      expect(t.toasts().map((x) => x.message)).toEqual(['Sem permissão para acessar esta tela']);
      t.http.expectNone(() => true);
    },
  );
});
