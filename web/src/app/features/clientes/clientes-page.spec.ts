import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { ClientesPage } from './clientes-page';

const CLIENTES = '/api/clientes/v1/clientes';
const FIADO_REL = '/api/financeiro/v1/relatorios/fiado';
const CASCOS_REL = '/api/clientes/v1/relatorios/cascos';

const ANA = { id: 'a', nome: 'Ana', telefone: '11', observacoes: null, enderecos: [] };
const BIA = { id: 'b', nome: 'Bia', telefone: null, observacoes: null, enderecos: [] };
const FIADO = [{ clienteId: 'f', nome: 'Fátima', saldoDevedor: 42.5, saldo: -42.5 }];
const CASCOS = [{ clienteId: 'c', nome: 'Caio', saldoCascos: 6 }];

interface Opcoes {
  permissoes?: string[];
  desktop?: boolean;
  id?: string;
  filtro?: string;
  clientes?: unknown[];
  cascos?: unknown[];
}

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

async function montar(opcoes: Opcoes = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: opcoes.desktop === true, breakpoints: {} }) },
      },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(opcoes.permissoes ?? ['*']));
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ClientesPage);
  if (opcoes.id) {
    fixture.componentRef.setInput('id', opcoes.id);
  }
  if (opcoes.filtro !== undefined) {
    fixture.componentRef.setInput('filtro', opcoes.filtro);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;

  // Responde o que estiver pendente (listas, relatórios e o que o detalhe pedir).
  const responder = async () => {
    const respostas: [(url: string) => boolean, object][] = [
      [(u) => u === CLIENTES, opcoes.clientes ?? [ANA, BIA]],
      [(u) => u === FIADO_REL, FIADO],
      [(u) => u === CASCOS_REL, opcoes.cascos ?? CASCOS],
      [
        (u) => u.endsWith('/saldos'),
        {
          saldoCascos: 1,
          sucataEntregue: 0,
          saldoFiado: 1,
          saldo: -1,
          creditoDisponivel: 0,
          cascosPorTipo: [],
          sucataPorTipo: [],
        },
      ],
      [(u) => u === '/api/vendas/v1/vendas', []],
      [
        (u) => u.startsWith(`${CLIENTES}/`),
        { id: 'x', nome: 'Detalhe', telefone: null, observacoes: null, enderecos: [] },
      ],
    ];
    for (const [casa, corpo] of respostas) {
      http.match((r) => casa(r.url)).forEach((r) => r.flush(corpo));
    }
    await assentar(fixture);
  };
  await responder();
  await responder(); // o detalhe só pede depois que a lista já respondeu

  const botoes = (texto: string) =>
    Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.includes(texto));
  return {
    fixture,
    http,
    navegar,
    el,
    responder,
    novo: () => botoes('Novo')[0],
    chip: (rotulo: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('.pilula')).find(
        (b) => b.textContent?.trim() === rotulo,
      )!,
    nomes: () => Array.from(el.querySelectorAll('.nome')).map((n) => n.textContent?.trim()),
    linha: (nome: string) =>
      Array.from(el.querySelectorAll<HTMLElement>('ce-list-item')).find((l) =>
        l.textContent?.includes(nome),
      )!,
    texto: () => (el.textContent ?? '').replace(/\s+/g, ' '),
  };
}

describe('ClientesPage — permissão clientes.cadastrar', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sem a chave: Novo some', async () => {
    expect((await montar({ permissoes: [] })).novo()).toBeUndefined();
  });

  it('padrão de página: raiz sem voltar, + Novo com aria-label no cabeçalho, sem barra', async () => {
    const t = await montar({ permissoes: ['clientes.cadastrar'] });
    expect(lerPadraoPagina(t.el)).toEqual({
      cabecalhos: 1,
      voltar: false,
      acoes: ['+ Novo'],
      barras: 0,
      cancelar: 0,
    });
    expect(t.novo()!.getAttribute('aria-label')).toBe('Novo cliente');
  });

  it('desktop: cada coluna tem o seu cabeçalho e o detalhe não tem voltar', async () => {
    const t = await montar({ desktop: true, permissoes: ['*'] });
    const [lista, detalhe] = Array.from(t.el.querySelectorAll<HTMLElement>('ce-app-header'));
    expect(t.el.querySelectorAll('ce-app-header').length).toBe(2);
    expect(lerPadraoPagina(t.el, lista).voltar).toBe(false);
    expect(lerPadraoPagina(t.el, lista).acoes).toEqual(['+ Novo']);
    expect(lerPadraoPagina(t.el, detalhe).voltar).toBe(false);
    expect(lerPadraoPagina(t.el, detalhe).barras).toBe(0);
  });

  it('com clientes.cadastrar: Novo navega para /clientes/novo', async () => {
    const t = await montar({ permissoes: ['clientes.cadastrar'] });
    t.novo()!.click();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/novo');
  });
});

