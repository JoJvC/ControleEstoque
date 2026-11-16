import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ICONES } from '../../ui/atoms/icon';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { AcoesMais } from '../../layouts/shell-layout/acoes-mais';
import { MaisPage } from './mais-page';

describe('MaisPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
        { provide: StorageService, useValue: new FakeStorage() },
      ],
    });
  });

  const rotulos = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.mais__item')).map((a) => a.textContent?.trim() ?? '');

  it('sem relatorios.ver o link Relatórios some; os de consulta ficam; com a chave aparece, sem recriar', async () => {
    const store = TestBed.inject(OperatorStore);
    store.select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Relatórios'))).toBe(false);
    expect(rotulos(el).some((t) => t.includes('Estoque'))).toBe(true);

    store.select(operadorValido(['relatorios.ver']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Relatórios'))).toBe(true);
  });

  it('padrão de página: raiz do menu sem voltar, sem ação, sem barra', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    await fixture.whenStable();
    expect(lerPadraoPagina(fixture.nativeElement as HTMLElement)).toEqual({
      cabecalhos: 1,
      voltar: false,
      acoes: [],
      barras: 0,
      cancelar: 0,
    });
  });

  it('link Funcionários e cargos só aparece com rh.gerir', async () => {
    const store = TestBed.inject(OperatorStore);
    store.select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Funcionários e cargos'))).toBe(false);

    store.select(operadorValido(['rh.gerir']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Funcionários e cargos'))).toBe(true);
  });

  it('nenhum emoji; cada link tem o ce-icon mapeado', async () => {
    TestBed.inject(OperatorStore).select(operadorValido(['rh.gerir', 'relatorios.ver']));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(el.innerHTML).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{25A0}-\u{25FF}]/u);
    const esperado: Record<string, keyof typeof ICONES> = {
      'Histórico de vendas': 'cupom',
      Estoque: 'caixa',
      'Caixa do dia': 'dinheiro',
      Pedidos: 'pacote',
      Produtos: 'pacote',
      Marcas: 'etiqueta',
      'Tipos de casco': 'casco',
      Aparência: 'paleta',
      'Funcionários e cargos': 'rh',
      Relatórios: 'grafico',
    };
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.mais__lista .mais__item'));
    expect(links).toHaveLength(Object.keys(esperado).length);
    for (const a of links) {
      const nome = esperado[a.textContent!.trim()];
      expect(a.querySelector('ce-icon svg path')!.getAttribute('d')).toBe(ICONES[nome][0]);
    }
    const acoes = Array.from(el.querySelectorAll('.mais__item--acao ce-icon svg path')).map((p) =>
      p.getAttribute('d'),
    );
    expect(acoes[0]).toBe(ICONES.atualizar[0]);
  });

  it('botão Trocar operador chama a ação compartilhada', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const espia = vi
      .spyOn(TestBed.inject(AcoesMais), 'trocarOperador')
      .mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(MaisPage);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.mais__item--acao')!
      .click();
    expect(espia).toHaveBeenCalledTimes(1);
  });

  it('link Aparência aparece para operador sem permissões', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('.mais__item')).find((a) =>
      a.textContent?.includes('Aparência'),
    );
    expect(link?.getAttribute('href')).toBe('/mais/aparencia');
  });

  it('link Caixa do dia leva a /financeiro/caixa (rota sem permissão)', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('.mais__item')).find((a) =>
      a.textContent?.includes('Caixa'),
    );
    expect(link?.getAttribute('href')).toBe('/financeiro/caixa');
  });

  it('link Tipos de casco leva a /tipos-casco (sem permissão)', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const fixture = TestBed.createComponent(MaisPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('.mais__item')).find((a) =>
      a.textContent?.includes('Tipos de casco'),
    );
    expect(link?.getAttribute('href')).toBe('/tipos-casco');
  });
});
