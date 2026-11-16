import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AppHeader } from './app-header';

function montar(onda?: boolean) {
  const fixture = TestBed.createComponent(AppHeader);
  fixture.componentRef.setInput('titulo', 'Clientes');
  if (onda !== undefined) fixture.componentRef.setInput('onda', onda);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

@Component({
  imports: [AppHeader],
  template: `
    <ce-app-header
      titulo="Produtos"
      [mostrarVoltar]="voltarVisivel"
      [fixo]="fixo"
      [secao]="secao"
      (voltar)="voltou = voltou + 1"
    >
      <button type="button" class="acao">+ Novo</button>
      <p ce-destaque class="meu-destaque">Resumo</p>
    </ce-app-header>
  `,
})
class Hospedeiro {
  voltarVisivel = true;
  fixo = true;
  secao = false;
  voltou = 0;
}

function hospedar(ajuste: Partial<Hospedeiro> = {}) {
  const fixture = TestBed.createComponent(Hospedeiro);
  Object.assign(fixture.componentInstance, ajuste);
  fixture.detectChanges();
  return fixture;
}

describe('AppHeader', () => {
  it('com onda: classe de topo e svg decorativo', () => {
    const el = montar(true);
    expect(el.querySelector('.topo--onda')).not.toBeNull();
    expect(el.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Clientes');
  });

  it('com onda: sem borda nem sombra no rodapé do cabeçalho', () => {
    const el = montar(true);
    expect(el.classList.contains('app-header--onda')).toBe(true);
    for (const alvo of [
      el,
      el.querySelector('.topo--onda'),
      el.querySelector('header.cabecalho'),
    ]) {
      const css = getComputedStyle(alvo as Element);
      expect(['', 'none']).toContain(css.borderBottomStyle);
      expect(['', '0px']).toContain(css.borderBottomWidth);
      expect(['', 'none']).toContain(css.boxShadow);
    }
  });

  it('onda é o padrão: classe de topo e svg sem passar o input', () => {
    const el = montar();
    expect(el.querySelector('.topo--onda')).not.toBeNull();
    expect(el.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('onda=false: nem classe de topo nem svg', () => {
    const el = montar(false);
    expect(el.querySelector('.topo--onda')).toBeNull();
    expect(el.querySelector('svg.topo__onda')).toBeNull();
  });

  it('a linha do cabeçalho é sticky; fixo=false não é', () => {
    const fixo = hospedar();
    const linha = fixo.nativeElement.querySelector('header.cabecalho') as HTMLElement;
    expect(getComputedStyle(linha).position).toBe('sticky');
    expect(getComputedStyle(linha).top).toContain('--ce-cabecalho-topo');

    const solto = hospedar({ fixo: false });
    const linhaSolta = solto.nativeElement.querySelector('header.cabecalho') as HTMLElement;
    expect(getComputedStyle(linhaSolta).position).not.toBe('sticky');
  });

  it('o destaque fica fora do elemento sticky e a ação dentro do contêiner de ações', () => {
    const el = hospedar().nativeElement as HTMLElement;
    const linha = el.querySelector('header.cabecalho') as HTMLElement;
    const destaque = el.querySelector('.meu-destaque') as HTMLElement;
    expect(linha.contains(destaque)).toBe(false);
    expect(destaque.closest('.topo')).not.toBeNull();
    expect(linha.querySelector('.cabecalho__acoes .acao')?.textContent).toContain('+ Novo');
  });

  it('ordem no DOM: voltar, título (h1), ações', () => {
    const linha = hospedar().nativeElement.querySelector('header.cabecalho') as HTMLElement;
    const [voltar, texto, acoes] = Array.from(linha.children);
    expect(voltar.tagName).toBe('BUTTON');
    expect(voltar.getAttribute('aria-label')).toBe('Voltar');
    expect(voltar.getAttribute('type')).toBe('button');
    expect(texto.querySelector('h1')?.textContent).toContain('Produtos');
    expect(acoes.classList).toContain('cabecalho__acoes');
  });

  it('voltar emite uma vez no clique e some com mostrarVoltar=false', () => {
    const fixture = hospedar();
    const botao = fixture.nativeElement.querySelector('button[aria-label="Voltar"]') as HTMLElement;
    botao.click();
    expect(fixture.componentInstance.voltou).toBe(1);

    const sem = hospedar({ voltarVisivel: false });
    expect(sem.nativeElement.querySelector('button[aria-label="Voltar"]')).toBeNull();
  });

  it('secao: h2, sem topo, sem onda e sem sticky', () => {
    const el = hospedar({ secao: true }).nativeElement as HTMLElement;
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('h2')?.textContent).toContain('Produtos');
    expect(el.querySelector('.topo--onda')).toBeNull();
    expect(el.querySelector('svg.topo__onda')).toBeNull();
    const linha = el.querySelector('header.cabecalho') as HTMLElement;
    expect(linha.classList).not.toContain('cabecalho--topo');
    expect(getComputedStyle(linha).position).not.toBe('sticky');
  });

  it('rótulo sai como recebido, sem transformação de caixa', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.componentRef.setInput('titulo', 'Aparência');
    fixture.componentRef.setInput('rotulo', 'Guardado neste aparelho');
    fixture.detectChanges();
    const rotulo = (fixture.nativeElement as HTMLElement).querySelector('.cabecalho__rotulo');
    expect(rotulo?.textContent?.trim()).toBe('Guardado neste aparelho');
    expect(['', 'none']).toContain(getComputedStyle(rotulo as Element).textTransform);
  });
});
