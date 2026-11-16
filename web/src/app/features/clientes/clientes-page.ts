import { NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';

import { CePermissao } from '../../core/permissions/ce-permissao';
import { Avatar } from '../../ui/atoms/avatar';
import { Button } from '../../ui/atoms/button';
import { Chip } from '../../ui/atoms/chip';
import { ListItem } from '../../ui/molecules/list-item';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { ClienteDetalhePage } from './cliente-detalhe-page';
import { FiltroClientes, LinhaCliente, normalizarFiltro, urlLista } from './clientes-linhas';
import { ClientesStore } from './clientes-store';
import { classificarSaldo, rotuloSaldo } from './saldo-cliente';
import { rotuloSaldoCasco } from '../vendas/cascos-por-tipo';

@Component({
  selector: 'ce-clientes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CePermissao,
    AppHeader,
    Avatar,
    Button,
    Chip,
    ListItem,
    SearchBox,
    DataList,
    ClienteDetalhePage,
    NgTemplateOutlet,
  ],
  template: `
    <ng-template #lista>
      <ce-app-header titulo="Clientes">
        <ce-button *cePermissao="'clientes.cadastrar'" rotulo="Novo cliente" (click)="novo()">
          + Novo
        </ce-button>
      </ce-app-header>

      <div class="filtros">
        <ce-search-box
          rotulo="Buscar cliente"
          placeholder="Buscar por nome…"
          [valor]="store.termo()"
          (buscar)="store.buscar($event)"
        />
        <div class="pilulas" role="group" aria-label="Filtro">
          @for (op of opcoes; track op.valor) {
            <button
              type="button"
              class="pilula"
              [attr.aria-pressed]="store.filtro() === op.valor"
              (click)="trocar(op.valor)"
            >
              {{ op.rotulo }}
            </button>
          }
        </div>
      </div>

      <div class="conteudo">
        <ce-data-list
          [itens]="store.linhas()"
          [status]="store.statusLista()"
          [temMais]="store.temMaisLista()"
          [vazioTitulo]="vazioTitulo()"
          vazioDescricao="Confira o nome. Se é cliente novo, cadastre agora e já venda."
          (recarregar)="store.recarregar()"
          (maisPagina)="store.carregarMais()"
        >
          <ng-template let-linha>
            <ce-list-item
              [attr.aria-current]="desktop() && linha.id === idDetalhe() ? 'true' : null"
              (click)="abrir(linha)"
            >
              <ce-avatar ce-leading [nome]="linha.nome" [tamanho]="40" />
              <span class="nome">{{ linha.nome }}</span>
              @if (linha.secundario) {
                <span class="secundario">{{ linha.secundario }}</span>
              }
              <span ce-trailing class="selos">
                @if (linha.saldoCascos) {
                  <ce-chip tom="casco" icone="casco-na-rua">
                    @if (linha.saldoCascos < 0) {
                      {{ rotuloSaldoCasco(linha.saldoCascos) }}
                    } @else {
                      {{ linha.saldoCascos }} {{ linha.saldoCascos === 1 ? 'casco' : 'cascos' }}
                    }
                  </ce-chip>
                }
                @if (linha.saldo) {
                  @let saldo = classificarSaldo(linha.saldo);
                  <ce-chip [tom]="saldo.tom">{{ rotuloSaldo(saldo) }}</ce-chip>
                }
              </span>
            </ce-list-item>
          </ng-template>
          <!-- depois do ng-template do item: o contentChild do ce-data-list pega o primeiro -->
          <ce-button
            *cePermissao="'clientes.cadastrar'"
            ce-vazio-acao
            variante="ghost"
            (click)="novo()"
          >
            Cadastrar cliente
          </ce-button>
        </ce-data-list>
      </div>
    </ng-template>

    @if (desktop()) {
      <div class="md">
        <section class="mestre"><ng-container *ngTemplateOutlet="lista" /></section>
        <section class="detalhe">
          @if (idDetalhe(); as detalheId) {
            <ce-cliente-detalhe-page [id]="detalheId" [filtro]="store.filtro()" />
          } @else {
            <p class="selecione">Selecione um cliente na lista</p>
          }
        </section>
      </div>
    } @else if (id(); as detalheId) {
      <ce-cliente-detalhe-page [id]="detalheId" [filtro]="store.filtro()" />
    } @else {
      <ng-container *ngTemplateOutlet="lista" />
    }
  `,
  styles: `
    @use 'mixins';

    .filtros {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      padding-inline: var(--ce-space-4);
    }

    .pilulas {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .pilula {
      @include mixins.touch-target;

      padding-inline: var(--ce-space-4);
      border: 1px solid var(--ce-border);
      border-radius: 999px;
      background: var(--ce-surface);
      font-weight: 600;

      &[aria-pressed='true'] {
        border-color: var(--ce-primary);
        background: var(--ce-primary-soft);
        color: var(--ce-primary-strong);
      }
    }

    .conteudo {
      padding: var(--ce-space-4);
    }

    // Cartões do design Depósito: raio 18–22 px (o ce-list-item é compartilhado, o raio vale só aqui).
    :host ::ng-deep .item {
      border-radius: 20px;
    }

    :host ::ng-deep ce-list-item[aria-current='true'] .item {
      background: var(--ce-primary-soft);
      box-shadow: inset 3px 0 0 var(--ce-primary);
    }

    .nome {
      font-weight: 600;
    }

    .secundario {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .selos {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--ce-space-1);
    }

    .selecione {
      padding: var(--ce-space-8);
      text-align: center;
      color: var(--ce-text-muted);
    }

    // Mestre-detalhe (protótipo: 440px | 1fr), cada coluna com a sua rolagem.
    // 56px = altura do cabeçalho do shell; var(--ce-space-6) = padding-bottom do conteúdo ≥960px.
    .md {
      display: grid;
      grid-template-columns: 440px minmax(0, 1fr);
      height: calc(100dvh - 56px - env(safe-area-inset-top, 0px) - var(--ce-space-6));
    }

    .mestre,
    .detalhe {
      // rolagem própria: o cabeçalho gruda no topo da coluna, não da janela
      --ce-cabecalho-topo: 0px;

      overflow-y: auto;
    }

    .mestre {
      border-right: 1px solid var(--ce-border);
      background: var(--ce-surface);
    }
  `,
})
export class ClientesPage implements OnInit {
  /** Route param (:id): no desktop, o cliente do detalhe; no celular, troca a lista pelo detalhe. */
  readonly id = input<string>();
  /** Query param ?filtro= (cartões de Hoje): withComponentInputBinding entrega undefined se faltar. */
  readonly filtro = input<FiltroClientes, string | null | undefined>('todos', {
    transform: normalizarFiltro,
  });

