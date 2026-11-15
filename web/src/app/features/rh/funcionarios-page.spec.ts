import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { rodarGuardDaRota } from '../../core/permissions/testing';
import { diariaValida } from './funcionario-form';
import { FuncionariosPage } from './funcionarios-page';
import { RH_ROUTES } from './rh-routes';
import { acoes, assentar, configurar } from './testing';

const URL = '/api/rh/v1/funcionarios';
const CARGOS = '/api/rh/v1/cargos';
const CARGO = { id: 'c1', nome: 'Caixa', nativo: false, permissoes: [] };
const ANA = {
  id: 'f1',
  nome: 'Ana',
  telefone: null,
  cargoId: 'c1',
  cargo: 'Caixa',
  valorDiaria: 100,
  ativo: true,
};
const DONO = {
  id: 'f2',
  nome: 'Dono',
  telefone: null,
  cargoId: 'c1',
  cargo: 'Caixa',
  valorDiaria: 0,
  ativo: false,
};

async function montar(permissoes: string[], lista = [ANA, DONO]) {
  configurar(permissoes);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(FuncionariosPage);
  fixture.detectChanges();
  await assentar(fixture);
  http.expectOne(URL).flush(lista);
  await assentar(fixture);
  return { fixture, http, ...acoes(fixture) };
}

async function abrirForm(t: Awaited<ReturnType<typeof montar>>) {
  t.botao('Novo funcionário')!.click();
  await assentar(t.fixture);
  t.http.expectOne(CARGOS).flush([CARGO]);
  await assentar(t.fixture);
}

describe('diariaValida', () => {
  it('null e negativa são inválidas; 0 e 50 são válidas', () => {
    expect(diariaValida(null)).toBe(false);
    expect(diariaValida(-1)).toBe(false);
    expect(diariaValida(0)).toBe(true);
    expect(diariaValida(50)).toBe(true);
  });
});

