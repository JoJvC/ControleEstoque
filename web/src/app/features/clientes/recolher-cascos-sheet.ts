import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CascoClientePorTipo, DevolucaoCascosResponse } from '../../core/api/models/clientes';
import { TipoCascoResponse } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { rotuloSaldoCasco } from '../vendas/cascos-por-tipo';
import { corpoDevolucao, linhasRecolher } from './cascos-cliente';
import { ClientesStore } from './clientes-store';

export interface RecolherCascosSheetDados {
  readonly clienteId: string;
  readonly tipos: readonly TipoCascoResponse[];
  readonly cascosPorTipo: readonly CascoClientePorTipo[];
}

/** Resultado: a resposta do POST, ou undefined (cancelou). */
export type RecolherCascosSheetResultado = DevolucaoCascosResponse;

@Component({
  selector: 'ce-recolher-cascos-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SheetShell, Button],
  template: `
    <ce-sheet-shell titulo="Recolher cascos" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <ul class="linhas">
          @for (linha of linhas; track linha.tipoCascoId) {
            <li class="linha">
              <div class="linha__texto">
                <strong>{{ linha.nome }}</strong>
                <span class="linha__saldo">
                  {{
                    linha.saldo < 0
                      ? rotuloSaldoCasco(linha.saldo) + ' do cliente'
                      : 'Com ele: ' + linha.saldo
                  }}
                </span>
              </div>
              <div class="contador" role="group" [attr.aria-label]="'Voltaram agora ' + linha.nome">
                <button
                  type="button"
                  class="contador__botao"
                  [attr.aria-label]="'Diminuir ' + linha.nome"
                  [disabled]="contador(linha.tipoCascoId) <= 0"
                  (click)="mudar(linha.tipoCascoId, contador(linha.tipoCascoId) - 1)"
                >
                  −
                </button>
                <input
                  class="contador__campo"
                  type="text"
                  inputmode="numeric"
                  [attr.aria-label]="'Voltaram agora ' + linha.nome"
                  [value]="contador(linha.tipoCascoId)"
                  (input)="digitar(linha.tipoCascoId, $any($event.target).value)"
                  (blur)="$any($event.target).value = contador(linha.tipoCascoId)"
                />
                <button
                  type="button"
                  class="contador__botao"
                  [attr.aria-label]="'Aumentar ' + linha.nome"
                  (click)="mudar(linha.tipoCascoId, contador(linha.tipoCascoId) + 1)"
                >
                  +
                </button>
              </div>
            </li>
          }
        </ul>
        <p class="legenda">voltaram agora</p>

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true" [disabled]="!valido()" [loading]="enviando()">
          Confirmar
        </ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .linhas {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .linha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-3);
    }

    .linha__texto {
      display: flex;
      flex-direction: column;
    }

    .linha__saldo,
    .legenda {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .contador {
      display: inline-flex;
      align-items: stretch;
      border: 1px solid var(--ce-borda-campo);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
      overflow: hidden;
    }

    .contador__botao {
      min-width: var(--ce-touch-target);
      min-height: var(--ce-touch-target);
      color: var(--ce-primary);
      font-size: var(--ce-font-lg);
      cursor: pointer;

      &:disabled {
        color: var(--ce-text-muted);
        opacity: 0.5;
        cursor: default;
      }
    }

    .contador__campo {
      width: 56px;
      border: none;
      outline: none;
      background: transparent;
      text-align: center;
      font-size: var(--ce-font-lg);
      font-weight: 600;
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class RecolherCascosSheet {
  protected readonly ref = inject(DialogRef<RecolherCascosSheetResultado>);
  private readonly dados = inject<RecolherCascosSheetDados>(DIALOG_DATA);
  private readonly store = inject(ClientesStore);

  protected readonly rotuloSaldoCasco = rotuloSaldoCasco;
  protected readonly linhas = linhasRecolher(this.dados.tipos, this.dados.cascosPorTipo);
  private readonly contadores = signal<Record<string, number>>({});

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly valido = computed(
    () => !this.enviando() && corpoDevolucao(this.contadores()).length > 0,
  );

  protected contador(tipoCascoId: string): number {
    return this.contadores()[tipoCascoId] ?? 0;
  }

  protected mudar(tipoCascoId: string, valor: number): void {
    this.contadores.update((c) => ({ ...c, [tipoCascoId]: Math.max(0, valor) }));
  }

  /** Campo inteiro ≥ 0: tira o que não é dígito; vazio vale 0. */
  protected digitar(tipoCascoId: string, texto: string): void {
    this.mudar(tipoCascoId, Number(texto.replace(/\D/g, '')) || 0);
  }

  protected async confirmar(): Promise<void> {
    if (!this.valido()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.store.devolverCascos(
        this.dados.clienteId,
        corpoDevolucao(this.contadores()),
      );
      this.ref.close(resposta);
    } catch (e) {
      // 4xx ficam inline; rede/5xx já viraram toast.
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.status >= 400 && e.status < 500) {
        this.erro.set(e.userMessage);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
