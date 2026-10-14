import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { ClienteResponse } from '../../core/api/models/clientes';
import { SheetService } from '../../core/overlay/sheet-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Spinner } from '../../ui/atoms/spinner';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { EnderecoSheet, EnderecoSheetDados } from './endereco-sheet';

@Component({
  selector: 'ce-cliente-detalhe-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, Button, Icon, Spinner, EmptyState],
  templateUrl: './cliente-detalhe-page.html',
  styleUrl: './cliente-detalhe-page.scss',
})
export class ClienteDetalhePage {
  /** Route param (:id). */
  readonly id = input.required<string>();

  private readonly api = inject(ClientesApi);
  private readonly sheet = inject(SheetService);
  private readonly router = inject(Router);

  protected readonly cliente = signal<ClienteResponse | null>(null);
  protected readonly carregando = signal(true);

  constructor() {
    queueMicrotask(() => this.carregar());
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.api.obter(this.id()).subscribe({
      next: (cliente) => {
        this.cliente.set(cliente);
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  protected async novoEndereco(): Promise<void> {
    const ref = this.sheet.abrir<unknown, EnderecoSheetDados>(EnderecoSheet, {
      clienteId: this.id(),
    });
    const criado = await firstValueFrom(ref.closed);
    if (criado) {
      this.carregar();
    }
  }

  protected editar(): void {
    this.router.navigateByUrl(`/clientes/${this.id()}/editar`);
  }

  protected voltar(): void {
    this.router.navigateByUrl('/clientes');
  }
}
