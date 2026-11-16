import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import { EnderecoResponse } from '../../core/api/models/clientes';
import { ProdutoResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { MotivoPerda, PedidoResponse } from '../../core/api/models/pedidos';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { ApiError } from '../../core/http/api-error';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Button } from '../../ui/atoms/button';
import { Spinner } from '../../ui/atoms/spinner';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import {
  IniciarPedidoDados,
  IniciarPedidoResultado,
  IniciarPedidoSheet,
} from './iniciar-pedido-sheet';
import {
  podeCancelar,
  podeConcluir,
  podeIniciar,
  podeRegistrarPerdas,
  rotuloStatus,
} from './pedido-form';
import { PedidosStore } from './pedidos-store';
import {
  RegistrarPerdasDados,
  RegistrarPerdasResultado,
  RegistrarPerdasSheet,
} from './registrar-perdas-sheet';

const MOTIVOS: Record<MotivoPerda, string> = { PERDIDO: 'Perdido', QUEBRADO: 'Quebrado' };

@Component({
  selector: 'ce-pedido-detalhe-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, CePermissao, AppHeader, Button, EmptyState, PrecoPipe, Spinner],
  template: `
    <ce-app-header titulo="Pedido" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      @switch (store.statusPedido()) {
        @case ('error') {
          <ce-empty-state
            icone="alerta"
            titulo="Não foi possível carregar o pedido"
            [descricao]="store.erroPedido() ?? 'Verifique a conexão e tente novamente.'"
          />
        }
        @case ('ok') {
          @if (store.pedido(); as pedido) {
            <section class="bloco">
              <p class="cliente">{{ store.cliente()?.nome ?? 'Carregando cliente…' }}</p>
              <p class="status" data-testid="pedido-status">{{ rotuloStatus(pedido.status) }}</p>
              @if (enderecoTexto(pedido); as endereco) {
                <p class="meta">Entrega: {{ endereco }}</p>
              }
              @if (pedido.observacao) {
                <p class="meta">{{ pedido.observacao }}</p>
              }
              <p class="meta">Criado em {{ pedido.createdAt | date: 'dd/MM/yyyy HH:mm' }}</p>
              @if (pedido.iniciadoEm; as iniciadoEm) {
                <p class="meta">Iniciado em {{ iniciadoEm | date: 'dd/MM/yyyy HH:mm' }}</p>
              }
              @if (pedido.canceladoEm; as canceladoEm) {
                <p class="meta">Cancelado em {{ canceladoEm | date: 'dd/MM/yyyy HH:mm' }}</p>
              }
            </section>

            <section class="bloco">
              <h2>Itens</h2>
              <ul class="linhas">
                @for (item of pedido.itens; track $index) {
                  <li class="linha">
                    <span>
                      {{ nomeDoProduto(item.produtoId) }} —
                      {{ nomeDaMarca(item.produtoId, item.marcaId) }}
                      <span class="meta"
                        >{{ item.quantidade }} × {{ item.precoUnitario | cePreco }}</span
                      >
                    </span>
                  </li>
                }
              </ul>
            </section>

            <section class="bloco">
              <h2>Funcionários</h2>
              <ul class="linhas">
                @for (f of pedido.funcionarios; track f.id) {
                  <li>{{ f.nome }}</li>
                } @empty {
                  <li class="meta">Nenhum funcionário escolhido.</li>
                }
              </ul>
            </section>

            <section class="bloco">
              <h2>Perdas</h2>
              <ul class="linhas">
                @for (p of pedido.perdas; track $index) {
                  <li class="linha">
                    <span>
                      {{ p.galao === 'CHEIO' ? 'Cheio' : 'Vazio' }} —
                      {{ nomeDaPerda(p.galao, p.produtoId, p.tipoCascoId) }}
                      <span class="meta">
                        {{ p.quantidade }} · {{ rotuloMotivo(p.motivo) }} ·
                        {{ p.registradoEm | date: 'dd/MM/yyyy HH:mm' }}
                      </span>
                    </span>
                  </li>
                } @empty {
                  <li class="meta">Nenhuma perda registrada</li>
                }
              </ul>
            </section>

            @if (erro(); as mensagem) {
              <p class="erro" role="alert">{{ mensagem }}</p>
            }

            @if (store.perdasPendentes()[pedido.id]?.length) {
              <p class="aviso" role="status" data-testid="perdas-pendentes">
                A venda foi registrada, mas as perdas não. Registre de novo.
              </p>
            }

            <div class="acoes">
              @if (podeIniciar(pedido.status)) {
                <ce-button
                  *cePermissao="'vendas.registrar'"
                  [block]="true"
                  (click)="iniciar(pedido)"
                >
                  Iniciar
                </ce-button>
              }
              @if (podeConcluir(pedido.status)) {
                <ce-button
                  *cePermissao="'vendas.registrar'"
                  [block]="true"
                  (click)="concluir(pedido)"
                >
                  Concluir
                </ce-button>
              }
              @if (podeRegistrarPerdas(pedido.status)) {
                <ce-button
                  *cePermissao="'vendas.registrar'"
                  [block]="true"
                  (click)="registrarPerdas(pedido)"
                >
                  Registrar perdas
                </ce-button>
              }
              @if (podeCancelar(pedido.status)) {
                <ce-button
                  *cePermissao="'vendas.registrar'"
                  variante="danger"
                  [block]="true"
                  [loading]="cancelando()"
                  (click)="cancelar(pedido)"
                >
                  Cancelar
                </ce-button>
              }
            </div>
          }
        }
        @default {
          <div class="carregando" aria-busy="true"><ce-spinner /></div>
        }
      }
    </div>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding: var(--ce-space-4);
    }

    .bloco {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    h2 {
      font-size: var(--ce-font-md);
      font-weight: 600;
    }

    .cliente {
      font-size: var(--ce-font-lg);
      font-weight: 600;
    }

    .status {
      font-weight: 600;
    }

    .meta {
      display: block;
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .linhas {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .linha {
      display: flex;
      justify-content: space-between;
      gap: var(--ce-space-3);
    }

    .acoes {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .aviso {
      color: var(--ce-warning);
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    .carregando {
      display: flex;
      justify-content: center;
    }
  `,
})
export class PedidoDetalhePage {
  /** Route param (:id). */
  readonly id = input.required<string>();

