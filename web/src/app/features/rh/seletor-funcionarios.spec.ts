import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { SeletorFuncionarios } from './seletor-funcionarios';

const URL = '/api/rh/v1/funcionarios';
const func = (id: string, nome: string, ativo = true) => ({
  id,
  nome,
  telefone: null,
  cargoId: 'c',
  cargo: null,
  valorDiaria: 0,
  ativo,
});

async function montar(inicial: string[] = []) {
  await TestBed.configureTestingModule({
    imports: [SeletorFuncionarios],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(SeletorFuncionarios);
  fixture.componentRef.setInput('selecionados', new Set(inicial));
  const carregados: unknown[] = [];
  fixture.componentInstance.ativosCarregados.subscribe((l) => carregados.push(l));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const caixas = () => Array.from(el.querySelectorAll<HTMLInputElement>('ce-checkbox input'));
  const nomes = () =>
    Array.from(el.querySelectorAll('ce-checkbox')).map((c) => c.textContent?.trim());
  const assentar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, el, http, caixas, nomes, assentar, carregados };
}

describe('SeletorFuncionarios', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista só os ativos e emite a lista de ativos', async () => {
    const t = await montar();
    t.http.expectOne(URL).flush([func('a', 'Ana'), func('b', 'Bia', false), func('c', 'Caio')]);
    await t.assentar();
    expect(t.nomes()).toEqual(['Ana', 'Caio']);
    expect(t.carregados).toHaveLength(1);
    expect((t.carregados[0] as { id: string }[]).map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('clique marca e desmarca, e reflete a seleção inicial', async () => {
    const t = await montar(['a']);
    t.http.expectOne(URL).flush([func('a', 'Ana'), func('c', 'Caio')]);
    await t.assentar();
    expect(t.caixas().map((c) => c.checked)).toEqual([true, false]);

    t.caixas()[1].click();
    await t.assentar();
    expect([...t.fixture.componentInstance.selecionados()]).toEqual(['a', 'c']);
    expect(t.caixas().map((c) => c.checked)).toEqual([true, true]);

    t.caixas()[0].click();
    await t.assentar();
    expect([...t.fixture.componentInstance.selecionados()]).toEqual(['c']);
    expect(t.caixas().map((c) => c.checked)).toEqual([false, true]);
  });

  it('sem funcionário ativo mostra o vazio', async () => {
    const t = await montar();
    t.http.expectOne(URL).flush([func('b', 'Bia', false)]);
    await t.assentar();
    expect(t.el.textContent).toContain('Nenhum funcionário ativo encontrado.');
  });

  it('erro mostra a mensagem e não emite a lista', async () => {
    const t = await montar();
    t.http.expectOne(URL).flush(null, { status: 500, statusText: 'x' });
    await t.assentar();
    expect(t.el.textContent).toContain('Não foi possível carregar os funcionários.');
    expect(t.carregados).toHaveLength(0);
  });
});
