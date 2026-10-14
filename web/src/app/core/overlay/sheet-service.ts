import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ConfirmDialog, ConfirmDialogDados } from './confirm-dialog';

/**
 * Abre componentes como bottom sheet (mobile) / dialog central (desktop).
 * Estilos globais dos painéis em styles.scss (.ce-sheet-panel).
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly dialog = inject(Dialog);

  abrir<R, D = unknown>(component: ComponentType<unknown>, dados?: D): DialogRef<R> {
    return this.dialog.open<R>(component, {
      data: dados,
      panelClass: 'ce-sheet-panel',
      backdropClass: 'ce-sheet-backdrop',
      maxWidth: '100vw',
    });
  }

  async confirmar(dados: ConfirmDialogDados): Promise<boolean> {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      data: dados,
      panelClass: 'ce-sheet-panel',
      backdropClass: 'ce-sheet-backdrop',
      maxWidth: '100vw',
    });
    return (await firstValueFrom(ref.closed)) ?? false;
  }
}
