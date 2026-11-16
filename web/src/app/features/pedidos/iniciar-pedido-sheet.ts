import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FuncionarioResponse } from '../../core/api/models/rh';
import { PedidoResponse } from '../../core/api/models/pedidos';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { SeletorFuncionarios } from '../rh/seletor-funcionarios';
import { selecaoInicial } from './pedido-form';
import { PedidosStore } from './pedidos-store';

export interface IniciarPedidoDados {
  readonly pedido: PedidoResponse;
}

/** Fecha com o pedido iniciado, ou com `{ erro }` quando a situação do pedido mudou (a página recarrega). */
export type IniciarPedidoResultado = PedidoResponse | { readonly erro: string };

/** Início do pedido: a lista marcada aqui substitui a do cadastro. */
@Component({
  selector: 'ce-iniciar-pedido-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Button, SeletorFuncionarios],
  template: `
    <ce-sheet-shell titulo="Iniciar pedido" (fechar)="ref.close()">
      <p class="dica">Quem vai fazer esta entrega? Escolha pelo menos um funcionário.</p>
      <ce-seletor-funcionarios [(selecionados)]="selecionados" (ativosCarregados)="podar($event)" />

      @if (erro(); as mensagem) {
        <p class="erro" role="alert">{{ mensagem }}</p>
      }

      <ce-button
        [block]="true"
        [disabled]="selecionados().size === 0"
        [loading]="salvando()"
        (click)="confirmar()"
      >
        Confirmar início
      </ce-button>
    </ce-sheet-shell>
  `,
  styles: `
    :host {
      display: block;
    }

    .dica {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
      margin-bottom: var(--ce-space-2);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
      margin-block: var(--ce-space-2);
    }
  `,
})
export class IniciarPedidoSheet {
  protected readonly ref = inject(DialogRef<IniciarPedidoResultado>);
  private readonly dados = inject<IniciarPedidoDados>(DIALOG_DATA);
  private readonly store = inject(PedidosStore);

  protected readonly selecionados = signal<ReadonlySet<string>>(new Set());
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  /** Pré-marca os do cadastro que ainda estão ativos. */
  protected podar(ativos: readonly FuncionarioResponse[]): void {
    this.selecionados.set(selecaoInicial(this.dados.pedido, ativos));
  }

  protected async confirmar(): Promise<void> {
    if (this.selecionados().size === 0) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    try {
      this.ref.close(await this.store.iniciar(this.dados.pedido.id, [...this.selecionados()]));
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === 'PEDIDO_STATUS_INVALIDO') {
        this.ref.close({ erro: e.userMessage });
      } else {
        this.erro.set(e instanceof ApiError ? e.userMessage : 'Erro ao iniciar o pedido.');
      }
    } finally {
      this.salvando.set(false);
    }
  }
}
