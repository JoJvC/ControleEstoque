import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { RhApi } from '../../core/api/rh-api';
import { FuncionarioResponse } from '../../core/api/models/rh';
import { OperatorStore } from '../../core/operator/operator-store';

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

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    this.status.set('loading');
    this.rhApi.listarFuncionarios().subscribe({
      next: (lista) => {
        this.funcionarios.set(lista.filter((f) => f.ativo));
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
    });
    this.router.navigateByUrl('/home');
  }
}
