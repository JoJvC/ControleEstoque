import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { AcoesMais } from './acoes-mais';
import { ShellLayout } from './shell-layout';

describe('ShellLayout — bottom-nav', () => {
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
    Array.from(el.querySelectorAll('a.nav__item')).map((a) => a.textContent?.trim() ?? '');

  it('Vender só aparece com vendas.registrar; atualiza sem recriar o componente', async () => {
    const store = TestBed.inject(OperatorStore);
    store.select(operadorValido([]));
    const fixture = TestBed.createComponent(ShellLayout);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Vender'))).toBe(false);
    expect(rotulos(el).some((t) => t.includes('Clientes'))).toBe(true);

    store.select(operadorValido(['vendas.registrar']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Vender'))).toBe(true);

    store.select(operadorValido(['clientes.cadastrar']));
    await fixture.whenStable();
    expect(rotulos(el).some((t) => t.includes('Vender'))).toBe(false);
    TestBed.inject(HttpTestingController).match(() => true);
  });

  const itens = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>('a.nav__item')).map((a) => ({
      rotulo: a.textContent?.trim(),
      href: a.getAttribute('href'),
      destaque: a.classList.contains('nav__item--destaque'),
      modo: a.classList.contains('nav__item--so-celular')
        ? 'celular'
        : a.classList.contains('nav__item--so-desktop')
          ? 'desktop'
          : 'ambos',
    }));

  const TUDO = ['rh.gerir', 'relatorios.ver', 'vendas.registrar'];

  it('ordem completa: barra do celular e menu lateral do desktop', async () => {
    TestBed.inject(OperatorStore).select(operadorValido(TUDO));
    const fixture = TestBed.createComponent(ShellLayout);
    await fixture.whenStable();
    expect(itens(fixture.nativeElement)).toEqual([
      { rotulo: 'Hoje', href: '/home', destaque: false, modo: 'ambos' },
      { rotulo: 'Clientes', href: '/clientes', destaque: false, modo: 'ambos' },
      { rotulo: 'Vender', href: '/vendas/nova', destaque: true, modo: 'ambos' },
      { rotulo: 'Estoque', href: '/estoque', destaque: false, modo: 'ambos' },
      { rotulo: 'Mais', href: '/mais', destaque: false, modo: 'celular' },
      { rotulo: 'Histórico de vendas', href: '/vendas', destaque: false, modo: 'desktop' },
      { rotulo: 'Caixa do dia', href: '/financeiro/caixa', destaque: false, modo: 'desktop' },
      { rotulo: 'Produtos', href: '/produtos', destaque: false, modo: 'desktop' },
      { rotulo: 'Marcas', href: '/marcas', destaque: false, modo: 'desktop' },
      { rotulo: 'Tipos de casco', href: '/tipos-casco', destaque: false, modo: 'desktop' },
      { rotulo: 'Aparência', href: '/mais/aparencia', destaque: false, modo: 'desktop' },
      { rotulo: 'Funcionários e cargos', href: '/rh', destaque: false, modo: 'desktop' },
      { rotulo: 'Relatórios', href: '/relatorios', destaque: false, modo: 'desktop' },
    ]);
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('sem permissões somem Vender, Funcionários e Relatórios; ao ganhar, voltam sem recriar', async () => {
    const store = TestBed.inject(OperatorStore);
    store.select(operadorValido([]));
    const fixture = TestBed.createComponent(ShellLayout);
    await fixture.whenStable();
    const rot = () => itens(fixture.nativeElement).map((i) => i.rotulo);
    expect(rot()).toEqual([
      'Hoje',
      'Clientes',
      'Estoque',
      'Mais',
      'Histórico de vendas',
      'Caixa do dia',
      'Produtos',
      'Marcas',
      'Tipos de casco',
      'Aparência',
    ]);
    store.select(operadorValido(['rh.gerir', 'relatorios.ver']));
    await fixture.whenStable();
    expect(rot()).toContain('Funcionários e cargos');
    expect(rot()).toContain('Relatórios');
    expect(rot()).not.toContain('Vender');
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('botão Trocar operador no fim do menu dispara a ação compartilhada', async () => {
    TestBed.inject(OperatorStore).select(operadorValido([]));
    const acao = TestBed.inject(AcoesMais);
    const espia = vi.spyOn(acao, 'trocarOperador').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(ShellLayout);
    await fixture.whenStable();
    const botao = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'button.nav__acao',
      ),
    ).find((b) => b.textContent?.includes('Trocar operador'))!;
    botao.click();
    expect(espia).toHaveBeenCalledTimes(1);
    TestBed.inject(HttpTestingController).match(() => true);
  });
});
