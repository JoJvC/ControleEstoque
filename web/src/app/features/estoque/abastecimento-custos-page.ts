import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  AbastecimentoDetalheResponse,
  AbastecimentoLinhaResponse,
} from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { linhasDoCatalogo } from '../vendas/busca-produto';
import { TiposCascoStore } from '../produtos/tipos-casco-store';
import { nomeComTamanho } from './estoque-grupos';
import { corpoDosCustos } from './abastecimento-linhas';
import { AbastecimentoStore } from './abastecimento-store';
import { EstoqueStore } from './estoque-store';

interface LinhaCusto {
  readonly id: string;
  readonly nome: string;
  readonly quantidade: number;
  readonly casco: boolean;
}

/** Momento 2: custo unitário por linha e frete; o total exibido é o do servidor. */
@Component({
  selector: 'ce-abastecimento-custos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppHeader, Button, DataList, FormField, MoneyInput, PrecoPipe],
  template: `
    <ce-app-header titulo="Custos da carga" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <ce-data-list
        [itens]="detalheComoLista()"
        [status]="store.statusDetalhe()"
        vazioTitulo="Carga não encontrada"
        (recarregar)="carregar()"
      >
        <ng-template>
          <form class="form" (submit)="$event.preventDefault(); salvar()">
            <section class="linhas">
              <h2 class="linhas__titulo">Custo unitário</h2>
              @for (l of linhas(); track l.id) {
                <div class="linha">
                  <div class="linha__info">
                    <b>{{ l.nome }}</b>
                    <span class="linha__qtd">{{ l.quantidade }} un</span>
                  </div>
                  <ce-form-field
                    [rotulo]="'Custo unitário ' + l.nome"
                    [dica]="
                      l.casco ? 'Pode ser 0 se veio de graça; sem ele a carga fica pendente.' : ''
                    "
                  >
                    <ce-money-input [formControl]="ctl(l.id)" [zeroComoValor]="true" />
                  </ce-form-field>
                </div>
              }
            </section>

            <div class="lateral">
              <ce-form-field rotulo="Frete (R$)" dica="Rateado entre as unidades da carga.">
                <ce-money-input [formControl]="frete" [zeroComoValor]="true" />
              </ce-form-field>

              @if (store.detalhe(); as d) {
                <div class="total">
                  <span>Total da carga</span>
                  <b>{{ d.custoTotal | cePreco }}</b>
                </div>
                @if (d.custoPendente) {
                  <p class="pendente" role="status">
                    Custo pendente: falta custo em alguma linha ou o frete.
                  </p>
                }
              }

              @if (erroForm(); as erro) {
                <p class="form__erro" role="alert">{{ erro }}</p>
              }

              <ce-button tipo="submit" [block]="true" [loading]="salvando()">
                Salvar custos
              </ce-button>
            </div>
          </form>
        </ng-template>
      </ce-data-list>
    </div>
  `,
  styles: `
    @use 'mixins';

    .conteudo {
      padding: 0 var(--ce-space-4) var(--ce-space-6);
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);

      @include mixins.from-desktop {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: var(--ce-space-6);
        align-items: start;
      }
    }

    .linhas,
    .lateral {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .linhas__titulo {
      font-size: var(--ce-font-lg);
    }

    .linha {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 16px;
      background: var(--ce-surface);
    }

    .linha__info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .linha__qtd {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .total {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pendente {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .form__erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class AbastecimentoCustosPage {
  protected readonly store = inject(AbastecimentoStore);
  private readonly estoqueStore = inject(EstoqueStore);
  private readonly tiposCascoStore = inject(TiposCascoStore);
  private readonly toast = inject(ToastService);
  private readonly preco = new PrecoPipe();
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') as string;

  private readonly controles = new Map<string, FormControl<number | null>>();
  protected readonly frete = new FormControl<number | null>(null);

  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);

  /** O data-list só desenha o corpo com 1+ item: a carga carregada é a lista de um. */
  protected readonly detalheComoLista = computed(() => {
    const d = this.store.detalhe();
    return d === null ? [] : [d];
  });

  private readonly nomesDosItens = computed(
    () =>
      new Map(
        linhasDoCatalogo(this.estoqueStore.produtos()).map(({ produto, marca }) => [
          marca.id,
          `${nomeComTamanho(produto.nome, produto.tamanho)} — ${rotuloDaMarca(marca.marcaNome)}`,
        ]),
      ),
  );
  private readonly nomesDosCascos = computed(
    () => new Map(this.tiposCascoStore.tipos().map((t) => [t.id, `Vasilhame ${t.nome}`])),
  );

  protected readonly linhas = computed<LinhaCusto[]>(() => {
    const d = this.store.detalhe();
    if (d === null) return [];
    const nomeItem = this.nomesDosItens();
    const nomeCasco = this.nomesDosCascos();
    const de = (
      l: AbastecimentoLinhaResponse,
      nome: string | undefined,
      casco: boolean,
    ): LinhaCusto => ({ id: l.id, nome: nome ?? 'Item', quantidade: l.quantidade, casco });
    return [
      ...d.itens.map((l) => de(l, nomeItem.get(l.produtoMarcaId ?? ''), false)),
      ...d.cascos.map((l) => de(l, nomeCasco.get(l.tipoCascoId ?? ''), true)),
    ];
  });

  constructor() {
    this.estoqueStore.carregar();
    void this.tiposCascoStore.carregar();
    this.carregar();
    // Preenche com o que o servidor já tem (carga aberta e resposta do salvar).
    effect(() => {
      const d = this.store.detalhe();
      if (d === null) return;
      for (const l of [...d.itens, ...d.cascos]) {
        this.ctl(l.id).setValue(l.custoUnitario, { emitEvent: false });
      }
      this.frete.setValue(d.frete, { emitEvent: false });
    });
  }

  protected ctl(id: string): FormControl<number | null> {
    let c = this.controles.get(id);
    if (!c) {
      c = new FormControl<number | null>(null);
      this.controles.set(id, c);
    }
    return c;
  }

  protected carregar(): void {
    void this.store.carregar(this.id);
  }

  protected async salvar(): Promise<void> {
    const d = this.store.detalhe();
    if (d === null) return;
    this.erroForm.set(null);
    const custo = (l: AbastecimentoLinhaResponse) => ({ id: l.id, custo: this.ctl(l.id).value });
    this.salvando.set(true);
    try {
      const salvo = await this.store.lancarCustos(
        this.id,
        corpoDosCustos(d.itens.map(custo), d.cascos.map(custo), this.frete.value),
      );
      this.toast.success('Custos salvos', this.resumoDoSalvo(salvo));
    } catch (erro: unknown) {
      this.erroForm.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao salvar os custos.');
    } finally {
      this.salvando.set(false);
    }
  }

  /** Total do servidor, ou o que ainda falta quando a carga continua com custo pendente. */
  private resumoDoSalvo(d: AbastecimentoDetalheResponse): string {
    if (!d.custoPendente) return `Total da carga: ${this.preco.transform(d.custoTotal)}`;
    const faltas: string[] = [];
    const semCusto = [...d.itens, ...d.cascos].filter((l) => l.custoUnitario === null).length;
    if (semCusto > 0) faltas.push(`custo de ${semCusto} ${semCusto === 1 ? 'linha' : 'linhas'}`);
    if (d.frete === null) faltas.push('frete');
    return `Ainda pendente: ${faltas.length > 0 ? faltas.join(' e ') : 'custo incompleto'}.`;
  }

  protected voltar(): void {
    this.router.navigateByUrl('/estoque');
  }
}
