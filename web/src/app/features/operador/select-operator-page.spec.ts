import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import userEvent from '@testing-library/user-event';

import { CargoResponse, FuncionarioResponse } from '../../core/api/models/rh';
import { ConfigStore } from '../../core/config/app-config';
import { Operator, OperatorStore } from '../../core/operator/operator-store';
import { StorageService } from '../../core/platform/storage-service';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { SelectOperatorPage } from './select-operator-page';

class FakeStorage extends StorageService {
  private readonly data = new Map<string, unknown>();

  override get<T>(key: string): T | null {
    return (this.data.get(key) as T | undefined) ?? null;
  }

  override set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  override remove(key: string): void {
    this.data.delete(key);
  }
}

const FUNCIONARIOS: FuncionarioResponse[] = [
  {
    id: 'f1',
    nome: 'Maria Silva',
    telefone: null,
    cargoId: 'c1',
    cargo: 'Vendedor',
    valorDiaria: 0,
    ativo: true,
  },
  {
    id: 'f2',
    nome: 'João Souza',
    telefone: null,
    cargoId: 'c-removido',
    cargo: null,
    valorDiaria: 0,
    ativo: true,
  },
];
const CARGOS: CargoResponse[] = [
  { id: 'c1', nome: 'Vendedor', nativo: false, permissoes: ['vendas.registrar'] },
];

async function abrirPagina(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(SelectOperatorPage);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
  http.expectOne('/api/rh/v1/cargos').flush(CARGOS);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('SelectOperatorPage', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
        { provide: StorageService, useValue: storage },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('padrão de página: fora do shell, sem voltar, sem ação e sem barra', async () => {
    const el = await abrirPagina();
    expect(lerPadraoPagina(el)).toEqual({
      cabecalhos: 1,
      voltar: false,
      acoes: [],
      barras: 0,
      cancelar: 0,
    });
    expect(el.querySelector('ce-app-header h1')!.textContent).toContain('Quem está operando?');
  });

  it('a área segura do topo vai para dentro do cabeçalho (o host não gera caixa)', async () => {
    const el = await abrirPagina();
    const linha = el.querySelector('ce-app-header header.cabecalho') as HTMLElement;
    expect(getComputedStyle(linha).paddingTop).toContain('--ce-cabecalho-respiro');
  });

  it('clique no funcionário grava as permissões do cargo no operador', async () => {
    const el = await abrirPagina();

    el.querySelectorAll<HTMLButtonElement>('.operador__item')[0].click();

    expect(TestBed.inject(OperatorStore).operator()?.permissoes).toEqual(['vendas.registrar']);
    expect(storage.get<Operator>('ce.operador')?.permissoes).toEqual(['vendas.registrar']);
  });

  it('cargo ausente resulta em permissoes []', async () => {
    const el = await abrirPagina();

    el.querySelectorAll<HTMLButtonElement>('.operador__item')[1].click();

    expect(TestBed.inject(OperatorStore).operator()?.permissoes).toEqual([]);
  });

  it('erro em cargos mostra o estado de erro', async () => {
    const fixture = TestBed.createComponent(SelectOperatorPage);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
    http.expectOne('/api/rh/v1/cargos').flush('erro', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.operador__retry')).not.toBeNull();
  });

  it('Tab leva o foco ao primeiro item', async () => {
    const el = await abrirPagina();

    await userEvent.setup().tab();

    expect(document.activeElement).toBe(el.querySelectorAll('.operador__item')[0]);
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Espaço', ' '],
  ])('%s no item focado grava as permissões do cargo e navega para /home', async (_nome, tecla) => {
    await abrirPagina();
    const user = userEvent.setup();

    await user.tab();
    await user.keyboard(tecla);

    expect(TestBed.inject(OperatorStore).operator()?.permissoes).toEqual(['vendas.registrar']);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('renderiza o heading, as iniciais e o nome acessível de cada cartão', async () => {
    const el = await abrirPagina();

    expect(el.querySelector('h1')?.textContent).toContain('Quem está operando?');
    const botoes = el.querySelectorAll<HTMLButtonElement>('.operador__item');
    expect(botoes[0].querySelector('.operador__avatar')?.textContent?.trim()).toBe('MS');
    expect(botoes[0].textContent).toContain('Maria Silva');
    expect(botoes[1].querySelector('.operador__avatar')?.textContent?.trim()).toBe('JS');
    expect(botoes[1].textContent).toContain('João Souza');
  });

  it('clique chama select com os dados do funcionário e navega para /home', async () => {
    const el = await abrirPagina();
    const select = vi.spyOn(TestBed.inject(OperatorStore), 'select');

    await userEvent.setup().click(el.querySelectorAll<HTMLButtonElement>('.operador__item')[0]);

    expect(select).toHaveBeenCalledWith({
      id: 'f1',
      nome: 'Maria Silva',
      cargoId: 'c1',
      cargoNome: 'Vendedor',
      permissoes: ['vendas.registrar'],
    });
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/home');
  });

  describe('Tentar novamente', () => {
    async function abrirComErro(): Promise<HTMLButtonElement> {
      const fixture = TestBed.createComponent(SelectOperatorPage);
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
      http
        .expectOne('/api/rh/v1/cargos')
        .flush('erro', { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '.operador__retry',
      )!;
    }

    function respondeNovamente(): void {
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
      http.expectOne('/api/rh/v1/cargos').flush(CARGOS);
    }

    it('clique chama a RhApi de novo', async () => {
      const retry = await abrirComErro();

      await userEvent.setup().click(retry);

      respondeNovamente();
    });

    it('Enter com o foco no botão chama a RhApi de novo', async () => {
      const retry = await abrirComErro();
      const user = userEvent.setup();

      await user.tab();
      expect(document.activeElement).toBe(retry);
      await user.keyboard('{Enter}');

      respondeNovamente();
    });
  });
});
