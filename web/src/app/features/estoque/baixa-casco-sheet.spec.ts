import { DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { BaixaCascoSheet } from './baixa-casco-sheet';
import { EstoqueStore } from './estoque-store';

const FUNCIONARIOS = [
  {
    id: 'f1',
    nome: 'Maria',
    telefone: null,
    cargoId: 'c1',
    cargo: null,
    valorDiaria: 0,
    ativo: true,
  },
  {
    id: 'f2',
    nome: 'Inativo',
    telefone: null,
    cargoId: 'c1',
    cargo: null,
    valorDiaria: 0,
    ativo: false,
  },
];

const CASCOS = [
  {
    tipoCascoId: 't1',
    nome: 'Casco 20L',
    marcaId: null,
    marca: null,
    aceitaSucata: true,
    vazios: 4,
    sucata: 0,
  },
  {
    tipoCascoId: 't2',
    nome: 'Casco sem vazio',
    marcaId: null,
    marca: null,
    aceitaSucata: true,
    vazios: 0,
    sucata: 3,
  },
];

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [BaixaCascoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  TestBed.inject(EstoqueStore).carregar();
  TestBed.inject(HttpTestingController).expectOne('/api/estoque/v1/produtos').flush([]);
  TestBed.inject(HttpTestingController).expectOne('/api/estoque/v1/estoque/cascos').flush(CASCOS);
  const fixture = TestBed.createComponent(BaixaCascoSheet);
  fixture.detectChanges();
  http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    close,
    http,
    tipo: (id: string) => {
      const sel = el.querySelector('select') as HTMLSelectElement;
      sel.value = id;
      sel.dispatchEvent(new Event('change'));
    },
    confirmar: () =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Registrar'),
      ) as HTMLButtonElement,
  };
}

describe('BaixaCascoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza só os funcionários ativos como responsáveis', async () => {
    const t = await montar();
    expect(t.el.textContent).toContain('Maria');
    expect(t.el.textContent).not.toContain('Inativo');
  });

  it('oferece só os tipos com vazios > 0', async () => {
    const t = await montar();
    const opcoes = Array.from(t.el.querySelectorAll('select option')).map((o) => o.textContent);
    expect(opcoes.join('|')).toContain('Casco 20L');
    expect(opcoes.join('|')).not.toContain('Casco sem vazio');
  });

  it('sem tipo: não chama a API e mostra o erro', async () => {
    const t = await montar();
    (t.el.querySelector('ce-checkbox input') as HTMLInputElement).click();
    await t.fixture.whenStable();

    t.confirmar().click();
    await t.fixture.whenStable();
    t.fixture.detectChanges();

    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain('Escolha o tipo');
  });

  it('sem responsável: não chama a API e mostra o erro', async () => {
    const t = await montar();
    t.tipo('t1');

    t.confirmar().click();
    await t.fixture.whenStable();
    t.fixture.detectChanges();

    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain('ao menos um funcionário');
  });

  it('com responsável: Confirmar envia a baixa e fecha com true', async () => {
    const t = await montar();
    t.tipo('t1');
    const caixa = t.el.querySelector('ce-checkbox input') as HTMLInputElement;
    caixa.click();
    await t.fixture.whenStable();

    t.confirmar().click();
    const req = t.http.expectOne('/api/estoque/v1/estoque/cascos/baixas');
    expect(req.request.body).toEqual({
      tipoCascoId: 't1',
      quantidade: 1,
      motivo: 'QUEBRADO',
      observacao: null,
      responsaveisIds: ['f1'],
    });
    req.flush({ id: 'b1' });
    await t.fixture.whenStable();
    t.http.expectOne('/api/estoque/v1/produtos').flush([]);
    t.http.expectOne('/api/estoque/v1/estoque/cascos').flush([]);
    await t.fixture.whenStable();
    expect(t.close).toHaveBeenCalledWith(true);
  });

  it('padrão é Quebrado: radio marcado e título de quebra', async () => {
    const t = await montar();

    const radios = Array.from(t.el.querySelectorAll('[role="radio"]'));
    const quebrado = radios.find((r) => r.textContent!.includes('Quebrado'))!;
    expect(quebrado.getAttribute('aria-checked')).toBe('true');
    expect(t.el.textContent).toContain('Baixa de casco por quebra');
  });

  it('Perdido: troca título e aviso e envia motivo PERDIDO com a observação aparada', async () => {
    const t = await montar();
    t.tipo('t1');
    const perdido = Array.from(t.el.querySelectorAll<HTMLElement>('[role="radio"]')).find((r) =>
      r.textContent!.includes('Perdido'),
    )!;
    perdido.click();
    t.fixture.detectChanges();
    expect(t.el.textContent).toContain('Baixa de casco por perda');
    expect(t.el.textContent).toContain('não entra na sucata');

    (t.el.querySelector('ce-checkbox input') as HTMLInputElement).click();
    const obs = t.el.querySelector('ce-input input') as HTMLInputElement;
    obs.value = '  sumiu na rota  ';
    obs.dispatchEvent(new Event('input'));
    await t.fixture.whenStable();

    t.confirmar().click();
    const req = t.http.expectOne('/api/estoque/v1/estoque/cascos/baixas');
    expect(req.request.body).toEqual({
      tipoCascoId: 't1',
      quantidade: 1,
      motivo: 'PERDIDO',
      observacao: 'sumiu na rota',
      responsaveisIds: ['f1'],
    });
    req.flush({ id: 'b1' });
    await t.fixture.whenStable();
    t.http.expectOne('/api/estoque/v1/produtos').flush([]);
    t.http.expectOne('/api/estoque/v1/estoque/cascos').flush([]);
    await t.fixture.whenStable();
    expect(t.close).toHaveBeenCalledWith(true);
  });
});
