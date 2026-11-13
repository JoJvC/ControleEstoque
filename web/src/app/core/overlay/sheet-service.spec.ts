import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SheetShell } from '../../ui/organisms/sheet-shell';
import { SheetService } from './sheet-service';

@Component({
  imports: [SheetShell],
  template: `
    <ce-sheet-shell titulo="Lançar despesa" (fechar)="ref.close()">
      <input class="campo" />
    </ce-sheet-shell>
  `,
})
class SheetDeTeste {
  protected readonly ref = inject(DialogRef);
}

@Component({ template: `<button type="button" id="abre">abrir</button>` })
class Host {}

async function montar() {
  await TestBed.configureTestingModule({ imports: [Host, SheetDeTeste] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const gatilho = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLElement;
  document.body.appendChild(fixture.nativeElement);
  gatilho.focus();
  return { fixture, gatilho, servico: TestBed.inject(SheetService) };
}

const aberto = () => document.querySelector('.cdk-dialog-container') as HTMLElement | null;

async function estabilizar(): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, 0));
}

function escape(): void {
  const evento = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true });
  (aberto() ?? document.body).dispatchEvent(evento);
}

describe('SheetService (foco e nome dos diálogos)', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.replaceChildren());
    document.body.replaceChildren();
  });

  it('sheet: foco entra no contêiner, nome vem do título, Escape fecha e devolve o foco', async () => {
    const { fixture, gatilho, servico } = await montar();
    const ref = servico.abrir<void>(SheetDeTeste);
    let fechou = false;
    ref.closed.subscribe(() => (fechou = true));
    fixture.detectChanges();
    await estabilizar();

    const contêiner = aberto() as HTMLElement;
    expect(contêiner.getAttribute('role')).toBe('dialog');
    expect(contêiner.contains(document.activeElement)).toBe(true);
    const titulo = document.getElementById(contêiner.getAttribute('aria-labelledby') as string);
    expect(titulo?.textContent?.trim()).toBe('Lançar despesa');

    escape();
    await estabilizar();

    expect(fechou).toBe(true);
    expect(aberto()).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it('sheet: clique em Fechar fecha e devolve o foco ao botão que abriu', async () => {
    const { fixture, gatilho, servico } = await montar();
    const ref = servico.abrir<void>(SheetDeTeste);
    let fechou = false;
    ref.closed.subscribe(() => (fechou = true));
    fixture.detectChanges();
    await estabilizar();

    (document.querySelector('.sheet__fechar') as HTMLButtonElement).click();
    await estabilizar();

    expect(fechou).toBe(true);
    expect(document.activeElement).toBe(gatilho);
  });

  it('confirmar: foco no diálogo, nome = título, Escape resolve false e devolve o foco', async () => {
    const { fixture, gatilho, servico } = await montar();
    const resultado = servico.confirmar({ titulo: 'Excluir cliente', mensagem: 'Certeza?' });
    fixture.detectChanges();
    await estabilizar();

    const contêiner = aberto() as HTMLElement;
    expect(['dialog', 'alertdialog']).toContain(contêiner.getAttribute('role'));
    expect(contêiner.contains(document.activeElement)).toBe(true);
    const titulo = document.getElementById(contêiner.getAttribute('aria-labelledby') as string);
    expect(titulo?.textContent?.trim()).toBe('Excluir cliente');

    escape();

    expect(await resultado).toBe(false);
    await estabilizar();
    expect(document.activeElement).toBe(gatilho);
  });

  it('dois diálogos empilhados têm títulos com ids distintos', async () => {
    const { fixture, servico } = await montar();
    servico.abrir<void>(SheetDeTeste);
    void servico.confirmar({ titulo: 'Outro', mensagem: 'm' });
    fixture.detectChanges();
    await estabilizar();

    const ids = Array.from(document.querySelectorAll('.cdk-dialog-container')).map((c) =>
      c.getAttribute('aria-labelledby'),
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
