import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { TiposCascoPage } from './tipos-casco-page';

const URL = '/api/estoque/v1/tipos-casco';
const MARCAS = '/api/estoque/v1/marcas';
const GENERICO = {
  id: 't1',
  nome: 'Galão 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 12,
  aceitaSucata: true,
};
const ESPECIFICO = {
  id: 't2',
  nome: 'Galão 20L Cascataí',
  marcaId: 'm1',
  marca: 'Cascataí',
  precoVasilhame: 15,
  aceitaSucata: false,
};
const LISTA_MARCAS = [
  { id: 'm1', nome: 'Cascataí' },
  { id: 'm2', nome: 'Indaiá' },
];

async function montar(tipos: unknown[] = [GENERICO, ESPECIFICO]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(TiposCascoPage);
  fixture.detectChanges();
  await fixture.whenStable();
  http.expectOne(URL).flush(tipos);
  http.expectOne(MARCAS).flush(LISTA_MARCAS);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const assentar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return {
    fixture,
    http,
    el,
    assentar,
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto))!,
    item: (texto: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('ce-list-item button')).find((b) =>
        b.textContent?.includes(texto),
      )!,
    nome: async (v: string) => {
      const campo = el.querySelector('ce-input input') as HTMLInputElement;
      campo.value = v;
      campo.dispatchEvent(new Event('input'));
      await assentar();
    },
    preco: async (digitos: string) => {
      const campo = el.querySelector('ce-money-input input') as HTMLInputElement;
      campo.value = digitos;
      campo.dispatchEvent(new Event('input'));
      await assentar();
    },
    marca: async (v: string) => {
      const sel = el.querySelector('ce-select select') as HTMLSelectElement;
      sel.value = v;
      sel.dispatchEvent(new Event('change'));
      await assentar();
    },
    select: () => el.querySelector('ce-select select') as HTMLSelectElement,
    form: () => el.querySelector('form') as HTMLFormElement,
  };
}

