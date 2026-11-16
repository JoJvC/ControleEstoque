import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { MediaService } from '../../core/platform/media-service';
import { lerPadraoPagina, reenviarForm } from '../../ui/organisms/padrao-pagina.testing';
import { ProdutoFormPage } from './produto-form-page';

const BASE = '/api/estoque/v1';
const MARCAS = [
  { id: 'm1', nome: 'Indaiá' },
  { id: 'm2', nome: 'Crystal' },
];
const CASCOS = [
  {
    id: 'c-gen',
    nome: 'Galão 20L',
    marcaId: null,
    marca: null,
    precoVasilhame: 12,
    aceitaSucata: true,
  },
  {
    id: 'c-ind',
    nome: 'Galão Indaiá',
    marcaId: 'm1',
    marca: 'Indaiá',
    precoVasilhame: 15,
    aceitaSucata: false,
  },
];

async function montar(opcoes: { marcas?: unknown[]; id?: string } = {}) {
  const media = {
    pickImage: vi.fn(),
    previewUrl: vi.fn().mockReturnValue('blob:prévia'),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: MediaService, useValue: media },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ProdutoFormPage);
  if (opcoes.id) {
    fixture.componentRef.setInput('id', opcoes.id);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  http.expectOne(`${BASE}/marcas`).flush(opcoes.marcas ?? MARCAS);
  http.expectOne(`${BASE}/tipos-casco`).flush(CASCOS);
  const el = fixture.nativeElement as HTMLElement;
  const assentar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await assentar();

  const t = {
    fixture,
    el,
    http,
    navegar,
    media,
    assentar,
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)),
    linhas: () => Array.from(el.querySelectorAll<HTMLElement>('section.marca')),
    salvar: () => el.querySelector<HTMLButtonElement>('ce-app-header .cabecalho__acoes button')!,
    /** Próxima requisição aberta pela store (espera as promessas encadeadas). */
    proxima: async (): Promise<TestRequest> => {
      for (let i = 0; i < 100; i++) {
        const [req] = http.match(() => true);
        if (req) {
          return req;
        }
        await new Promise((r) => setTimeout(r));
      }
      throw new Error('nenhuma requisição aberta');
    },
    digitar: async (campo: HTMLInputElement, valor: string) => {
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      await assentar();
    },
    escolher: async (sel: HTMLSelectElement, valor: string) => {
      sel.value = valor;
      sel.dispatchEvent(new Event('change'));
      await assentar();
    },
    nome: (v: string) => t.digitar(el.querySelector('ce-input input') as HTMLInputElement, v),
    selectDaLinha: (i: number) =>
      t.linhas()[i].querySelector('ce-select select') as HTMLSelectElement,
    preencherLinha: async (i: number, marca: string, preco: string, minimo: string) => {
      await t.escolher(t.selectDaLinha(i), marca);
      await t.digitar(
        t.linhas()[i].querySelector('ce-money-input input') as HTMLInputElement,
        preco,
      );
      await t.digitar(t.linhas()[i].querySelector('ce-input input') as HTMLInputElement, minimo);
    },
    tipo: async (texto: string) => {
      t.botao(texto)!.click();
      await assentar();
    },
    /** Termina a recarga da lista que a store faz depois de salvar. */
    fim: async () => {
      (await t.proxima()).flush([]);
      await fixture.whenStable();
    },
  };
  return t;
}

