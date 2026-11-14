import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ColorSchemeService } from '../../core/platform/color-scheme-service';
import { TemaEscolha, TemaSlug, ThemeStore, resolverTema } from '../../core/theme/theme-store';

interface Opcao {
  readonly valor: TemaEscolha;
  readonly nome: string;
  readonly descricao?: string;
}

const OPCOES: readonly Opcao[] = [
  {
    valor: 'automatico',
    nome: 'Automático',
    descricao: 'Oceano no modo claro, Noite no modo escuro do aparelho',
  },
  { valor: 'oceano', nome: 'Oceano' },
  { valor: 'uva', nome: 'Uva' },
  { valor: 'carvao', nome: 'Carvão' },
  { valor: 'noite', nome: 'Noite' },
];

@Component({
  selector: 'ce-aparencia-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aparencia-page.html',
  styleUrl: './aparencia-page.scss',
})
export class AparenciaPage {
  private readonly theme = inject(ThemeStore);
  private readonly colorScheme = inject(ColorSchemeService);

  protected readonly opcoes = OPCOES;
  protected readonly escolha = this.theme.escolha;

  /** Slug mostrado na miniatura de cada opção; o Automático mostra o que vale agora. */
  protected readonly previas = computed<Record<TemaEscolha, TemaSlug>>(() => {
    const automatico =
      this.theme.escolha() === 'automatico'
        ? this.theme.aplicado()
        : resolverTema('automatico', this.colorScheme.prefersDark());
    return { automatico, oceano: 'oceano', uva: 'uva', carvao: 'carvao', noite: 'noite' };
  });

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