describe('FuncionariosPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista: diária 0 mostra Sem diária, maior que 0 mostra BRL, badge e link', async () => {
    const t = await montar(['rh.gerir']);
    const linhas = Array.from(t.el.querySelectorAll('li'));
    expect(linhas[0].textContent).toContain('Ana');
    expect(linhas[0].textContent).toContain('Caixa');
    expect(linhas[0].textContent).toMatch(/R\$\s*100,00/);
    expect(linhas[0].textContent).toContain('Ativo');
    expect(linhas[0].textContent).not.toContain('Sem diária');
    expect(linhas[1].textContent).toContain('Sem diária');
    expect(linhas[1].textContent).toContain('Inativo');
  });

  it('ce-app-header mostra o título Funcionários', async () => {
    const t = await montar(['rh.gerir']);
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Funcionários');
  });

  it('a linha mostra as iniciais do nome, o nome e o cargo', async () => {
    const t = await montar(['rh.gerir'], [{ ...ANA, nome: 'João (ADM)' }]);
    const linha = t.el.querySelector('li')!;
    expect(linha.querySelector('.avatar')!.textContent).toBe('JA');
    expect(linha.textContent).toContain('João (ADM)');
    expect(linha.textContent).toContain('Caixa');
  });

  it('selecionadoId marca só a linha aberta com aria-current', async () => {
    configurar(['rh.gerir']);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(FuncionariosPage);
    fixture.componentRef.setInput('embutido', true);
    fixture.componentRef.setInput('selecionadoId', 'f2');
    fixture.detectChanges();
    await assentar(fixture);
    http.expectOne(URL).flush([ANA, DONO]);
    await assentar(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ce-app-header')).toBeNull();
    const itens = Array.from(el.querySelectorAll('ce-list-item'));
    expect(itens.map((i) => i.getAttribute('aria-current'))).toEqual([null, 'true']);
  });

  it('clique na linha navega para /rh/funcionarios/:id', async () => {
    const t = await montar(['rh.gerir']);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    t.el.querySelector<HTMLButtonElement>('li ce-list-item button')!.click();
    expect(navegar).toHaveBeenCalledWith('/rh/funcionarios/f1');
  });

  it('ação da ce-barra-acao abre o formulário de criação', async () => {
    const t = await montar(['rh.gerir']);
    const botao = t.el.querySelector<HTMLButtonElement>('ce-barra-acao button')!;
    expect(botao.textContent).toContain('Novo funcionário');
    botao.click();
    await assentar(t.fixture);
    t.http.expectOne(CARGOS).flush([CARGO]);
    await assentar(t.fixture);
    expect(t.el.querySelector('form')).not.toBeNull();
  });

  it('criar: nome, cargo e diária geram o POST e o funcionário entra na lista', async () => {
    const t = await montar(['rh.gerir'], []);
    await abrirForm(t);
    await t.nome('Ana');
    await t.cargo('c1');
    await t.diaria('10000');
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nome: 'Ana',
      telefone: null,
      cargoId: 'c1',
      valorDiaria: 100,
      ativo: true,
    });
    req.flush({ ...ANA, cargo: null }, { status: 201, statusText: 'Created' });
    await assentar(t.fixture);
    t.http.expectOne(URL).flush([ANA]);
    await assentar(t.fixture);
    expect(t.el.querySelector('form')).toBeNull();
    expect(t.el.querySelector('li')!.textContent).toContain('Ana');
    expect(t.el.querySelector('li')!.textContent).toContain('Caixa');
  });

  it('Sem diária: campo em 0,00 desabilitado e POST com valorDiaria 0', async () => {
    const t = await montar(['rh.gerir'], []);
    await abrirForm(t);
    await t.nome('Dono');
    await t.cargo('c1');
    await t.marcar('Sem diária');
    expect(t.inputDiaria().value).toBe('0,00');
    expect(t.inputDiaria().disabled).toBe(true);
    expect(t.botao('Salvar')!.disabled).toBe(false);
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(URL);
    expect(req.request.body.valorDiaria).toBe(0);
    req.flush(DONO, { status: 201, statusText: 'Created' });
    await assentar(t.fixture);
    t.http.expectOne(URL).flush([DONO]);
    await assentar(t.fixture);
    expect(t.el.querySelector('li')!.textContent).toContain('Sem diária');
  });

  it('desmarcar Sem diária esvazia o campo e Salvar volta a ficar desabilitado', async () => {
    const t = await montar(['rh.gerir'], []);
    await abrirForm(t);
    await t.nome('Dono');
    await t.cargo('c1');
    await t.marcar('Sem diária');
    await t.marcar('Sem diária');
    expect(t.inputDiaria().disabled).toBe(false);
    expect(t.inputDiaria().value).toBe('');
    expect(t.botao('Salvar')!.disabled).toBe(true);
  });

  it('Salvar fica desabilitado sem nome, sem cargo ou com diária vazia', async () => {
    const t = await montar(['rh.gerir'], []);
    await abrirForm(t);
    expect(t.botao('Salvar')!.disabled).toBe(true);
    await t.cargo('c1');
    await t.diaria('5000');
    expect(t.botao('Salvar')!.disabled).toBe(true); // sem nome
    await t.nome('Ana');
    expect(t.botao('Salvar')!.disabled).toBe(false);
    await t.diaria('');
    expect(t.botao('Salvar')!.disabled).toBe(true); // diária vazia
    await t.diaria('5000');
    await t.cargo('');
    expect(t.botao('Salvar')!.disabled).toBe(true); // sem cargo
  });

  it('falha ao listar cargos: alerta no formulário', async () => {
    const t = await montar(['rh.gerir'], []);
    t.botao('Novo funcionário')!.click();
    await assentar(t.fixture);
    t.http.expectOne(CARGOS).flush({}, { status: 500, statusText: 'x' });
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain('cargos');
  });

  it('sem rh.gerir: sem Novo funcionário', async () => {
    const t = await montar([]);
    expect(t.botao('Novo funcionário')).toBeUndefined();
  });
});

describe('rotas /rh/funcionarios', () => {
  for (const path of ['funcionarios', 'funcionarios/:id']) {
    const rota = RH_ROUTES.find((r) => r.path === path)!;

    it(`${path}: libera com rh.gerir`, () => {
      expect(rodarGuardDaRota(rota, ['rh.gerir'])).toBe(true);
    });

    it(`${path}: sem rh.gerir dá UrlTree para /`, () => {
      const r = rodarGuardDaRota(rota, []);
      expect(r).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/');
    });
  }
});
