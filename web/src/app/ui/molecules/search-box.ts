import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import { Icon } from '../atoms/icon';

const DEBOUNCE_MS = 300;

/** Busca com debounce de 300ms e botão de limpar. */
@Component({
  selector: 'ce-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <span class="busca">
      <ce-icon nome="buscar" [tamanho]="20" class="busca__icone" />
      <input
        class="busca__campo"
        type="text"
        [attr.aria-label]="rotulo()"
        [placeholder]="placeholder()"
        [value]="texto()"
        (input)="aoDigitar($event)"
      />
      @if (texto()) {
        <button type="button" class="busca__limpar" aria-label="Limpar busca" (click)="limpar()">
          <ce-icon nome="fechar" [tamanho]="18" />
        </button>
      }
    </span>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .busca {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      min-height: var(--ce-touch-target);
      padding-inline: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
      color: var(--ce-text-muted);

      &:focus-within {
        outline: 2px solid var(--ce-focus-ring);
        outline-offset: 1px;
      }
    }

    .busca__campo {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      font-size: var(--ce-font-md);
      color: var(--ce-text);
    }

    .busca__limpar {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ce-text-muted);
    }
  `,
})
export class SearchBox {
  readonly placeholder = input('Buscar…');
  readonly rotulo = input<string | null>(null);
  /** Valor de fora (ex.: termo guardado na store): a caixa o espelha quando ele muda. */
  readonly valor = input('');
  readonly buscar = output<string>();

  // O termo emitido é aparado: se ele ecoa de volta igual ao que está digitado (ex.: 'ana '), o campo não muda.
  protected readonly texto = linkedSignal<string, string>({
    source: () => this.valor(),
    computation: (valor, anterior) => (anterior?.value.trim() === valor ? anterior.value : valor),
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelarTimer());
  }

  protected aoDigitar(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.texto.set(valor);
    this.cancelarTimer();
    this.timer = setTimeout(() => this.buscar.emit(valor.trim()), DEBOUNCE_MS);
  }

  protected limpar(): void {
    this.texto.set('');
    this.cancelarTimer();
    this.buscar.emit('');
  }

  private cancelarTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
