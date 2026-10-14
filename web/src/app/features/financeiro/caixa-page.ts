import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../ui/molecules/page-placeholder';

@Component({
  selector: 'ce-caixa-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagePlaceholder],
  template: `<ce-page-placeholder titulo="Caixa do dia" sprint="F7" />`,
})
export class CaixaPage {}
