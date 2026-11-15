import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';

import { TemaEscolha, ThemeStore } from '../../core/theme/theme-store';
import { AppHeader } from '../../ui/organisms/app-header';

interface Opcao {
  readonly valor: TemaEscolha;
  readonly nome: string;
  readonly descricao?: string;
}

const OPCOES: readonly Opcao[] = [
  {
    valor: 'automatico',
    nome: 'Automático',
    descricao: 'Oceano; Noite se o aparelho estiver em modo escuro',
  },
  { valor: 'oceano', nome: 'Oceano' },
  { valor: 'uva', nome: 'Uva' },
  { valor: 'carvao', nome: 'Carvão' },
  { valor: 'noite', nome: 'Noite' },
];

@Component({
  selector: 'ce-aparencia-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, NgTemplateOutlet],
  templateUrl: './aparencia-page.html',
  styleUrl: './aparencia-page.scss',
})
export class AparenciaPage {
  private readonly theme = inject(ThemeStore);
  private readonly router = inject(Router);

  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 960px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  protected readonly opcoes = OPCOES;
  protected readonly escolha = this.theme.escolha;

  protected voltar(): void {
    void this.router.navigate(['/mais']);
  }

  protected escolher(valor: TemaEscolha): void {
    this.theme.escolher(valor);
  }

  /** Padrão WAI-ARIA de radio: a seta move o foco e escolhe; Home/End vão às pontas. */
  protected teclado(event: KeyboardEvent, indice: number): void {
    const total = OPCOES.length;
    let destino: number;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        destino = (indice + 1) % total;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        destino = (indice - 1 + total) % total;
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = total - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.theme.escolher(OPCOES[destino].valor);
    const grupo = (event.currentTarget as HTMLElement).parentElement;
    (grupo?.children[destino] as HTMLElement | undefined)?.focus();
  }
}
