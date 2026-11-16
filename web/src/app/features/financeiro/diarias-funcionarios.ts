import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { DiariaFechamentoRequest } from '../../core/api/models/financeiro';
import { FuncionarioResponse } from '../../core/api/models/rh';
import { RhApi } from '../../core/api/rh-api';
import { Checkbox } from '../../ui/atoms/checkbox';
import { MoneyInput } from '../../ui/molecules/money-input';

/** Estado das diárias (quem veio e o valor de cada um), compartilhado pelo fechamento e pelo lançamento. */
export class EstadoDiarias {
  readonly statusLista = signal<'loading' | 'ok' | 'error'>('loading');
  readonly funcionarios = signal<FuncionarioResponse[]>([]);
  /** Começam marcados os que têm diária cadastrada; desmarcar é a ausência da diária. */
  readonly marcadosIds = signal<ReadonlySet<string>>(new Set());
  /** Valor da diária de cada um só nesta operação; começa no cadastro. */
  readonly valores = signal<Readonly<Record<string, number>>>({});
  readonly marcados = computed(() =>
    this.funcionarios().filter((f) => this.marcadosIds().has(f.id)),
  );
  readonly totalMarcado = computed(() =>
    this.marcados().reduce((soma, f) => soma + (this.valores()[f.id] ?? 0), 0),
  );
  /** Só valor > 0 vira lançamento. */
  readonly qtdLancamentos = computed(
    () => this.marcados().filter((f) => (this.valores()[f.id] ?? 0) > 0).length,
  );

  constructor(private readonly rhApi: RhApi) {
    void this.carregar();
  }

  /** Sem a lista a operação iria sem diárias e não tem volta (409 depois): o botão espera 'ok'. */
  async carregar(): Promise<void> {
    this.statusLista.set('loading');
    try {
      const lista = await firstValueFrom(this.rhApi.listarFuncionarios());
      const ativos = lista.filter((f) => f.ativo);
      this.funcionarios.set(ativos);
      this.valores.set(Object.fromEntries(ativos.map((f) => [f.id, f.valorDiaria])));
      this.marcadosIds.set(new Set(ativos.filter((f) => f.valorDiaria > 0).map((f) => f.id)));
      this.statusLista.set('ok');
    } catch {
      // 0/5xx já viram toast no interceptor
      this.statusLista.set('error');
    }
  }

  alternar(id: string, marcado: boolean): void {
    this.marcadosIds.update((atual) => {
      const novo = new Set(atual);
      if (marcado) {
        novo.add(id);
      } else {
        novo.delete(id);
      }
      return novo;
    });
  }

  /** O ce-money-input emite null ao digitar só zeros: conta como 0. */
  definirValor(id: string, valor: number | null): void {
    this.valores.update((atual) => ({ ...atual, [id]: valor ?? 0 }));
  }

  /** `padraoNulo`: o valor que não foi mexido vai nulo, e o servidor usa a diária cadastrada. */
  paraRequest(padraoNulo = false): DiariaFechamentoRequest[] {
    return this.marcados().map((f) => {
      const valor = this.valores()[f.id] ?? 0;
      return {
        funcionarioId: f.id,
        valor: padraoNulo && valor === f.valorDiaria ? null : valor,
      };
    });
  }
}

@Component({
  selector: 'ce-diarias-funcionarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Checkbox, MoneyInput],
  template: `
    @for (f of estado().funcionarios(); track f.id) {
      <div class="linha">
        <ce-checkbox
          [ngModel]="estado().marcadosIds().has(f.id)"
          (ngModelChange)="estado().alternar(f.id, $event)"
        >
          <b>{{ f.nome }}</b>
          @if (f.cargo) {
            <span class="cargo"> · {{ f.cargo }}</span>
          }
        </ce-checkbox>
        <ce-money-input
          [rotulo]="'Diária de ' + f.nome"
          [zeroComoValor]="true"
          [ngModel]="estado().valores()[f.id]"
          (ngModelChange)="estado().definirValor(f.id, $event)"
        />
      </div>
    } @empty {
      @if (estado().statusLista() === 'ok') {
        <p class="vazio">Nenhum funcionário ativo.</p>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .linha {
      display: grid;
      grid-template-columns: 1fr 10rem;
      align-items: center;
      gap: var(--ce-space-3);
    }

    .cargo {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .vazio {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class DiariasFuncionarios {
  readonly estado = input.required<EstadoDiarias>();
}