describe('TiposCascoPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista genérico e específico com preço e chip de sucata', async () => {
    const t = await montar();
    const txt = t.el.textContent ?? '';
    expect(txt).toContain('genérico');
    expect(txt).toContain('específico · Cascataí');
    expect(t.el.querySelectorAll('.chip-sucata').length).toBe(1);
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('o título "Tipos de casco" aparece só no cabeçalho, não no cartão', async () => {
    const t = await montar();
    expect(t.el.querySelector('.cartao h2')).toBeNull();
    expect(t.el.textContent?.split('Tipos de casco').length).toBe(2);
  });

  it('lista vazia mostra o estado vazio', async () => {
    const t = await montar([]);
    expect(t.el.textContent).toContain('Nenhum tipo de casco');
  });

  it('Novo → nome, preço e checkbox → Salvar envia POST', async () => {
    const t = await montar();
    t.botao('Novo tipo de casco').click();
    await t.assentar();
    expect(t.select().value).toBe('');
    await t.nome('  Galão 10L ');
    await t.preco('1250');
    (t.el.querySelector('ce-checkbox input') as HTMLInputElement).click();
    await t.assentar();
    t.botao('Salvar').click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nome: 'Galão 10L',
      marcaId: null,
      precoVasilhame: 12.5,
      aceitaSucata: true,
    });
    req.flush({ ...GENERICO, id: 't3', nome: 'Galão 10L', precoVasilhame: 12.5 });
    await t.assentar();
    expect(t.el.textContent).toContain('Galão 10L');
    expect(t.el.querySelector('form')).toBeNull();
  });

  it('Novo lista as marcas e criar com marca envia o marcaId', async () => {
    const t = await montar();
    t.botao('Novo tipo de casco').click();
    await t.assentar();
    const opcoes = Array.from(t.select().options).map((o) => o.textContent?.trim());
    expect(opcoes).toEqual(['Nenhuma — casco genérico', 'Cascataí', 'Indaiá']);
    await t.nome('Galão 20L Indaiá');
    await t.marca('m2');
    t.botao('Salvar').click();
    const req = t.http.expectOne(URL);
    expect(req.request.body.marcaId).toBe('m2');
    req.flush({ ...ESPECIFICO, id: 't4', marcaId: 'm2', marca: 'Indaiá' });
    await t.assentar();
  });

  it('clique no item abre a edição com os valores; salvar envia PUT', async () => {
    const t = await montar();
    t.item('Galão 20L').click();
    await t.assentar();
    expect((t.el.querySelector('ce-input input') as HTMLInputElement).value).toBe('Galão 20L');
    expect((t.el.querySelector('ce-money-input input') as HTMLInputElement).value).toBe('12,00');
    expect((t.el.querySelector('ce-checkbox input') as HTMLInputElement).checked).toBe(true);
    await t.nome('Galão 20L novo');
    t.botao('Salvar').click();
    const req = t.http.expectOne(`${URL}/t1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      nome: 'Galão 20L novo',
      marcaId: null,
      precoVasilhame: 12,
      aceitaSucata: true,
    });
    req.flush({ ...GENERICO, nome: 'Galão 20L novo' });
    await t.assentar();
  });

  it('item específico abre com a marca; trocar a marca envia PUT com o novo marcaId', async () => {
    const t = await montar();
    t.item('Cascataí').click();
    await t.assentar();
    expect(t.select().value).toBe('m1');
    await t.marca('m2');
    t.botao('Salvar').click();
    const req = t.http.expectOne(`${URL}/t2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.marcaId).toBe('m2');
    req.flush({ ...ESPECIFICO, marcaId: 'm2', marca: 'Indaiá' });
    await t.assentar();
  });

  it('marca do item fora de marcas() entra como opção e é mantida ao salvar', async () => {
    const orfao = { ...ESPECIFICO, marcaId: 'm9', marca: 'Antiga' };
    const t = await montar([orfao]);
    t.item('Antiga').click();
    await t.assentar();
    expect(t.select().value).toBe('m9');
    t.botao('Salvar').click();
    const req = t.http.expectOne(`${URL}/t2`);
    expect(req.request.body.marcaId).toBe('m9');
    req.flush(orfao);
    await t.assentar();
  });

  it('teclado: submit do form (Enter) salva', async () => {
    const t = await montar();
    t.botao('Novo tipo de casco').click();
    await t.assentar();
    await t.nome('Galão 5L');
    t.form().dispatchEvent(new Event('submit'));
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    req.flush({ ...GENERICO, id: 't5', nome: 'Galão 5L', precoVasilhame: 0 });
    await t.assentar();
  });

  it('nome vazio: nenhuma requisição e mostra a mensagem', async () => {
    const t = await montar();
    t.botao('Novo tipo de casco').click();
    await t.assentar();
    t.botao('Salvar').click();
    await t.assentar();
    t.http.expectNone(URL);
    expect(t.el.textContent).toContain('Informe o nome do tipo de casco.');
  });

  it('422 TIPO_CASCO_EM_USO (sucata): mostra a mensagem e mantém o formulário', async () => {
    const t = await montar();
    t.item('Galão 20L').click();
    await t.assentar();
    (t.el.querySelector('ce-checkbox input') as HTMLInputElement).click();
    await t.assentar();
    t.botao('Salvar').click();
    t.http.expectOne(`${URL}/t1`).flush(
      {
        code: 'TIPO_CASCO_EM_USO',
        message: 'Não é possível deixar de aceitar sucata enquanto há saldo de sucata no tipo.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await t.assentar();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('deixar de aceitar sucata');
    expect(t.el.querySelector('form')).not.toBeNull();
  });

  it('422 TIPO_CASCO_EM_USO (troca de marca): mensagem do servidor e marca escolhida mantida', async () => {
    const t = await montar();
    t.item('Cascataí').click();
    await t.assentar();
    await t.marca('m2');
    t.botao('Salvar').click();
    t.http.expectOne(`${URL}/t2`).flush(
      {
        code: 'TIPO_CASCO_EM_USO',
        message:
          'Não é possível trocar a marca de um tipo de casco usado por produto ou associação.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await t.assentar();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('trocar a marca');
    expect(t.select().value).toBe('m2');
  });
});
