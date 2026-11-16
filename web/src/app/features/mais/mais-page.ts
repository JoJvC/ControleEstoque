import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../core/permissions/permission-service';
import { AcoesMais } from '../../layouts/shell-layout/acoes-mais';
import { NAV_ITENS } from '../../layouts/shell-layout/nav-itens';
import { Icon } from '../../ui/atoms/icon';
import { AppHeader } from '../../ui/organisms/app-header';

@Component({
  selector: 'ce-mais-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AppHeader, Icon],
  templateUrl: './mais-page.html',
  styleUrl: './mais-page.scss',
})
export class MaisPage {
  private readonly acoes = inject(AcoesMais);
  private readonly permissions = inject(PermissionService);

  protected readonly dev = this.acoes.dev;

  protected readonly links = computed(() =>
    NAV_ITENS.filter((l) => l.naMais && (!l.permissao || this.permissions.has(l.permissao))),
  );

  protected trocarOperador(): void {
    this.acoes.trocarOperador();
  }

  protected simularErroApi(): void {
    this.acoes.simularErroApi();
  }
}