  protected readonly store = inject(PedidosStore);
  private readonly estoqueApi = inject(EstoqueApi);
  private readonly router = inject(Router);
  private readonly sheet = inject(SheetService);

  protected readonly rotuloStatus = rotuloStatus;
  protected readonly podeIniciar = podeIniciar;
  protected readonly podeCancelar = podeCancelar;
  protected readonly podeConcluir = podeConcluir;
  protected readonly podeRegistrarPerdas = podeRegistrarPerdas;
  protected readonly erro = signal<string | null>(null);
  protected readonly cancelando = signal(false);

  private readonly produtos = signal<ReadonlyMap<string, ProdutoResponse>>(new Map());
  private readonly tiposCasco = signal<ReadonlyMap<string, TipoCascoResponse>>(new Map());

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.erro.set(null);
        this.store.carregar(id);
      });
    });
    // Nomes de produto, marca e tipo de casco vêm do catálogo; sem ele a linha mostra um rótulo genérico.
    this.estoqueApi.listarProdutos().subscribe({
      next: (lista) => this.produtos.set(new Map(lista.map((p) => [p.id, p]))),
    });
    this.estoqueApi.listarTiposCasco().subscribe({
      next: (lista) => this.tiposCasco.set(new Map(lista.map((t) => [t.id, t]))),
    });
  }

  protected voltar(): void {
    this.router.navigateByUrl('/pedidos');
  }

  protected nomeDoProduto(produtoId: string | null): string {
    return (produtoId && this.produtos().get(produtoId)?.nome) || 'Produto';
  }

  protected nomeDaMarca(produtoId: string | null, marcaId: string | null): string {
    const marca = this.produtos()
      .get(produtoId ?? '')
      ?.marcas.find((m) => m.marcaId === marcaId);
    return marca ? rotuloDaMarca(marca.marcaNome) : 'Marca';
  }

  protected nomeDaPerda(
    galao: 'CHEIO' | 'VAZIO',
    produtoId: string | null,
    tipoCascoId: string | null,
  ): string {
    return galao === 'CHEIO'
      ? this.nomeDoProduto(produtoId)
      : ((tipoCascoId && this.tiposCasco().get(tipoCascoId)?.nome) ?? 'Tipo de casco');
  }

  protected rotuloMotivo(motivo: MotivoPerda): string {
    return MOTIVOS[motivo] ?? motivo;
  }

  protected enderecoTexto(pedido: PedidoResponse): string | null {
    const e: EnderecoResponse | undefined = this.store
      .cliente()
      ?.enderecos.find((x) => x.id === pedido.enderecoEntregaId);
    return e ? [e.logradouro, e.numero, e.bairro].filter((p) => !!p).join(', ') : null;
  }

  protected async iniciar(pedido: PedidoResponse): Promise<void> {
    this.erro.set(null);
    const ref = this.sheet.abrir<IniciarPedidoResultado, IniciarPedidoDados>(IniciarPedidoSheet, {
      pedido,
    });
    const resultado = await firstValueFrom(ref.closed);
    // Sucesso: a store já atualizou o pedido. 'erro': a situação mudou e a store já recarregou.
    if (resultado && 'erro' in resultado) {
      this.erro.set(resultado.erro);
    }
  }

  protected concluir(pedido: PedidoResponse): void {
    void this.router.navigateByUrl(`/pedidos/${pedido.id}/conclusao`);
  }

  protected async registrarPerdas(pedido: PedidoResponse): Promise<void> {
    this.erro.set(null);
    const ref = this.sheet.abrir<RegistrarPerdasResultado, RegistrarPerdasDados>(
      RegistrarPerdasSheet,
      { pedido, ocorrencias: this.store.perdasPendentes()[pedido.id] ?? [] },
    );
    const resultado = await firstValueFrom(ref.closed);
    // Sucesso: a store já gravou o pedido e limpou as pendentes. 'erro': a situação mudou e a store já recarregou.
    if (resultado && 'erro' in resultado) {
      this.erro.set(resultado.erro);
    }
  }

  protected async cancelar(pedido: PedidoResponse): Promise<void> {
    this.erro.set(null);
    const confirmado = await this.sheet.confirmar({
      titulo: 'Cancelar pedido?',
      mensagem: 'O pedido deixa de valer. Esta ação não pode ser desfeita.',
      confirmarLabel: 'Cancelar pedido',
      cancelarLabel: 'Voltar',
      perigo: true,
    });
    if (!confirmado) {
      return;
    }
    this.cancelando.set(true);
    try {
      await this.store.cancelar(pedido.id);
    } catch (e: unknown) {
      this.erro.set(e instanceof ApiError ? e.userMessage : 'Erro ao cancelar o pedido.');
    } finally {
      this.cancelando.set(false);
    }
  }
}
