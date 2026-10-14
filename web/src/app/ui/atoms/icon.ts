import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Sprite SVG próprio (24×24, stroke currentColor) — sem font-icons (plano §1).
 * Novos ícones: adicionar o(s) path(s) ao registro.
 */
const ICONES = {
  home: ['M3 10.5 12 4l9 6.5', 'M5 9.5V20h14V9.5'],
  gota: ['M12 3c3.5 4.2 6 7.4 6 10.2A6 6 0 0 1 6 13.2C6 10.4 8.5 7.2 12 3z'],
  usuario: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5'],
  dinheiro: [
    'M3 6h18v12H3z',
    'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'M6 9h.01M18 15h.01',
  ],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  mais: ['M12 5v14', 'M5 12h14'],
  menos: ['M5 12h14'],
  fechar: ['M6 6l12 12', 'M18 6 6 18'],
  confirmar: ['M5 13l4 4L19 7'],
  buscar: ['M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M20 20l-4-4'],
  'seta-direita': ['M9 6l6 6-6 6'],
  'seta-esquerda': ['M15 6l-6 6 6 6'],
  alerta: ['M12 4 2 20h20L12 4z', 'M12 10v5', 'M12 17.5v.01'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v6', 'M12 8v.01'],
  lixeira: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  editar: ['M4 20l4-1L19 8l-3-3L5 16l-1 4z'],
  camera: ['M3 8h4l2-3h6l2 3h4v12H3z', 'M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
  cupom: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3z', 'M9 8h6', 'M9 12h6'],
  caixa: ['M3 8l9-5 9 5v8l-9 5-9-5V8z', 'M3 8l9 5 9-5', 'M12 13v8'],
  grafico: ['M5 20v-6', 'M11 20V8', 'M17 20V10', 'M3 20h18'],
  atualizar: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v4h-4'],
  sair: ['M9 4H5v16h4', 'M15 8l4 4-4 4', 'M19 12h-9'],
  carrinho: ['M3 4h2l2.5 11h10L21 8H7', 'M9 20h.01', 'M17 20h.01'],
  galao: ['M9 3h6v3l2 4v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V10l2-4V3z', 'M9 14h6'],
} as const;

export type IconeNome = keyof typeof ICONES;

@Component({
  selector: 'ce-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="tamanho()"
      [attr.height]="tamanho()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @for (path of paths(); track $index) {
        <path [attr.d]="path" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
  `,
})
export class Icon {
  readonly nome = input.required<IconeNome>();
  readonly tamanho = input(24);

  protected readonly paths = computed<readonly string[]>(() => ICONES[this.nome()]);
}
