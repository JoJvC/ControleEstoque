import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { PermissionService } from '../../core/permissions/permission-service';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Chip, ChipTom } from '../../ui/atoms/chip';
import { Icon, IconeNome } from '../../ui/atoms/icon';
import { iconeDoProduto } from '../../ui/atoms/icone-do-produto';
import { Skeleton } from '../../ui/atoms/skeleton';
import { BarraEstoque } from '../../ui/molecules/barra-estoque';
import { EmptyState } from '../../ui/molecules/empty-state';
import { GalaoNivel } from '../../ui/molecules/galao-nivel';
import { AppHeader } from '../../ui/organisms/app-header';
import { AjusteSheet, AjusteSheetDados } from './ajuste-sheet';
import { BaixaCascoSheet } from './baixa-casco-sheet';
import { agruparEstoque, maiorEstoque } from './estoque-grupos';
import { EstoqueStore } from './estoque-store';

@Component({
  selector: 'ce-estoque-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CePermissao,
    AppHeader,
    Button,
    Chip,
    EmptyState,
    Icon,
    Skeleton,
    GalaoNivel,
    BarraEstoque,
  ],
  template: `
    <ce-app-header
      titulo="Estoque"
      [onda]="true"
      [mostrarVoltar]="true"
      (voltar)="voltarParaMais()"
    />

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
          @if (store.itens().length === 0) {
            <ce-empty-state
              titulo="Estoque vazio"
              descricao="Registre um abastecimento para começar."
            />
          } @else {
            <div class="grade">
              @if (grupos().agua.length > 0) {
                <section class="secao" aria-labelledby="sec-agua">
                  <h2 id="sec-agua">Água</h2>
                  <div class="galoes">
                    @for (item of grupos().agua; track item.produtoId) {
                      <button type="button" class="alvo" (click)="ajustar(item)">
                        <ce-galao-nivel [item]="item" [maiorDoGrupo]="maiorAgua()" />
                      </button>
                    }
                  </div>
                </section>
              }
              @if (grupos().vasilhames.length > 0) {
                <section class="secao" aria-labelledby="sec-vasilhames">
                  <h2 id="sec-vasilhames">Vasilhames</h2>
                  <div class="chips">
                    @for (item of grupos().vasilhames; track item.produtoId) {
                      <button
                        type="button"
                        class="alvo"
                        [attr.data-abaixo-minimo]="item.abaixoMinimo ? '' : null"
                        (click)="ajustar(item)"
                      >
                        <ce-chip [tom]="tomDe(item)" [icone]="iconeDe(item)">
                          {{ rotuloDe(item) }}: {{ item.quantidade }}
                          @if (item.abaixoMinimo) {
                            · abaixo do mínimo ({{ item.estoqueMinimo }})
                          }
                        </ce-chip>
                      </button>
                    }
                  </div>
                </section>
              }
              @if (grupos().descartaveis.length > 0) {
                <section class="secao secao--larga" aria-labelledby="sec-descartaveis">
                  <h2 id="sec-descartaveis">Descartáveis</h2>
                  @for (grupo of grupos().descartaveis; track grupo.categoria) {
                    <h3>{{ grupo.categoria }}</h3>
                    <div class="barras">
                      @for (item of grupo.itens; track item.produtoId) {
                        <button type="button" class="alvo" (click)="ajustar(item)">
                          <ce-barra-estoque [item]="item" [maiorDoGrupo]="maiorDe(grupo.itens)" />
                        </button>
                      }
                    </div>
                  }
                </section>
              }
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

    <div class="acoes">
      <ce-button *cePermissao="'estoque.editar'" [block]="true" (click)="abastecer()">
        <ce-icon nome="caixa" [tamanho]="18" /> Chegou mercadoria
      </ce-button>
      <ce-button *cePermissao="'estoque.editar'" variante="ghost" (click)="baixaCasco()"
        >Baixa de casco</ce-button
      >
    </div>
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

    h2 {
      font-size: var(--ce-font-lg);
      margin-bottom: var(--ce-space-3);
    }

    h3 {
      font-size: var(--ce-font-md);
      color: var(--ce-text-muted);
      margin: var(--ce-space-3) 0 var(--ce-space-2);
    }

    .galoes,
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-3);
    }

    .barras {
      display: grid;
      gap: var(--ce-space-2);

      @include mixins.from-desktop {
        grid-template-columns: 1fr 1fr;
      }
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

    .barras .alvo {
      width: 100%;
    }

    // Barra fixa do botão principal (DESIGN.md §5), acima da bottom-nav
    .acoes {
      position: sticky;
      bottom: calc(var(--ce-nav-height) + env(safe-area-inset-bottom, 0px));
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      min-height: 56px;
      padding: var(--ce-space-2) var(--ce-space-4);
      background: var(--ce-bg);
      border-top: 1px solid var(--ce-border);

      @include mixins.from-desktop {
        bottom: 0;
      }
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

  protected readonly grupos = computed(() => agruparEstoque(this.store.itens()));
  protected readonly maiorAgua = computed(() => maiorEstoque(this.grupos().agua));

  protected maiorDe(itens: readonly EstoqueItemResponse[]): number {
    return maiorEstoque(itens);
  }

  protected tomDe(item: EstoqueItemResponse): ChipTom {
    return item.tipo === 'CASCO' ? 'casco' : item.tipo === 'SUCATA' ? 'sucata' : 'agua';
  }

  protected iconeDe(item: EstoqueItemResponse): IconeNome {
    return iconeDoProduto(item);
  }

  protected rotuloDe(item: EstoqueItemResponse): string {
    return [item.nome, item.marca, item.tamanho]
      .filter((parte): parte is string => !!parte)
      .join(' ');
  }

  protected async ajustar(item: EstoqueItemResponse): Promise<void> {
    // a linha é o alvo do clique: some só a ação, não o item de consulta
    if (!this.permissions.has('estoque.editar')) return;
    const ref = this.sheet.abrir<boolean, AjusteSheetDados>(AjusteSheet, { item });
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

  protected voltarParaMais(): void {
    this.router.navigateByUrl('/mais');
  }
}
