import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';

import { PermissionService } from '../../core/permissions/permission-service';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { CargosPage } from './cargos-page';
import { FuncionariosPage } from './funcionarios-page';
import { RhGrade } from './rh-grade';

type Aba = 'func' | 'cargos';

@Component({
  selector: 'ce-rh-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, AppHeader, EmptyState, CargosPage, FuncionariosPage, RhGrade],
  template: `
    <ng-template #abas>
      <div class="abas" role="group" aria-label="Seção">
        <button type="button" [attr.aria-pressed]="aba() === 'func'" (click)="aba.set('func')">
          Funcionários
        </button>
        <button type="button" [attr.aria-pressed]="aba() === 'cargos'" (click)="aba.set('cargos')">
          Cargos
        </button>
      </div>
    </ng-template>

    <ce-app-header titulo="Funcionários e cargos" [mostrarVoltar]="true" (voltar)="voltar()" />

    @if (!pode()) {
      <div class="pagina">
        <ce-empty-state
          icone="cadeado"
          titulo="Sem acesso"
          descricao="Seu cargo não tem a permissão rh.gerir. Peça ao ADM."
        />
      </div>
    } @else if (desktop()) {
      <ce-rh-grade>
        <div mestre>
          <ng-container *ngTemplateOutlet="abas" />
          @if (aba() === 'func') {
            <ce-funcionarios-page [embutido]="true" />
          }
        </div>
        @if (aba() === 'func') {
          <ce-empty-state icone="rh" titulo="Escolha um funcionário na lista" />
        } @else {
          <ce-cargos-page [embutido]="true" />
        }
      </ce-rh-grade>
    } @else {
      <ng-container *ngTemplateOutlet="abas" />
      @if (aba() === 'func') {
        <ce-funcionarios-page [embutido]="true" />
      } @else {
        <ce-cargos-page [embutido]="true" />
      }
    }
  `,
  styles: `
    @use 'mixins';

    .pagina {
      padding-inline: var(--ce-space-4);
      max-width: 560px;

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }
    }

    .abas {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 4px;
      margin: 4px var(--ce-space-4) 12px;
      padding: 4px;
      background: var(--ce-surface-muted);
      border: 1px solid var(--ce-border);
      border-radius: 14px;
    }

    .abas button {
      min-height: 44px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 15px;
    }

    .abas button[aria-pressed='true'] {
      background: var(--ce-primary);
      color: var(--ce-text-on-primary);
    }

    // no mestre do desktop o padding já vem da grade
    ce-rh-grade .abas {
      margin-inline: 0;
    }
  `,
})
export class RhPage {
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);
  protected readonly pode = () => this.permissions.has('rh.gerir');
  protected readonly aba = signal<Aba>('func');
  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 960px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected voltar(): void {
    this.router.navigateByUrl('/mais');
  }
}
