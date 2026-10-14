import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../ui/molecules/page-placeholder';

@Component({
  selector: 'ce-relatorios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagePlaceholder],
  template: `<ce-page-placeholder titulo="Relatórios" sprint="F9" />`,
})
export class RelatoriosPage {}
