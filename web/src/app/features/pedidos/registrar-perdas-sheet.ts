import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { EstoqueApi } from '../../core/api/estoque-api';
import { ProdutoResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { PedidoResponse } from '../../core/api/models/pedidos';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PassoPerdas } from './passo-perdas';
import { MENSAGEM_SEM_RESPONSAVEL, Ocorrencia, perdasProntas } from './perdas-form';
import { PedidosStore } from './pedidos-store';

export interface RegistrarPerdasDados {
  readonly pedido: PedidoResponse;
  /** As que a conclusão não conseguiu gravar (ou lista vazia). */
  readonly ocorrencias: readonly Ocorrencia[];
}

/** Fecha com o pedido atualizado, ou com `{ erro }` quando a situação do pedido mudou (a página recarrega). */
export type RegistrarPerdasResultado = PedidoResponse | { readonly erro: string };

/** Perdas de um pedido CONCLUIDO; cada confirmação soma ocorrências (o servidor não barra duplicata). */
@Component({
  selector: 'ce-registrar-perdas-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Button, PassoPerdas],
  template: `
    <ce-sheet-shell titulo="Registrar perdas" (fechar)="ref.close()">
      <ce-passo-perdas
        [(ocorrencias)]="ocorrencias"
        [funcionarios]="dados.pedido.funcionarios"
        [produtos]="produtos()"
        [tiposCasco]="tiposCasco()"
      />

      @if (erro(); as mensagem) {
        <p class="erro" role="alert">{{ mensagem }}</p>
      }

      <ce-button
        [block]="true"
        [disabled]="!podeConfirmar()"
        [loading]="salvando()"
        (click)="confirmar()"
      >
        Registrar perdas
      </ce-button>
    </ce-sheet-shell>
  `,
  styles: `
    :host {
      display: block;
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
      margin-block: var(--ce-space-2);
    }

    ce-button {
      display: block;
      margin-top: var(--ce-space-3);
    }
  `,
})
export class RegistrarPerdasSheet {
  protected readonly ref = inject(DialogRef<RegistrarPerdasResultado>);
  protected readonly dados = inject<RegistrarPerdasDados>(DIALOG_DATA);
  private readonly store = inject(PedidosStore);
  private readonly estoqueApi = inject(EstoqueApi);

  protected readonly ocorrencias = signal<readonly Ocorrencia[]>(this.dados.ocorrencias);
  protected readonly produtos = signal<readonly ProdutoResponse[]>([]);
  protected readonly tiposCasco = signal<readonly TipoCascoResponse[]>([]);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly podeConfirmar = computed(
    () =>
      this.ocorrencias().length > 0 &&
      perdasProntas(this.ocorrencias(), this.dados.pedido.funcionarios.length),
  );

  constructor() {
    this.estoqueApi.listarProdutos().subscribe({ next: (lista) => this.produtos.set(lista) });
    this.estoqueApi.listarTiposCasco().subscribe({ next: (lista) => this.tiposCasco.set(lista) });
  }

  protected async confirmar(): Promise<void> {
    if (!this.podeConfirmar() || this.salvando()) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    try {
      this.ref.close(await this.store.registrarPerdas(this.dados.pedido.id, this.ocorrencias()));
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === 'PEDIDO_STATUS_INVALIDO') {
        this.ref.close({ erro: e.userMessage });
      } else if (e instanceof ApiError && e.code === 'RESPONSAVEL_OBRIGATORIO') {
        this.erro.set(MENSAGEM_SEM_RESPONSAVEL);
      } else {
        this.erro.set(e instanceof ApiError ? e.userMessage : 'Erro ao registrar as perdas.');
      }
    } finally {
      this.salvando.set(false);
    }
  }
}
