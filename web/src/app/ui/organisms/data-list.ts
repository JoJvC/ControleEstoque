import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  contentChild,
  input,
  output,
} from '@angular/core';

import { Button } from '../atoms/button';
import { Skeleton } from '../atoms/skeleton';
import { EmptyState } from '../molecules/empty-state';

export type DataListStatus = 'idle' | 'loading' | 'ok' | 'error';

/**
 * Lista de dados com skeleton, erro com retry, vazio e paginação "carregar mais".
 * O template do item vem por content projection:
 *   <ce-data-list [itens]="..."><ng-template let-item>…</ng-template></ce-data-list>
 */
@Component({
  selector: 'ce-data-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, Skeleton, EmptyState, Button],
  template: `
    @switch (status()) {
      @case ('error') {
        <ce-empty-state
          icone="alerta"
          titulo="Não foi possível carregar"
          [descricao]="erroDescricao()"
        >
          <ce-button variante="ghost" (click)="recarregar.emit()">Tentar novamente</ce-button>
        </ce-empty-state>
      }
      @case ('ok') {
        @if (itens().length === 0) {
          <ce-empty-state [titulo]="vazioTitulo()" [descricao]="vazioDescricao()">
            <ng-content select="[ce-vazio-acao]" />
          </ce-empty-state>
        } @else {
          <ul class="lista">
            @for (item of itens(); track $index) {
              <li>
                <ng-container *ngTemplateOutlet="itemTemplate(); context: { $implicit: item }" />
              </li>
            }
          </ul>
          @if (temMais()) {
            <div class="lista__mais">
              <ce-button variante="ghost" [block]="true" (click)="maisPagina.emit()">
                Carregar mais
              </ce-button>
            </div>
          }
        }
      }
      @default {
        <div class="lista" aria-busy="true">
          @for (i of [1, 2, 3, 4]; track i) {
            <ce-skeleton altura="56px" />
          }
        </div>
      }
    }
  `,
  styles: `
    .lista {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .lista__mais {
      padding-top: var(--ce-space-3);
    }
  `,
})
export class DataList<T> {
  readonly itens = input.required<readonly T[]>();
  readonly status = input<DataListStatus>('ok');
  readonly vazioTitulo = input('Nada por aqui');
  readonly vazioDescricao = input('');
  readonly erroDescricao = input('Verifique a conexão e tente novamente.');
  readonly temMais = input(false);

  readonly recarregar = output<void>();
  readonly maisPagina = output<void>();

  protected readonly itemTemplate = contentChild.required(TemplateRef<{ $implicit: T }>);
}