describe('ProdutoFormPage', () => {
  beforeEach(() => {
    // jsdom não implementa scrollIntoView
    HTMLElement.prototype.scrollIntoView ??= vi.fn();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza o formulário com voltar e Salvar no cabeçalho, sem barra e sem placeholder', async () => {
    const t = await montar();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Novo produto');
    expect(lerPadraoPagina(t.el)).toEqual({
      cabecalhos: 1,
      voltar: true,
      acoes: ['Salvar'],
      barras: 0,
      cancelar: 0,
    });
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('produto novo abre Descartável com a linha "Sem marca" preenchida', async () => {
    const t = await montar();
    expect(t.linhas()).toHaveLength(1);
    expect(t.selectDaLinha(0).selectedOptions[0].textContent?.trim()).toBe('Sem marca');
    expect(t.el.textContent).not.toContain('Casco genérico');
  });

  it('clicar em Retornável mostra os cascos; em Descartável, esconde', async () => {
    const t = await montar();
    await t.tipo('Retornável');
    expect(t.el.textContent).toContain('Casco genérico');
    expect(t.el.textContent).toContain('Casco específico');
    await t.tipo('Descartável');
    expect(t.el.textContent).not.toContain('Casco genérico');
    expect(t.el.textContent).not.toContain('Casco específico');
  });

  it('o select de marca tem "Sem marca" primeiro; o específico lista só os cascos da marca', async () => {
    const t = await montar({ marcas: [...MARCAS, { id: 'g', nome: 'Genérica' }] });
    await t.tipo('Retornável');
    const opcoes = Array.from(t.selectDaLinha(0).options).map((o) => o.textContent?.trim());
    expect(opcoes).toEqual(['Selecione…', 'Sem marca', 'Indaiá', 'Crystal']);
    await t.escolher(t.selectDaLinha(0), 'm1');
    const especifico = t.linhas()[0].querySelectorAll('ce-select select')[1] as HTMLSelectElement;
    expect(Array.from(especifico.options).map((o) => o.textContent?.trim())).toEqual([
      'Usa o casco genérico',
      'Galão Indaiá',
    ]);
  });

  it('Adicionar marca acrescenta uma linha; Remover tira a linha não salva', async () => {
    const t = await montar();
    t.botao('Adicionar marca')!.click();
    await t.assentar();
    expect(t.linhas()).toHaveLength(2);
    (t.linhas()[1].querySelector('ce-button button') as HTMLButtonElement).click();
    await t.assentar();
    expect(t.linhas()).toHaveLength(1);
  });

  it('Descartável num produto novo sem linhas traz a linha "Sem marca" de volta', async () => {
    const t = await montar();
    await t.tipo('Retornável');
    t.botao('Remover')!.click();
    await t.assentar();
    expect(t.linhas()).toHaveLength(0);
    await t.tipo('Descartável');
    expect(t.linhas()).toHaveLength(1);
    expect(t.selectDaLinha(0).selectedOptions[0].textContent?.trim()).toBe('Sem marca');
  });

  it('Salvar inválido mostra o erro local e não chama a API', async () => {
    const t = await montar();
    t.salvar().click();
    await t.assentar();
    expect(t.el.textContent).toContain('Informe o nome do produto.');
    expect(t.el.textContent).toContain('Informe um preço válido.');
    expect(t.el.querySelector('.form__erro')!.textContent).toContain('Corrija os campos');
    t.http.expectNone(() => true);
  });

  it('linha nova (a "Sem marca" inicial e a de Adicionar marca) vem com o estoque mínimo 0 no valor', async () => {
    const t = await montar();
    t.botao('Adicionar marca')!.click();
    await t.assentar();
    expect(t.linhas()).toHaveLength(2);
    for (const linha of t.linhas()) {
      const minimo = linha.querySelector('ce-input input') as HTMLInputElement;
      expect(minimo.value).toBe('0');
      expect(minimo.placeholder).toBe('');
    }
  });

  it('com várias marcas, o Salvar segue no cabeçalho e o fim da página não reserva espaço de barra', async () => {
    const t = await montar();
    for (let i = 0; i < 4; i++) {
      t.botao('Adicionar marca')!.click();
      await t.assentar();
    }
    expect(t.linhas()).toHaveLength(5);
    // jsdom não calcula layout (nem elementFromPoint): confere o cabeçalho e a regra do espaço
    expect(t.el.querySelector('ce-barra-acao')).toBeNull();
    expect(t.salvar().textContent).toContain('Salvar');
    const reserva = getComputedStyle(t.el.querySelector('form.form')!).paddingBottom;
    expect(reserva).not.toContain('--ce-barra-acao-height');
  });

  it('envio duplo: com o POST pendente, Enter e Salvar do cabeçalho não enviam de novo', async () => {
    const t = await montar();
    await t.nome('Gelo 5kg');
    await t.escolher(t.selectDaLinha(0), '__sem-marca__');
    await t.digitar(
      t.linhas()[0].querySelector('ce-money-input input') as HTMLInputElement,
      '1000',
    );
    t.salvar().click();
    const req = await t.proxima();
    expect(req.request.method).toBe('POST');
    const submitter = reenviarForm(t.el);
    t.salvar().click();
    await t.assentar();
    t.http.expectNone(() => true); // um só POST
    t.fixture.detectChanges();
    expect(submitter.hidden).toBe(true);
    expect(submitter.disabled).toBe(true);
    req.flush({}, { status: 500, statusText: 'Erro' });
    await new Promise((r) => setTimeout(r)); // o erro da API vira ApiError no interceptor
    await t.assentar();
    t.fixture.detectChanges();
    expect(submitter.disabled).toBe(false);
  });

  it('Salvar sem tocar no estoque mínimo envia 0', async () => {
    const t = await montar({ marcas: [...MARCAS, { id: 'g9', nome: 'Genérica' }] });
    await t.nome('Gelo 5kg');
    await t.escolher(t.selectDaLinha(0), '__sem-marca__');
    await t.digitar(
      t.linhas()[0].querySelector('ce-money-input input') as HTMLInputElement,
      '1000',
    );
    t.salvar().click();
    let req = await t.proxima();
    req.flush(produtoResp({ id: 'p1', tipo: 'DESCARTAVEL', marcas: [] }));
    req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas`);
    expect(req.request.body.estoqueMinimo).toBe(0);
    req.flush(produtoResp({ id: 'p1', marcas: [marcaResp({ id: 'pm1', marcaId: 'g9' })] }));
    await t.fim();
  });

  it('Salvar com erro rola até o primeiro campo inválido e o foca', async () => {
    const t = await montar();
    const entradas = () => Array.from(t.el.querySelectorAll<HTMLInputElement>('ce-input input'));
    const rolar = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');

    t.salvar().click();
    await t.assentar();
    expect(document.activeElement).toBe(entradas()[0]); // nome
    expect(rolar.mock.contexts.at(-1)).toBe(entradas()[0]);

    await t.nome('Gelo 5kg');
    await t.escolher(t.selectDaLinha(0), '__sem-marca__');
    t.salvar().click();
    await t.assentar();
    const preco = t.linhas()[0].querySelector('ce-money-input input');
    expect(document.activeElement).toBe(preco);
    expect(rolar.mock.contexts.at(-1)).toBe(preco);

    await t.digitar(preco as HTMLInputElement, '1000');
    await t.digitar(t.linhas()[0].querySelector('ce-input input') as HTMLInputElement, 'x');
    t.salvar().click();
    await t.assentar();
    expect(document.activeElement).toBe(t.linhas()[0].querySelector('ce-input input'));
    t.http.expectNone(() => true);
  });

  it('Retornável: Salvar envia produto, marcas (com específico) e a foto da associação', async () => {
    const t = await montar();
    await t.tipo('Retornável');
    await t.nome('Água 20L');
    await t.escolher(
      t.el.querySelector('.form ce-form-field ce-select select') as HTMLSelectElement,
      'c-gen',
    );
    await t.preencherLinha(0, 'm1', '1200', '5');
    await t.escolher(
      t.linhas()[0].querySelectorAll('ce-select select')[1] as HTMLSelectElement,
      'c-ind',
    );
    expect(t.linhas()[0].textContent).toContain('Usa o casco Galão Indaiá.');

    const foto = new File(['x'], 'a.png', { type: 'image/png' });
    t.media.pickImage.mockResolvedValue(foto);
    (t.linhas()[0].querySelector('.marca__foto') as HTMLButtonElement).click();
    await t.assentar();
    expect(t.linhas()[0].querySelector('img')!.getAttribute('src')).toBe('blob:prévia');

    t.salvar().click();
    let req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos`);
    expect(req.request.body).toEqual({
      tipo: 'RETORNAVEL',
      nome: 'Água 20L',
      categoria: null,
      tamanho: null,
      tipoCascoId: 'c-gen',
    });
    req.flush(produtoResp({ id: 'p1', marcas: [] }));
    req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas`);
    expect(req.request.body).toEqual({
      marcaId: 'm1',
      precoReferencia: 12,
      estoqueMinimo: 5,
      tipoCascoId: 'c-ind',
    });
    req.flush(produtoResp({ id: 'p1', marcas: [marcaResp({ id: 'pm1', marcaId: 'm1' })] }));
    req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas/pm1/foto`);
    expect(((req.request.body as FormData).get('foto') as File).name).toBe('a.png');
    req.flush({ fotoUrl: 'u' });
    await t.fim();
    expect(t.navegar).toHaveBeenCalledWith('/produtos');
  });

  it('"Sem marca" + Salvar sem a Genérica cadastrada: cria a marca antes e grava nela', async () => {
    const t = await montar();
    await t.nome('Gelo 5kg');
    await t.preencherLinha(0, '__sem-marca__', '1000', '2');
    t.salvar().click();
    let req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/marcas`);
    expect(req.request.body).toEqual({ nome: 'Genérica' });
    req.flush({ id: 'g1', nome: 'Genérica' });
    req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos`);
    expect(req.request.body.tipoCascoId).toBeNull();
    req.flush(produtoResp({ id: 'p1', tipo: 'DESCARTAVEL', marcas: [] }));
    req = await t.proxima();
    expect(req.request.body).toEqual({
      marcaId: 'g1',
      precoReferencia: 10,
      estoqueMinimo: 2,
      tipoCascoId: null,
    });
    req.flush(produtoResp({ id: 'p1', marcas: [marcaResp({ id: 'pm1', marcaId: 'g1' })] }));
    await t.fim();
  });

  it('"Sem marca" + Salvar com a Genérica já cadastrada: nenhum POST /marcas', async () => {
    const t = await montar({ marcas: [...MARCAS, { id: 'g9', nome: 'GENERICA' }] });
    await t.nome('Gelo 5kg');
    await t.preencherLinha(0, '__sem-marca__', '1000', '2');
    t.salvar().click();
    let req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos`);
    req.flush(produtoResp({ id: 'p1', tipo: 'DESCARTAVEL', marcas: [] }));
    req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p1/marcas`);
    expect(req.request.body.marcaId).toBe('g9');
    req.flush(produtoResp({ id: 'p1', marcas: [marcaResp({ id: 'pm1', marcaId: 'g9' })] }));
    await t.fim();
  });

  it('erro do backend aparece pela mensagem do envelope', async () => {
    const t = await montar();
    await t.nome('Gelo');
    await t.preencherLinha(0, 'm1', '100', '0');
    t.salvar().click();
    (await t.proxima()).flush(
      { code: 'NOME_OBRIGATORIO', message: 'Nome do produto é obrigatório.', traceId: 't' },
      { status: 400, statusText: 'Bad Request' },
    );
    await new Promise((r) => setTimeout(r));
    await t.assentar();
    expect(t.el.querySelector('.form__erro')!.textContent).toContain(
      'Nome do produto é obrigatório.',
    );
    expect(t.navegar).not.toHaveBeenCalled();
  });

  it('edição com casco específico salvo: virar Descartável e Salvar limpa o casco da associação antes do produto', async () => {
    const t = await montar({ id: 'p7' });
    const existente = produtoResp({
      id: 'p7',
      tipo: 'RETORNAVEL',
      tipoCascoId: 'c-gen',
      marcas: [marcaResp({ id: 'pm1', marcaId: 'm1', marcaNome: 'Indaiá', tipoCascoId: 'c-ind' })],
    });
    (await t.proxima()).flush(existente);
    await t.assentar();
    await t.tipo('Descartável');
    expect(t.el.textContent).not.toContain('Casco específico');

    t.salvar().click();
    let req = await t.proxima();
    expect(req.request.method).toBe('PUT');
    expect(req.request.url).toBe(`${BASE}/produtos/p7/marcas/pm1`);
    expect(req.request.body.tipoCascoId).toBeNull();
    req.flush(existente);
    req = await t.proxima();
    expect(req.request.url).toBe(`${BASE}/produtos/p7`);
    expect(req.request.body).toMatchObject({ tipo: 'DESCARTAVEL', tipoCascoId: null });
    req.flush(existente);
    await t.fim();
  });

  it('edição: pré-preenche a partir de GET /produtos/{id}; a Genérica abre como "Sem marca"', async () => {
    const t = await montar({ id: 'p7', marcas: [...MARCAS, { id: 'g', nome: 'Genérica' }] });
    const get = await t.proxima();
    expect(get.request.url).toBe(`${BASE}/produtos/p7`);
    get.flush(
      produtoResp({
        id: 'p7',
        tipo: 'RETORNAVEL',
        nome: 'Água 20L',
        tipoCascoId: 'c-gen',
        marcas: [
          marcaResp({
            id: 'pm1',
            marcaId: 'm1',
            marcaNome: 'Indaiá',
            precoReferencia: 12,
            estoqueMinimo: 5,
            fotoUrl: '/f',
            tipoCascoId: 'c-ind',
          }),
          marcaResp({ id: 'pm2', marcaId: 'g', marcaNome: 'Genérica' }),
        ],
      }),
    );
    await t.assentar();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Editar produto');
    expect((t.el.querySelector('ce-input input') as HTMLInputElement).value).toBe('Água 20L');
    expect(t.linhas()).toHaveLength(2);
    expect(t.selectDaLinha(0).value).toBe('m1');
    expect(t.selectDaLinha(1).selectedOptions[0].textContent?.trim()).toBe('Sem marca');
    expect((t.linhas()[0].querySelector('ce-money-input input') as HTMLInputElement).value).toBe(
      '12,00',
    );
    expect(t.linhas()[0].querySelector('img')!.getAttribute('src')).toBe(
      `${BASE}/produtos/p7/marcas/pm1/foto`,
    );
    // linhas salvas não têm Remover
    expect(t.botao('Remover')).toBeUndefined();

    t.salvar().click();
    const req = await t.proxima();
    expect(req.request.method).toBe('PUT');
    expect(req.request.url).toBe(`${BASE}/produtos/p7`);
    req.flush(produtoResp({ id: 'p7' }));
    await t.fim();
    t.http.expectNone(() => true);
  });
});
