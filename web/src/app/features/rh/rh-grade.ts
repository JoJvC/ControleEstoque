import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Grade mestre-detalhe do desktop (≥960px): h1 + conteúdo do mestre em 440px, detalhe ao lado. */
@Component({
  selector: 'ce-rh-grade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mestre">
      <h1 class="titulo">Funcionários e cargos</h1>
      <ng-content select="[mestre]" />
    </div>
    <div class="detalhe"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 440px minmax(0, 1fr);
      min-height: 100%;
    }

    .mestre {
      padding: 20px 16px;
      border-right: 1px solid var(--ce-border);
      background: var(--ce-surface);
    }

    .titulo {
      margin: 0 0 12px;
      font-size: 22px;
    }

    .detalhe {
      min-width: 0;
    }
  `,
})
export class RhGrade {}
