import { ChangeDetectionStrategy, Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RhApi } from '../../core/api/rh-api';
import { FuncionarioResponse } from '../../core/api/models/rh';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Spinner } from '../../ui/atoms/spinner';

/**
 * Escolha de funcionários ativos, um checkbox por pessoa. `selecionados` é two-way;
 * `ativosCarregados` entrega a lista para quem usa podar uma pré-seleção.
 */
@Component({
  selector: 'ce-seletor-funcionarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Checkbox, Spinner],
  template: `
    <div class="seletor">
      @if (carregando()) {
        <div class="seletor__carregando"><ce-spinner [tamanho]="20" /></div>
      } @else if (erro()) {
        <p class="seletor__erro" role="alert">{{ erro() }}</p>
      } @else {
        @for (funcionario of funcionarios(); track funcionario.id) {
          <ce-checkbox
            [ngModel]="selecionados().has(funcionario.id)"
            [ngModelOptions]="{ standalone: true }"
            (ngModelChange)="alternar(funcionario.id, $event)"
          >
            {{ funcionario.nome }}
          </ce-checkbox>
        } @empty {
          <p class="seletor__vazio">Nenhum funcionário ativo encontrado.</p>
        }
      }
    </div>
  `,
  styles: `
    .seletor {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    .seletor__carregando {
      display: flex;
      justify-content: center;
      padding: var(--ce-space-3);
    }

    .seletor__vazio {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .seletor__erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class SeletorFuncionarios {
  private readonly rhApi = inject(RhApi);

  readonly selecionados = model<ReadonlySet<string>>(new Set());
  readonly ativosCarregados = output<readonly FuncionarioResponse[]>();

  protected readonly funcionarios = signal<FuncionarioResponse[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.rhApi.listarFuncionarios().subscribe({
      next: (funcionarios) => {
        const ativos = funcionarios.filter((f) => f.ativo);
        this.funcionarios.set(ativos);
        this.carregando.set(false);
        this.ativosCarregados.emit(ativos);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar os funcionários.');
      },
    });
  }

  protected alternar(id: string, marcado: boolean): void {
    const novo = new Set(this.selecionados());
    if (marcado) {
      novo.add(id);
    } else {
      novo.delete(id);
    }
    this.selecionados.set(novo);
  }
}
