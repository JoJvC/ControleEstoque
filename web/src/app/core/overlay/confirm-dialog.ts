import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Button } from '../../ui/atoms/button';
import { SheetShell } from '../../ui/organisms/sheet-shell';

export interface ConfirmDialogDados {
  readonly titulo: string;
  readonly mensagem: string;
  readonly confirmarLabel?: string;
  readonly cancelarLabel?: string;
  readonly perigo?: boolean;
}

@Component({
  selector: 'ce-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Button],
  template: `
    <ce-sheet-shell [titulo]="dados.titulo" (fechar)="ref.close(false)">
      <p class="mensagem">{{ dados.mensagem }}</p>
      <div class="acoes">
        <ce-button variante="ghost" [block]="true" (click)="ref.close(false)">
          {{ dados.cancelarLabel ?? 'Cancelar' }}
        </ce-button>
        <ce-button
          [variante]="dados.perigo ? 'danger' : 'primary'"
          [block]="true"
          (click)="ref.close(true)"
        >
          {{ dados.confirmarLabel ?? 'Confirmar' }}
        </ce-button>
      </div>
    </ce-sheet-shell>
  `,
  styles: `
    .mensagem {
      color: var(--ce-text-muted);
      padding-bottom: var(--ce-space-4);
    }

    .acoes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ce-space-3);
    }
  `,
})
export class ConfirmDialog {
  protected readonly dados = inject<ConfirmDialogDados>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<boolean>);
}
