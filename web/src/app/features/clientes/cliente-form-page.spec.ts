import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { SheetService } from '../../core/overlay/sheet-service';
import { ClienteFormPage } from './cliente-form-page';
import { ClientesStore } from './clientes-store';

const URL = '/api/clientes/v1/clientes';

async function montar(
  id?: string,
  enderecos: unknown[] = [],
  antes?: (store: ClientesStore) => void,
) {
  const abrir = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: SheetService, useValue: { abrir } },
    ],
  });
  antes?.(TestBed.inject(ClientesStore));
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ClienteFormPage);
  if (id) {
    fixture.componentRef.setInput('id', id);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  if (id) {
    TestBed.inject(HttpTestingController)
      .expectOne(`${URL}/${id}`)
      .flush({ id, nome: 'Ana', telefone: null, observacoes: null, enderecos });
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    navegar,
    abrir,
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(texto),
      ) as HTMLButtonElement,
    linhas: () =>
      Array.from(el.querySelectorAll('.enderecos > .enderecos__lista .endereco__linha')).map((l) =>
        l.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    http: TestBed.inject(HttpTestingController),
    salvar: () => el.querySelector<HTMLButtonElement>('ce-barra-acao button')!,
    nome: async (v: string) => {
      const campo = el.querySelector('ce-input input') as HTMLInputElement;
      campo.value = v;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
  };
}

describe('ClienteFormPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza o formulário com o botão salvar na barra de ação fixa', async () => {
    const t = await montar();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Novo cliente');
    expect(t.salvar().textContent).toContain('Cadastrar cliente');
  });

  it('clique no salvar da barra envia o payload e navega para o detalhe', async () => {
    const t = await montar();
    await t.nome(' Maria ');

    t.salvar().click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Maria', telefone: null, observacoes: null });
    req.flush({ id: 'c9', nome: 'Maria' });
    await t.fixture.whenStable();
    t.http.match((r) => r.method === 'GET').forEach((r) => r.flush([]));
    await t.fixture.whenStable();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/c9');
  });

  it('nome vazio: não chama a API e mostra o erro', async () => {
    const t = await montar();

    t.salvar().click();
    await t.fixture.whenStable();
    t.fixture.detectChanges();

    t.http.expectNone(URL);
    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain('Informe o nome');
  });
});

const dados = (logradouro: string, principal = false) => ({
  logradouro,
  numero: null,
  bairro: null,
  complemento: null,
  referencia: null,
  principal,
});

describe('ClienteFormPage — endereços no cadastro novo', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function adicionar(t: Awaited<ReturnType<typeof montar>>, d: ReturnType<typeof dados>) {
    t.abrir.mockReturnValueOnce({ closed: of(d) });
    t.botao('Adicionar').click();
    await t.fixture.whenStable();
    t.fixture.detectChanges();
  }

  it('adicionar: o primeiro endereço aparece como principal, sem chamar a API', async () => {
    const t = await montar();
    await adicionar(t, dados('Rua A'));
    expect(t.linhas()).toHaveLength(1);
    expect(t.linhas()[0]).toContain('Rua A');
    expect(t.linhas()[0]).toContain('principal');
    expect(t.abrir.mock.calls[0][1]).toEqual({});
  });

  it('marcar principal, editar e remover mexem na lista local', async () => {
    const t = await montar();
    await adicionar(t, dados('Rua A'));
    await adicionar(t, dados('Rua B'));

    t.botao('Marcar principal').click();
    t.fixture.detectChanges();
    expect(t.linhas()[0]).not.toContain('principal');
    expect(t.linhas()[1]).toContain('principal');

    t.abrir.mockReturnValueOnce({ closed: of(dados('Rua A2')) });
    t.botao('Editar').click();
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.abrir.mock.calls.at(-1)![1]).toMatchObject({ inicial: { logradouro: 'Rua A' } });
    expect(t.linhas()[0]).toContain('Rua A2');

    const remover = Array.from(t.el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Remover'),
    );
    remover[1].click();
    t.fixture.detectChanges();
    expect(t.linhas()).toHaveLength(1);
    expect(t.linhas()[0]).toContain('principal');
  });

  it('salvar: cria o cliente e depois os endereços; sem falha vai para o detalhe', async () => {
    const t = await montar();
    await t.nome('Maria');
    await adicionar(t, dados('Rua A'));

    t.salvar().click();
    t.http.expectOne(URL).flush({ id: 'c9', nome: 'Maria' });
    await t.fixture.whenStable();
    const end = await vi.waitFor(() => t.http.expectOne(`${URL}/c9/enderecos`));
    expect(end.request.body).toEqual(dados('Rua A', true));
    end.flush({ id: 'e1' });
    await vi.waitFor(() => t.http.expectOne((r) => r.method === 'GET').flush([]));
    await vi.waitFor(() => expect(t.navegar).toHaveBeenCalled());
    expect(t.navegar).toHaveBeenCalledWith('/clientes/c9');
  });

  it('salvar com falha em um endereço: navega para /editar e a store guarda o falho', async () => {
    const t = await montar();
    await t.nome('Maria');
    await adicionar(t, dados('Rua A'));
    await adicionar(t, dados('Rua B', true));

    t.salvar().click();
    t.http.expectOne(URL).flush({ id: 'c9', nome: 'Maria' });
    await t.fixture.whenStable();
    t.http
      .expectOne(`${URL}/c9/enderecos`)
      .flush({ message: 'x' }, { status: 500, statusText: 'x' });
    const ok = await vi.waitFor(() => t.http.expectOne(`${URL}/c9/enderecos`));
    expect(ok.request.body).toEqual(dados('Rua B', true));
    ok.flush({ id: 'e2' });
    await vi.waitFor(() => t.http.expectOne((r) => r.method === 'GET').flush([]));
    await vi.waitFor(() => expect(t.navegar).toHaveBeenCalled());
    expect(t.navegar).toHaveBeenCalledWith('/clientes/c9/editar');
    expect(
      TestBed.inject(ClientesStore)
        .falhosDe('c9')
        .map((e) => e.logradouro),
    ).toEqual(['Rua A']);
  });
});

