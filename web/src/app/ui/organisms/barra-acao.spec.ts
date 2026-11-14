import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Button } from '../atoms/button';
import { BarraAcao } from './barra-acao';

@Component({
  imports: [BarraAcao, Button],
  template: `
    <ce-barra-acao rotulo="Ações da venda">
      <ce-button (click)="cancelar()">Cancelar</ce-button>
      <ce-button (click)="avancar()">Avançar</ce-button>
    </ce-barra-acao>
  `,
})
class Host {
  avancados = 0;
  cancelados = 0;
  avancar() {
    this.avancados++;
  }
  cancelar() {
    this.cancelados++;
  }
}

describe('BarraAcao', () => {
  it('projeta os botões numa região rotulada e o clique chega ao host', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const regiao = el.querySelector('[role="region"]');
    expect(regiao?.getAttribute('aria-label')).toBe('Ações da venda');
    const botoes = Array.from(regiao!.querySelectorAll('button'));
    expect(botoes.map((b) => b.textContent?.trim())).toEqual(['Cancelar', 'Avançar']);

    botoes[1].click();
    expect(fixture.componentInstance.avancados).toBe(1);
    expect(fixture.componentInstance.cancelados).toBe(0);
  });
});