describe('ClientesPage — lista e chips', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('abre em Todos com a lista da API; o clique em cada chip muda aria-pressed e a lista', async () => {
    const t = await montar();
    expect(t.chip('Todos').getAttribute('aria-pressed')).toBe('true');
    expect(t.nomes()).toEqual(['Ana', 'Bia']);

    t.chip('Com fiado').click();
    await assentar(t.fixture);
    expect(t.chip('Com fiado').getAttribute('aria-pressed')).toBe('true');
    expect(t.chip('Todos').getAttribute('aria-pressed')).toBe('false');
    expect(t.nomes()).toEqual(['Fátima']);
    expect(t.texto()).toContain('Fiado R$ 42,50');

    t.chip('Com casco').click();
    await assentar(t.fixture);
    expect(t.chip('Com casco').getAttribute('aria-pressed')).toBe('true');
    expect(t.nomes()).toEqual(['Caio']);
    expect(t.texto()).toContain('6 cascos');
  });

  it('saldo de casco negativo aparece como "2 a favor", sem sinal de menos', async () => {
    const t = await montar({
      filtro: 'casco',
      cascos: [{ clienteId: 'c', nome: 'Caio', saldoCascos: -2 }],
    });
    await assentar(t.fixture);
    expect(t.texto()).toContain('2 a favor');
    expect(t.texto()).not.toContain('-2');
  });

  it('o chip atualiza a URL com replaceUrl', async () => {
    const t = await montar();
    t.chip('Com fiado').click();
    expect(t.navegar).toHaveBeenCalledWith('/clientes?filtro=fiado', { replaceUrl: true });
    t.chip('Todos').click();
    expect(t.navegar).toHaveBeenCalledWith('/clientes', { replaceUrl: true });
  });

  it('o clique na linha navega para /clientes/<id>; com Com fiado, leva o filtro', async () => {
    const t = await montar();
    t.linha('Bia').querySelector('button')!.click();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/b');

    t.chip('Com fiado').click();
    await assentar(t.fixture);
    t.linha('Fátima').querySelector('button')!.click();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/f?filtro=fiado');
  });

  it('a linha mostra bairro/telefone e os selos de saldo do relatório', async () => {
    const t = await montar({
      clientes: [{ ...ANA, id: 'f' }, BIA],
    });
    const ana = (t.linha('Ana').textContent ?? '').replace(/\s+/g, ' ');
    expect(ana).toContain('11');
    expect(ana).toContain('Fiado R$ 42,50');
    expect(t.linha('Bia').textContent).not.toContain('fiado');
  });

  it('estado vazio: sem busca e com busca; Cadastrar cliente navega para /clientes/novo', async () => {
    const t = await montar({ filtro: 'fiado' });
    t.fixture.nativeElement.querySelector('input[type=text]').value = 'zé';
    t.fixture.nativeElement.querySelector('input[type=text]').dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350));
    await assentar(t.fixture);
    expect(t.texto()).toContain('Ninguém com “zé”');
    expect(t.texto()).toContain('Confira o nome. Se é cliente novo, cadastre agora e já venda.');
    const cadastrar = Array.from(t.el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cadastrar cliente'),
    )!;
    cadastrar.click();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/novo');
  });

  it('estado vazio sem texto na busca: "Ninguém nesta lista"', async () => {
    const t = await montar({ clientes: [] });
    expect(t.texto()).toContain('Ninguém nesta lista');
  });

  it('sem clientes.cadastrar o estado vazio não oferece Cadastrar cliente', async () => {
    const t = await montar({ clientes: [], permissoes: [] });
    expect(t.texto()).not.toContain('Cadastrar cliente');
  });
});

describe('ClientesPage — mestre-detalhe', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('desktop sem id: lista e detalhe juntos, primeiro cliente selecionado', async () => {
    const t = await montar({ desktop: true });
    expect(t.el.querySelector('.mestre')).not.toBeNull();
    expect(t.el.querySelector('ce-cliente-detalhe-page')).not.toBeNull();
    const atuais = t.el.querySelectorAll('[aria-current="true"]');
    expect(atuais).toHaveLength(1);
    expect(atuais[0].textContent).toContain('Ana');
  });

  it('desktop com id: o detalhe é o do id e a linha certa tem aria-current', async () => {
    const t = await montar({ desktop: true, id: 'b' });
    expect(t.linha('Bia').getAttribute('aria-current')).toBe('true');
    expect(t.linha('Ana').getAttribute('aria-current')).toBeNull();
  });

  it('desktop com a lista vazia e sem id: "Selecione um cliente na lista"', async () => {
    const t = await montar({ desktop: true, clientes: [] });
    expect(t.texto()).toContain('Selecione um cliente na lista');
    expect(t.el.querySelector('ce-cliente-detalhe-page')).toBeNull();
  });

  it('celular com id: só o detalhe, sem a lista', async () => {
    const t = await montar({ id: 'a' });
    expect(t.el.querySelector('ce-cliente-detalhe-page')).not.toBeNull();
    expect(t.el.querySelector('ce-list-item')).toBeNull();
    expect(t.el.querySelector('.pilulas')).toBeNull();
  });

  it('celular sem id: só a lista', async () => {
    const t = await montar();
    expect(t.el.querySelector('ce-cliente-detalhe-page')).toBeNull();
    expect(t.el.querySelector('ce-list-item')).not.toBeNull();
  });
});
