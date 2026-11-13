import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { RhApi } from '../../core/api/rh-api';
import { CargoResponse, FuncionarioResponse } from '../../core/api/models/rh';
import { OperatorStore } from '../../core/operator/operator-store';
import { permissoesDoCargo } from '../../core/permissions/permissoes-do-cargo';

type Status = 'loading' | 'ok' | 'error';

@Component({
  selector: 'ce-select-operator-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-operator-page.html',
  styleUrl: './select-operator-page.scss',
})
export class SelectOperatorPage {
  private readonly rhApi = inject(RhApi);
  private readonly operatorStore = inject(OperatorStore);
  private readonly router = inject(Router);

  protected readonly status = signal<Status>('loading');
  protected readonly funcionarios = signal<FuncionarioResponse[]>([]);
  private cargos: CargoResponse[] = [];

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    this.status.set('loading');
    forkJoin({
      funcionarios: this.rhApi.listarFuncionarios(),
      cargos: this.rhApi.listarCargos(),
    }).subscribe({
      next: ({ funcionarios, cargos }) => {
        this.cargos = cargos;
        this.funcionarios.set(funcionarios.filter((f) => f.ativo));
        this.status.set('ok');
      },
      error: () => this.status.set('error'),
    });
  }

  protected selecionar(funcionario: FuncionarioResponse): void {
    this.operatorStore.select({
      id: funcionario.id,
      nome: funcionario.nome,
      cargoId: funcionario.cargoId,
      cargoNome: funcionario.cargo,
      permissoes: permissoesDoCargo(this.cargos, funcionario.cargoId),
    });
    this.router.navigateByUrl('/home');
  }
}