describe('ClienteFormPage — endereços na edição', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const A = { id: 'e-a', ...dados('Rua A', true) };
  const B = { id: 'e-b', ...dados('Rua B') };

  it('lista os endereços salvos do cliente', async () => {
    const t = await montar('c1', [A, B]);
    expect(t.linhas()).toHaveLength(2);
    expect(t.linhas()[0]).toContain('principal');
  });

  it('adicionar: a sheet salva e a lista é recarregada com obter', async () => {
    const t = await montar('c1', [A]);
    t.abrir.mockReturnValueOnce({ closed: of({ id: 'e-b' }) });
    t.botao('Adicionar').click();
    await t.fixture.whenStable();
    expect(t.abrir.mock.calls[0][1]).toEqual({ clienteId: 'c1' });
    t.http
      .expectOne(`${URL}/c1`)
      .flush({ id: 'c1', nome: 'Ana', telefone: null, observacoes: null, enderecos: [A, B] });
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.linhas()).toHaveLength(2);
  });

  it('editar: abre a sheet com o endereço e recarrega', async () => {
    const t = await montar('c1', [A]);
    t.abrir.mockReturnValueOnce({ closed: of({ id: 'e-a' }) });
    t.botao('Editar').click();
    await t.fixture.whenStable();
    expect(t.abrir.mock.calls[0][1]).toMatchObject({
      clienteId: 'c1',
      enderecoId: 'e-a',
      inicial: { logradouro: 'Rua A' },
    });
    t.http
      .expectOne(`${URL}/c1`)
      .flush({ id: 'c1', nome: 'Ana', telefone: null, observacoes: null, enderecos: [A] });
    await t.fixture.whenStable();
  });

  it('marcar principal: PUT com principal=true e recarrega', async () => {
    const t = await montar('c1', [A, B]);
    t.botao('Marcar principal').click();
    const put = t.http.expectOne(`${URL}/c1/enderecos/e-b`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(dados('Rua B', true));
    put.flush({});
    await t.fixture.whenStable();
    t.http.expectOne(`${URL}/c1`).flush({
      id: 'c1',
      nome: 'Ana',
      telefone: null,
      observacoes: null,
      enderecos: [
        { ...A, principal: false },
        { ...B, principal: true },
      ],
    });
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.linhas()[1]).toContain('principal');
  });

  it('remover: DELETE e recarrega', async () => {
    const t = await montar('c1', [A, B]);
    const remover = Array.from(t.el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Remover'),
    );
    remover[0].click();
    const del = t.http.expectOne(`${URL}/c1/enderecos/e-a`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await t.fixture.whenStable();
    t.http.expectOne(`${URL}/c1`).flush({
      id: 'c1',
      nome: 'Ana',
      telefone: null,
      observacoes: null,
      enderecos: [{ ...B, principal: true }],
    });
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.linhas()).toHaveLength(1);
  });

  it('erro da API num gesto: mostra a mensagem e mantém a lista', async () => {
    const t = await montar('c1', [A, B]);
    t.botao('Marcar principal').click();
    t.http
      .expectOne(`${URL}/c1/enderecos/e-b`)
      .flush({ code: 'X', message: 'Não deu' }, { status: 422, statusText: 'x' });
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.el.querySelector('.enderecos [role="alert"]')).not.toBeNull();
    expect(t.linhas()).toHaveLength(2);
  });

  it('salvar na edição envia só os campos do cliente', async () => {
    const t = await montar('c1', [A]);
    t.salvar().click();
    const put = t.http.expectOne(`${URL}/c1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ nome: 'Ana', telefone: null, observacoes: null });
    put.flush({ id: 'c1', nome: 'Ana' });
    await t.fixture.whenStable();
    t.http.match((r) => r.method === 'GET').forEach((r) => r.flush([]));
    await t.fixture.whenStable();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/c1');
  });

  it('falhos da store aparecem separados e "Tentar de novo" reenvia e recarrega', async () => {
    const falho = { chave: 'f1', ...dados('Rua F') };
    let tentar!: ReturnType<typeof vi.spyOn>;
    const t = await montar('c1', [A], (store) => {
      vi.spyOn(store, 'falhosDe').mockReturnValue([falho]);
      tentar = vi.spyOn(store, 'tentarDeNovo').mockResolvedValue({ salvos: [], falhos: [] });
    });
    expect(t.el.querySelector('.falhos')!.textContent).toContain('Rua F');
    expect(t.linhas()).toHaveLength(1);

    t.botao('Tentar de novo').click();
    await t.fixture.whenStable();
    expect(tentar).toHaveBeenCalledWith('c1');
    t.http
      .expectOne(`${URL}/c1`)
      .flush({ id: 'c1', nome: 'Ana', telefone: null, observacoes: null, enderecos: [A] });
    await t.fixture.whenStable();
  });
});