  protected readonly classificarSaldo = classificarSaldo;
  protected readonly rotuloSaldo = rotuloSaldo;
  protected readonly rotuloSaldoCasco = rotuloSaldoCasco;
  protected readonly store = inject(ClientesStore);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly opcoes: { valor: FiltroClientes; rotulo: string }[] = [
    { valor: 'todos', rotulo: 'Todos' },
    { valor: 'fiado', rotulo: 'Com fiado' },
    { valor: 'casco', rotulo: 'Com casco' },
  ];

  // A partir de 960 px a lista e o detalhe dividem a tela (mesmo breakpoint do PDV).
  protected readonly desktop = toSignal(
    this.breakpoints.observe('(min-width: 960px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  /** Sem :id no desktop, o detalhe mostra o primeiro da lista, sem mudar a URL. */
  protected readonly idDetalhe = computed(() => this.id() ?? this.store.linhas()[0]?.id ?? null);

  protected readonly vazioTitulo = computed(() => {
    const termo = this.store.termo().trim();
    return termo ? `Ninguém com “${termo}”` : 'Ninguém nesta lista';
  });

  constructor() {
    // Nova navegação para a mesma página com outro ?filtro=: o store acompanha.
    effect(() => {
      const f = this.filtro();
      untracked(() => this.store.definirFiltro(f));
    });
  }

  ngOnInit(): void {
    this.store.abrir(this.filtro());
  }

  protected novo(): void {
    this.router.navigateByUrl('/clientes/novo');
  }

  protected abrir(linha: LinhaCliente): void {
    this.router.navigateByUrl(urlLista(linha.id, this.store.filtro()));
  }

  protected trocar(filtro: FiltroClientes): void {
    this.store.definirFiltro(filtro);
    this.router.navigateByUrl(urlLista(this.id(), filtro), { replaceUrl: true });
  }
}
