import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { ClienteResponse } from '../../core/api/models/clientes';
import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { VendaStore } from './venda-store';
import { rotuloCliente, rotuloStatusPagamento } from './venda-rotulos';

const ERRO_PADRAO = 'Verifique a conexão e tente novamente.';

@Component({
  selector: 'ce-vendas-lista-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    AppHeader,
    Button,
    DataList,
    FormField,
    Icon,
    ListItem,
    PrecoPipe,
    SearchBox,
    TextInput,
  ],
  template: `
    <ce-app-header titulo="Vendas" />

    <div class="filtros">
      @if (cliente(); as c) {
        <div class="cliente-sel">
          <span class="cliente-sel__nome">{{ c.nome }}</span>
          <ce-button variante="ghost" (click)="limparCliente()">Limpar</ce-button>
        </div>
      } @else {
        <ce-search-box placeholder="Filtrar por cliente…" (buscar)="buscarClientes($event)" />
        @if (erroClientes(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }
        <div class="resultados">
          @for (c of resultados(); track c.id) {
            <button type="button" class="opcao" (click)="selecionarCliente(c)">{{ c.nome }}</button>
          }
        </div>
      }
      <div class="periodo">
        <ce-form-field rotulo="De">
          <ce-input tipo="date" [ngModel]="inicio()" (ngModelChange)="mudarInicio($event)" />
        </ce-form-field>
        <ce-form-field rotulo="Até">
          <ce-input tipo="date" [ngModel]="fim()" (ngModelChange)="mudarFim($event)" />
        </ce-form-field>
      </div>
    </div>

    <div class="conteudo">
      @if (store.status() === 'ok' && store.erro(); as mensagem) {
        <p class="erro" role="alert">{{ mensagem }}</p>
      }
      <ce-data-list
        [itens]="store.vendas()"
        [status]="store.status()"
        [temMais]="store.temMais()"
        [erroDescricao]="store.erro() ?? erroPadrao"
        vazioTitulo="Nenhuma venda"
        vazioDescricao="Nenhuma venda encontrada para os filtros."
        (recarregar)="aplicar()"
        (maisPagina)="store.carregarMais()"
      >
        <ng-template let-venda>
          <ce-list-item (click)="abrir(venda)">
            <span class="cliente">{{ rotuloCliente(store.clientes().get(venda.clienteId)) }}</span>
            <span class="meta">{{ venda.data | date: 'dd/MM/yyyy HH:mm' }}</span>
            <span class="meta">
              {{ rotuloStatusPagamento(venda.statusPagamento) }}
              @if (venda.cupomEmitido) {
                · Cupom emitido
              }
            </span>
            <span ce-trailing class="total">{{ venda.totalLiquido | cePreco }}</span>
            <ce-icon ce-trailing nome="seta-direita" [tamanho]="18" />
          </ce-list-item>
        </ng-template>
      </ce-data-list>
    </div>
  `,
  styles: `
    .filtros {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding-inline: var(--ce-space-4);
    }

    .cliente-sel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-2);
    }

    .cliente-sel__nome {
      font-weight: 600;
    }

    .resultados {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    .opcao {
      text-align: left;
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface);
    }

    .periodo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ce-space-2);
    }

    .conteudo {
      padding: var(--ce-space-4);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .cliente {
      display: block;
      font-weight: 600;
    }

    .meta {
      display: block;
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .total {
      font-weight: 600;
    }
  `,
})
export class VendasListaPage {
  protected readonly store = inject(VendaStore);
  private readonly clientesApi = inject(ClientesApi);
  private readonly router = inject(Router);

  protected readonly erroPadrao = ERRO_PADRAO;
  protected readonly rotuloCliente = rotuloCliente;
  protected readonly rotuloStatusPagamento = rotuloStatusPagamento;

  protected readonly cliente = signal<ClienteResponse | null>(null);
  protected readonly resultados = signal<readonly ClienteResponse[]>([]);
  protected readonly erroClientes = signal<string | null>(null);
  protected readonly inicio = signal('');
  protected readonly fim = signal('');

  private termo = '';

  constructor() {
    this.store.buscar({});
  }

  protected aplicar(): void {
    this.store.buscar({
      clienteId: this.cliente()?.id,
      inicio: this.inicio() || undefined,
      fim: this.fim() || undefined,
    });
  }

  protected async buscarClientes(nome: string): Promise<void> {
    this.termo = nome;
    this.erroClientes.set(null);
    if (nome === '') {
      this.resultados.set([]);
      return;
    }
    try {
      const lista = await firstValueFrom(this.clientesApi.listar(nome, 1));
      if (this.termo === nome) {
        this.resultados.set(lista);
      }
    } catch (e) {
      // Rede/5xx já viraram toast no interceptor; 4xx fica inline.
      if (this.termo === nome && e instanceof ApiError && e.status >= 400 && e.status < 500) {
        this.resultados.set([]);
        this.erroClientes.set(e.userMessage);
      }
    }
  }

  protected selecionarCliente(cliente: ClienteResponse): void {
    this.cliente.set(cliente);
    this.resultados.set([]);
    this.termo = '';
    this.aplicar();
  }

  protected limparCliente(): void {
    this.cliente.set(null);
    this.aplicar();
  }

  protected mudarInicio(valor: string): void {
    this.inicio.set(valor);
    this.aplicar();
  }

  protected mudarFim(valor: string): void {
    this.fim.set(valor);
    this.aplicar();
  }

  protected abrir(venda: VendaDetalheResponse): void {
    this.router.navigateByUrl(`/vendas/detalhe/${venda.id}`);
  }
}
