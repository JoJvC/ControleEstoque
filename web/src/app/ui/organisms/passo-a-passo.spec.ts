import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PassoAPasso, textoDoTrilho } from './passo-a-passo';

@Component({
  imports: [PassoAPasso],
  template: `
    <ce-passo-a-passo
      [passos]="passos"
      [atual]="atual()"
      [podeAvancar]="podeAvancar()"
      rotuloFinal="Confirmar venda"
      (voltar)="eventos.push('voltar')"
      (avancar)="eventos.push('avancar')"
      (concluir)="eventos.push('concluir')"
    >
      <span resumo>R$ 10,00</span>
      <p class="corpo">conteúdo do passo</p>
    </ce-passo-a-passo>
  `,
})
class Hospedeiro {
  readonly passos = ['Cliente e produtos', 'Cascos', 'Pagamento'];
  readonly atual = signal(0);
  readonly podeAvancar = signal(true);
  readonly eventos: string[] = [];
}

async function montar() {
  const fixture = TestBed.createComponent(Hospedeiro);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const teste = (id: string) => el.querySelector<HTMLButtonElement>(`[data-testid="${id}"] button`);
  const mudar = async (atual: number, podeAvancar = true) => {
    fixture.componentInstance.atual.set(atual);
    fixture.componentInstance.podeAvancar.set(podeAvancar);
    await fixture.whenStable();
  };
  const trilho = () => el.querySelector('[data-testid="passo-trilho"]')!.textContent?.trim();
  return { fixture, el, teste, mudar, trilho, eventos: fixture.componentInstance.eventos };
}

describe('PassoAPasso', () => {
  it('textoDoTrilho: "N de T · rótulo"', () => {
    expect(textoDoTrilho(['A', 'B'], 1)).toBe('2 de 2 · B');
  });

  it('o trilho mostra "N de T · rótulo" e projeta o conteúdo e o resumo', async () => {
    const t = await montar();
    expect(t.trilho()).toBe('1 de 3 · Cliente e produtos');
    expect(t.el.querySelector('.corpo')?.textContent).toBe('conteúdo do passo');
    expect(t.el.querySelector('.barra__resumo')?.textContent).toContain('R$ 10,00');

    await t.mudar(1);
    expect(t.trilho()).toBe('2 de 3 · Cascos');
    await t.mudar(2);
    expect(t.trilho()).toBe('3 de 3 · Pagamento');
  });

  it('Voltar não existe no 1º passo; no 2º, o toque emite voltar', async () => {
    const t = await montar();
    expect(t.teste('passo-voltar')).toBeNull();

    await t.mudar(1);
    // variante para fundo escuro (texto e borda claros sobre a barra)
    expect(t.teste('passo-voltar')!.classList).toContain('botao--claro');
    t.teste('passo-voltar')!.click();
    expect(t.eventos).toEqual(['voltar']);
  });

  it('Continuar emite avancar nos passos intermediários; só o último tem o botão final', async () => {
    const t = await montar();
    expect(t.teste('confirmar-venda')).toBeNull();
    t.teste('passo-continuar')!.click();

    await t.mudar(1);
    t.teste('passo-continuar')!.click();
    expect(t.eventos).toEqual(['avancar', 'avancar']);
  });

  it('no último passo o botão final mostra rotuloFinal e emite concluir', async () => {
    const t = await montar();
    await t.mudar(2);

    expect(t.teste('passo-continuar')).toBeNull();
    expect(t.teste('confirmar-venda')!.textContent).toContain('Confirmar venda');
    t.teste('confirmar-venda')!.click();
    expect(t.eventos).toEqual(['concluir']);
  });

  it('com podeAvancar falso o botão fica desabilitado e o toque não emite', async () => {
    const t = await montar();
    await t.mudar(0, false);
    expect(t.teste('passo-continuar')!.disabled).toBe(true);
    t.teste('passo-continuar')!.click();
    // o toque no próprio host também não passa
    t.el.querySelector<HTMLElement>('[data-testid="passo-continuar"]')!.click();

    await t.mudar(2, false);
    expect(t.teste('confirmar-venda')!.disabled).toBe(true);
    t.el.querySelector<HTMLElement>('[data-testid="confirmar-venda"]')!.click();

    expect(t.eventos).toEqual([]);
  });
});
