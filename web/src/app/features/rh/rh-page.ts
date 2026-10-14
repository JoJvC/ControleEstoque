import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../ui/molecules/page-placeholder';

@Component({
  selector: 'ce-rh-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagePlaceholder],
  template: `<ce-page-placeholder titulo="Funcionários e cargos" sprint="F8" />`,
})
export class RhPage {}
