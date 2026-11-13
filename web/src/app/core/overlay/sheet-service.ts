import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SHEET_TITULO_ID } from '../../ui/organisms/sheet-shell';
import { ConfirmDialog, ConfirmDialogDados } from './confirm-dialog';

let proximoId = 0;

/**
 * Abre componentes como bottom sheet (mobile) / dialog central (desktop).
 * Estilos globais dos painéis em styles.scss (.ce-sheet-panel).
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly dialog = inject(Dialog);

  abrir<R, D = unknown>(component: ComponentType<unknown>, dados?: D): DialogRef<R> {
    return this.dialog.open<R>(component, this.config<R>(dados));
  }

  async confirmar(dados: ConfirmDialogDados): Promise<boolean> {
    const ref = this.dialog.open<boolean>(ConfirmDialog, this.config<boolean>(dados));
    return (await firstValueFrom(ref.closed)) ?? false;
  }

  /** Foco entra no primeiro focável, volta a quem abriu, e o título (sheet-shell) nomeia o diálogo. */
  private config<R>(dados: unknown): DialogConfig<unknown, DialogRef<R>> {
    const tituloId = `ce-sheet-titulo-${++proximoId}`;
    return {
      data: dados,
      panelClass: 'ce-sheet-panel',
      backdropClass: 'ce-sheet-backdrop',
      maxWidth: '100vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: tituloId,
      providers: [{ provide: SHEET_TITULO_ID, useValue: tituloId }],
    };
  }
}
