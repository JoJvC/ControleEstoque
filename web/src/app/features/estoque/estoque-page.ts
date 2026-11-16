import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ProdutoMarcaResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { PermissionService } from '../../core/permissions/permission-service';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { iconeDoProduto } from '../../ui/atoms/icone-do-produto';
import { Skeleton } from '../../ui/atoms/skeleton';
import { AcoesSecundarias } from '../../ui/molecules/acoes-secundarias';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { AjusteSheet, AjusteSheetDados } from './ajuste-sheet';
import { BaixaCascoSheet } from './baixa-casco-sheet';
import {
  agruparEstoque,
  cascosComSaldo,
  maiorEstoque,
  nomeComTamanho,
  proporcao,
} from './estoque-grupos';
import { EstoqueStore } from './estoque-store';

@Component({
  selector: 'ce-estoque-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    CePermissao,
    AcoesSecundarias,
    AppHeader,
    Button,
    EmptyState,
    Icon,
    Skeleton,
  ],
  template: `
    <ce-app-header titulo="Estoque">
      <ce-acoes-secundarias>
        <ce-button *cePermissao="'estoque.editar'" variante="ghost" (click)="baixaCasco()"
          >Baixa de casco</ce-button
        >
        <ce-button *cePermissao="'estoque.custos'" variante="ghost" (click)="custosPendentes()"
          >Custos pendentes</ce-button
        >
      </ce-acoes-secundarias>
      <ce-button *cePermissao="'estoque.editar'" (click)="abastecer()">Chegou mercadoria</ce-button>
    </ce-app-header>

    <div class="conteudo">
      @switch (store.status()) {
        @case ('error') {
          <ce-empty-state
            icone="alerta"
            titulo="Não foi possível carregar"
            descricao="Verifique a conexão e tente novamente."
          >
            <ce-button variante="ghost" (click)="store.carregar()">Tentar novamente</ce-button>
          </ce-empty-state>
        }
        @case ('ok') {
          @if (store.produtos().length === 0 && vasilhames().length === 0) {
            <ce-empty-state
              titulo="Estoque vazio"
              descricao="Registre um abastecimento para começar."
            />
          } @else {
            <p class="resumo" [class.resumo--alerta]="abaixoMinimo() > 0">
              {{ resumoMinimo() }}
            </p>
            <div class="grade">
              @for (secao of secoes(); track secao.id) {
                <section class="secao" [attr.aria-labelledby]="'sec-' + secao.id">
                  <h2 [id]="'sec-' + secao.id">{{ secao.titulo }}</h2>
                  @for (grupo of secao.grupos; track grupo.categoria) {
                    <h3>{{ grupo.categoria }}</h3>
                    <ul class="produtos">
                      @for (produto of grupo.produtos; track produto.id) {
                        <ng-container
                          [ngTemplateOutlet]="linhaProduto"
                          [ngTemplateOutletContext]="{ produto, maior: maiorDe(grupo.produtos) }"
                        />
                      }
                    </ul>
                  }
                </section>
              }
              <section class="secao secao--larga" aria-labelledby="sec-vasilhames">
                <h2 id="sec-vasilhames">Vasilhames</h2>
                @if (vasilhames().length === 0) {
                  <ce-empty-state icone="galao" titulo="Nenhum vasilhame em estoque" />
                } @else {
                  <ul class="vasilhames">
                    @for (casco of vasilhames(); track casco.tipoCascoId) {
                      <li class="vasilhame">
                        <ce-icon nome="galao" [tamanho]="22" />
                        <span class="vasilhame__nome">{{ casco.nome }}</span>
                        <span class="vasilhame__saldo">Vazios: {{ casco.vazios }}</span>
                        <span class="vasilhame__saldo">Sucata: {{ casco.sucata }}</span>
                      </li>
                    }
                  </ul>
                }
              </section>
            </div>
          }
        }
        @default {
          <div aria-busy="true">
            <ce-skeleton altura="96px" />
          </div>
        }
      }
    </div>

    <ng-template #linhaProduto let-produto="produto" let-maior="maior">
      <li class="produto" [attr.data-abaixo-minimo]="abaixoDe(produto) ? '' : null">
        <button
          type="button"
          class="produto__cabecalho alvo"
          [attr.aria-expanded]="aberto(produto.id)"
          (click)="alternar(produto.id)"
        >
          <ce-icon [nome]="iconeDe(produto)" [tamanho]="24" />
          <span class="produto__nome">
            {{ nomeDe(produto) }}
          </span>
          @if (abaixoDe(produto)) {
            <span class="produto__alerta"
              ><ce-icon nome="alerta" [tamanho]="16" /> abaixo do mínimo</span
            >
          }
          <span class="produto__geral">{{ produto.estoqueGeral }}</span>
          <span class="produto__barra" aria-hidden="true">
            <span
              class="produto__nivel"
              [style.width.%]="100 * proporcao(produto.estoqueGeral, maior)"
            ></span>
          </span>
        </button>
        @if (aberto(produto.id)) {
          <ul class="marcas">
            @for (marca of produto.marcas; track marca.id) {
              <li>
                <button
                  type="button"
                  class="marca alvo"
                  [attr.data-abaixo-minimo]="marca.abaixoMinimo ? '' : null"
                  (click)="ajustar(produto, marca)"
                >
                  <span class="marca__nome">{{ rotuloDe(marca) }}</span>
                  <span class="marca__qtd">{{ marca.quantidade }}</span>
                  <span class="marca__minimo">mín. {{ marca.estoqueMinimo }}</span>
                  @if (marca.abaixoMinimo) {
                    <span class="marca__alerta">abaixo do mínimo</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
  styles: `
    @use 'mixins';

    .conteudo {
      padding: var(--ce-space-4);
    }

    .grade {
      display: grid;
      gap: var(--ce-space-5);

      @include mixins.from-desktop {
        grid-template-columns: 1fr 1fr;
      }
    }

    .secao--larga {
      @include mixins.from-desktop {
        grid-column: 1 / -1;
      }
    }

    .resumo {
      margin-bottom: var(--ce-space-3);
      color: var(--ce-text-muted);
    }

    .resumo--alerta {
      color: var(--ce-danger);
      font-weight: 600;
    }

    h2 {
      font-size: var(--ce-font-lg);
      margin-bottom: var(--ce-space-3);
    }

    h3 {
      font-size: var(--ce-font-md);
      color: var(--ce-text-muted);
      margin: var(--ce-space-3) 0 var(--ce-space-2);
    }

    .produtos,
    .marcas,
    .vasilhames {
      display: grid;
      gap: var(--ce-space-2);
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .produto {
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
    }

    .alvo.produto__cabecalho {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--ce-space-1) var(--ce-space-3);
      width: 100%;
      padding: var(--ce-space-2) var(--ce-space-3);
      text-align: left;
    }

    .produto__nome {
      font-weight: 600;
    }

    .produto__geral {
      font-size: var(--ce-font-lg);
      font-weight: 700;
    }

    .produto__alerta,
    .marca__alerta {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-1);
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    .produto__barra {
      grid-column: 1 / -1;
      height: 6px;
      border-radius: 3px;
      background: var(--ce-surface-muted);
      overflow: hidden;
    }

    .produto__nivel {
      display: block;
      height: 100%;
      background: var(--ce-primary);
    }

    .marcas {
      padding: 0 var(--ce-space-3) var(--ce-space-2);
    }

    .alvo.marca {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      width: 100%;
      text-align: left;
    }

    .marca__nome {
      flex: 1;
    }

    .marca__qtd {
      font-weight: 600;
    }

    .marca__minimo {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .vasilhame {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      padding: var(--ce-space-2) var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-controle);
    }

    .vasilhame__nome {
      flex: 1;
      font-weight: 600;
    }

    .alvo {
      @include mixins.touch-target;

      display: block;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
  `,
})
export class EstoquePage {
  protected readonly store = inject(EstoqueStore);
  private readonly sheet = inject(SheetService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);

  constructor() {
    this.store.carregar();
  }

  protected readonly grupos = computed(() => agruparEstoque(this.store.produtos()));
  protected readonly vasilhames = computed(() => cascosComSaldo(this.store.cascos()));
  /** Conta as marcas que o servidor marcou; o front não compara quantidade com mínimo. */
  protected readonly abaixoMinimo = computed(
    () =>
      this.store
        .produtos()
        .flatMap((p) => p.marcas)
        .filter((m) => m.abaixoMinimo).length,
  );
  protected readonly resumoMinimo = computed(() => {
    const n = this.abaixoMinimo();
    return n === 0
      ? 'Tudo acima do mínimo'
      : `${n} ${n === 1 ? 'item abaixo' : 'itens abaixo'} do mínimo`;
  });
  protected readonly secoes = computed(() => {
    const g = this.grupos();
    return [
      { id: 'retornaveis', titulo: 'Retornáveis', grupos: g.retornaveis },
      { id: 'descartaveis', titulo: 'Descartáveis', grupos: g.descartaveis },
    ].filter((s) => s.grupos.length > 0);
  });
  private readonly abertos = signal<ReadonlySet<string>>(new Set());

  protected readonly proporcao = proporcao;
  protected readonly iconeDe = iconeDoProduto;
  protected readonly rotuloDe = (m: ProdutoMarcaResponse): string => rotuloDaMarca(m.marcaNome);

  protected nomeDe(produto: ProdutoResponse): string {
    return nomeComTamanho(produto.nome, produto.tamanho);
  }

  protected maiorDe(produtos: readonly ProdutoResponse[]): number {
    return maiorEstoque(produtos);
  }

  protected abaixoDe(produto: ProdutoResponse): boolean {
    return produto.marcas.some((m) => m.abaixoMinimo);
  }

  protected aberto(id: string): boolean {
    return this.abertos().has(id);
  }

  protected alternar(id: string): void {
    this.abertos.update((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }

  protected async ajustar(produto: ProdutoResponse, marca: ProdutoMarcaResponse): Promise<void> {
    // a linha é o alvo do clique: some só a ação, não o item de consulta
    if (!this.permissions.has('estoque.editar')) return;
    const ref = this.sheet.abrir<boolean, AjusteSheetDados>(AjusteSheet, { produto, marca });
    if (await firstValueFrom(ref.closed)) {
      this.toast.success('Ajuste registrado!');
    }
  }

  protected async baixaCasco(): Promise<void> {
    const ref = this.sheet.abrir<boolean>(BaixaCascoSheet);
    if (await firstValueFrom(ref.closed)) {
      this.toast.success('Baixa registrada — os cascos entraram no estoque de sucata.');
    }
  }

  protected abastecer(): void {
    this.router.navigateByUrl('/estoque/abastecimento');
  }

  protected custosPendentes(): void {
    this.router.navigateByUrl('/estoque/abastecimento/pendentes');
  }
}
