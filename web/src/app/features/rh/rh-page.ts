import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CePermissao } from '../../core/permissions/ce-permissao';

@Component({
  selector: 'ce-rh-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CePermissao],
  template: `
    <div class="pagina">
      <h1>Funcionários e cargos</h1>
      <nav>
        <a *cePermissao="'rh.gerir'" routerLink="/rh/funcionarios">Funcionários</a>
        <a *cePermissao="'rh.gerir'" routerLink="/rh/cargos">Cargos</a>
      </nav>
    </div>
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
  `,
})
export class RhPage {}
